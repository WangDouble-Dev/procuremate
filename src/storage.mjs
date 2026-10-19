import {openWorkbook} from './workbook-writer.mjs';
import {readFile,mkdir,open,rename,unlink} from 'node:fs/promises';
import {join,dirname,isAbsolute,normalize} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {emptyData,emptyHistory,validateData,withoutLegacyPrices} from './core.mjs';

export const DATA_FILE='procurement-workbench.json';
export const HISTORY_FILE='history.json';
export const defaultConfigPath=()=>join(homedir(),'.config','dsh-procurement-workbench','storage.json');
export const defaultDirectory=()=>join(homedir(),'buyer','data');
export const blankPayload=()=>({version:1,data:emptyData()});
export const blankHistory=()=>emptyHistory();
function fail(message,status=400){return Object.assign(new Error(message),{status});}
export function validatePayload(p){
 if(!p||p.version!==1)throw fail('数据文件格式不正确：缺少资料或采购明细。');
 const data=withoutLegacyPrices(p.data);validateData(data);

 if(JSON.stringify(p).length>20*1024*1024)throw fail('资料超过 20 MB，请先精简资料。',413);
 return {version:1,data};
}
function directoryPath(value){
 if(typeof value!=='string'||!value.trim())throw fail('请填写绝对目录路径。');
 const s=value.trim().replace(/^~(?=[/\\]|$)/,homedir());
 if(!isAbsolute(s))throw fail('请填写本机绝对目录路径，例如 Windows 的 D:\\采购资料 或 macOS 的 /Users/用户名/buyer/data。');
 return normalize(s);
}
function validateHistory(history){
 if(!Array.isArray(history))throw fail('历史成交价文件必须是物料编码字符串数组。');
 const codes=[];const seen=new Set();
 for(const item of history){
  if(typeof item!=='string'||!item.trim())throw fail('历史成交价必须是非空物料编码字符串。');
  const clean=item.normalize('NFKC').trim(),key=clean.toLowerCase();if(!seen.has(key)){seen.add(key);codes.push(clean);}
 }
 return codes;
}
async function readOptional(path){try{return await readFile(path,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function atomicWrite(path,value){
 await mkdir(dirname(path),{recursive:true,mode:0o700});
 const temp=path+'.tmp-'+randomUUID();let handle;
 try{handle=await open(temp,'wx',0o600);await handle.writeFile(JSON.stringify(value,null,2)+'\n','utf8');await handle.sync();await handle.close();handle=null;await rename(temp,path);}finally{if(handle)await handle.close().catch(()=>{});await unlink(temp).catch(()=>{});}
}
function revision(directory,raw,historyRaw){return createHash('sha256').update(directory+'\0'+(raw??'<missing>')+'\0'+(historyRaw??'<missing>')).digest('hex');}
export function createStorage({configPath=defaultConfigPath(),dataDir=defaultDirectory()}={}){
 configPath=normalize(configPath);dataDir=directoryPath(dataDir);
 const lockPath=configPath+'.lock';
 async function withLock(fn){
  await mkdir(dirname(configPath),{recursive:true,mode:0o700});
  let handle;const token=randomUUID();
  for(let n=0;n<40;n++){
   try{handle=await open(lockPath,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid,token}));break;}catch(e){
    if(e.code!=='EEXIST')throw e;
    const lock=await readOptional(lockPath);
    if(lock){try{const owner=JSON.parse(lock);if(Number.isInteger(owner.pid)&&owner.pid>0){try{process.kill(owner.pid,0);}catch(error){if(error.code==='ESRCH'&&(await readOptional(lockPath))===lock)await unlink(lockPath).catch(()=>{});}}}catch{}}
    await new Promise(r=>setTimeout(r,50));
   }
  }
  if(!handle)throw fail('另一个窗口正在保存，或上次异常退出留下文件锁。请稍后重试；若持续失败，请检查 '+lockPath,409);
  try{return await fn();}finally{await handle.close();const raw=await readOptional(lockPath);if(raw){try{if(JSON.parse(raw).token===token)await unlink(lockPath);}catch{}}}
 }
 async function activeDirectory(){
  const raw=await readOptional(configPath);if(raw===null)return dataDir;
  let config;try{config=JSON.parse(raw);}catch{throw fail('保存目录设置损坏，请检查 '+configPath);}
  return directoryPath(config.dataDir);
 }
async function snapshot(directory){
  const file=join(directory,DATA_FILE);let raw=await readOptional(file),historyRaw=await readOptional(join(directory,HISTORY_FILE)),payload=blankPayload(),history=blankHistory();const historyFile=join(directory,HISTORY_FILE);
  if(raw!==null){try{const parsed=JSON.parse(raw);payload=validatePayload(parsed);if(JSON.stringify(parsed)!==JSON.stringify(payload)){await atomicWrite(file,payload);raw=JSON.stringify(payload,null,2)+'\n';}}catch(e){throw fail('无法读取数据文件 '+file+'：'+e.message);}}
  if(historyRaw!==null){try{history=validateHistory(JSON.parse(historyRaw));}catch(e){throw fail('无法读取历史成交价文件 '+historyFile+'：'+e.message);}}
  if(historyRaw===null){await atomicWrite(historyFile,history);historyRaw=JSON.stringify(history,null,2)+'\n';}
  return {directory,file,historyFile,configPath,exists:raw!==null,history,revision:revision(directory,raw,historyRaw),payload};
 }
 function expectRevision(current,expected){if(current.revision!==expected)throw fail('资料已被其他窗口修改，或保存目录已经改变。当前修改尚未保存，请先导出当前资料，再重新载入。',409);}
 return {
  read:()=>withLock(async()=>snapshot(await activeDirectory())),
  save:(payload,expected,history)=>withLock(async()=>{payload=validatePayload(payload);const current=await snapshot(await activeDirectory());expectRevision(current,expected);const nextHistory=history===undefined?current.history:validateHistory(history);await atomicWrite(current.file,payload);await atomicWrite(current.historyFile,nextHistory);return snapshot(current.directory);}),
  changeDirectory:(requested,mode,expected)=>withLock(async()=>{
   if(!['copy','open'].includes(mode))throw fail('请选择复制当前资料或使用目标目录资料。');
   const directory=directoryPath(requested),current=await snapshot(await activeDirectory());expectRevision(current,expected);
   if(directory===current.directory)return current;
   const target=await snapshot(directory);
   if(mode==='copy'&&target.exists)throw fail('目标目录已经有采购资料，未覆盖。请改选「使用目标目录资料」或选择空目录。',409);
   // Finish preparing data before publishing the new directory pointer.
   if(mode==='copy'||!target.exists){await atomicWrite(target.file,mode==='copy'?current.payload:blankPayload());await atomicWrite(target.historyFile,mode==='copy'?current.history:blankHistory());}
   await atomicWrite(configPath,{version:1,dataDir:directory});
   return snapshot(directory);
  })
 };
}

export const API_PATH='/procurement-workbench/api';
function checkRequest(req){
 const host=new URL('http://'+(req.headers.host||'invalid')).hostname;
 if(!['localhost','127.0.0.1','[::1]'].includes(host))throw fail('采购资料接口仅供本机使用。',403);
 const remote=req.socket?.remoteAddress;
 if(remote&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote))throw fail('采购资料接口仅供本机使用。',403);
 if(req.headers['x-procurement-workbench']!=='1')throw fail('请求缺少工作台标识。',403);
 const origin=req.headers.origin;
 if(origin&&origin!=='null'){
  let u;try{u=new URL(origin);}catch{throw fail('请求来源无效。',403);}
  if(u.host!==req.headers.host||!['http:','https:'].includes(u.protocol))throw fail('请求来源不匹配。',403);
 }
}
async function bodyOf(req){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw fail('请求内容必须是 JSON。',415);
 let bytes=0;const parts=[];for await(const part of req){bytes+=part.length;if(bytes>24*1024*1024)throw fail('请求超过 24 MB。',413);parts.push(part);}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw fail('JSON 格式错误。');}
}
export function createStorageHandler(store){return async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  checkRequest(req);let result;
  if(req.method==='GET')result={...await store.read(),capabilities:{openExcel:true,saveExcel:false},apiVersion:2};
  else if(req.method==='PUT'){const body=await bodyOf(req);result=await store.save(body.payload,body.revision,body.history);}
  else if(req.method==='POST'){const body=await bodyOf(req);if(body.action==='openExcel')result=await openWorkbook(body.path);else if(body.action==='saveExcel')throw fail('采购表为只读模式，不支持保存或修改原 Excel。',405);else if(!body.action&&['copy','open'].includes(body.mode))result=await store.changeDirectory(body.directory,body.mode,body.revision);else throw fail('无法识别此操作，请更新插件并重启 DeepSeek Harness。');}
  else throw fail('不支持此操作。',405);
  res.writeHead(200).end(JSON.stringify(result));
 }catch(e){res.writeHead(e.status||500).end(JSON.stringify({error:e.code?`文件操作失败（${e.code}）：${e.message}`:e.message}));}
};}
