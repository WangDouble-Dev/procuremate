import {chooseWorkbook,runPowerShell,legacyWriteScript} from './platform-workbook.mjs';
import {readFile,writeFile,rename,unlink,stat} from 'node:fs/promises';
import {dirname,join,extname,isAbsolute} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
const exec=promisify(execFile),sessions=new Map();
const hash=b=>createHash('sha256').update(b).digest('hex');
const apple=async(script,args=[])=>{try{const {stdout}=await exec('/usr/bin/osascript',['-e',script,...args],{timeout:120000});return stdout.trim();}catch(e){throw Error(e.killed?'Microsoft Excel 或文件选择窗口未响应。请完成首次启动或权限提示后重试，输入已保留。':`本机文件操作未完成：${e.stderr||e.message}`);}};
export async function openWorkbook(path){
 if(!path)path=await chooseWorkbook({apple});
 if(!path)return {cancelled:true};
 if(!isAbsolute(path)||!['.xls','.xlsx'].includes(extname(path).toLowerCase()))throw Error('请选择本机 .xls 或 .xlsx 文件');
 const bytes=await readFile(path);if(bytes.length>20*1024*1024)throw Error('Excel 超过 20 MB');
 const token=randomUUID();sessions.set(token,{path,revision:hash(bytes),queue:Promise.resolve()});
 return {token,path,content:bytes.toString('base64')};
}
export async function saveWorkbook({token,sheet,changes}){
 const session=sessions.get(token);if(!session)throw Error('原文件连接已失效，请重新打开原 Excel。');
 const run=session.queue.catch(()=>{}).then(async()=>{
  const before=await readFile(session.path);if(hash(before)!==session.revision)throw Error('原 Excel 已被其他程序修改，未覆盖；当前输入仍保留，请先核对原文件。');
  const book=XLSX.read(before,{type:'buffer'}),ws=book.Sheets[sheet];if(!ws)throw Error('原工作表不存在');
  if(!Array.isArray(changes)||!changes.length)throw Error('没有需要保存的单价');
  for(const c of changes)if(!Number.isInteger(c.row)||!Number.isInteger(c.col)||c.row<1||c.col<1||c.row>1048576||c.col>16384||!(c.price===''||(/^\d+(\.\d+)?$/.test(String(c.price))&&Number.isFinite(Number(c.price)))))throw Error('单价应为空或非负数字');
  const temporary=join(dirname(session.path),'.procurement-'+randomUUID()+extname(session.path));
  try{
   if(extname(session.path).toLowerCase()==='.xlsx'){
    const zip=await JSZip.loadAsync(before);const workbook=await zip.file('xl/workbook.xml').async('string'),rels=await zip.file('xl/_rels/workbook.xml.rels').async('string');
    const sheetTags=[...workbook.matchAll(/<sheet\b[^>]*>/g)];const index=book.SheetNames.indexOf(sheet);const id=sheetTags[index]?.[0].match(/\br:id="([^"]+)"/)?.[1];
    const rel=[...rels.matchAll(/<Relationship\b[^>]*>/g)].find(m=>m[0].includes(`Id="${id}"`))?.[0];const target=rel?.match(/Target="([^"]+)"/)?.[1];if(!target)throw Error('无法定位原工作表');
    const part=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');let xml=await zip.file(part).async('string');
    for(const c of changes){const addr=XLSX.utils.encode_cell({r:c.row-1,c:c.col-1});const re=new RegExp(`<c\\b(?=[^>]*\\br="${addr}")[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`);const old=xml.match(re)?.[0];if(old&&/<f\b/.test(old))throw Error(`单元格 ${addr} 是公式，未覆盖`);
     const style=old?.match(/\bs="([^"]+)"/)?.[1];const cell=`<c r="${addr}"${style?` s="${style}"`:''}>${c.price===''?'':`<v>${Number(c.price)}</v>`}</c>`;
     if(old)xml=xml.replace(re,cell);else{const rowRe=new RegExp(`<row\\b(?=[^>]*\\br="${c.row}")[^>]*>[\\s\\S]*?<\\/row>`);if(!rowRe.test(xml))throw Error('未找到原始产品行');xml=xml.replace(rowRe,row=>{let inserted=false;row=row.replace(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,x=>{const a=x.match(/\br="([A-Z]+\d+)"/)?.[1];if(!inserted&&a&&XLSX.utils.decode_cell(a).c>=c.col){inserted=true;return cell+x;}return x;});return inserted?row:row.replace('</row>',cell+'</row>');});}
    }
    zip.file(part,xml);await writeFile(temporary,await zip.generateAsync({type:'nodebuffer'}),{mode:(await stat(session.path)).mode});
   }else{
    for(const c of changes)if(ws[XLSX.utils.encode_cell({r:c.row-1,c:c.col-1})]?.f)throw Error('目标单价为公式，未覆盖');
    await writeFile(temporary,before,{mode:(await stat(session.path)).mode});
    if(process.platform==='win32'){await runPowerShell(legacyWriteScript(temporary,sheet,changes));}
    else if(process.platform==='darwin'){
    const commands=changes.map(c=>`set value of range "${XLSX.utils.encode_cell({r:c.row-1,c:c.col-1})}" of targetSheet to ${c.price===''?'""':Number(c.price)}`).join('\n');
    await apple(`on run argv\n tell application "Microsoft Excel"\n open POSIX file (item 1 of argv)\n set targetBook to active workbook\n try\n set targetSheet to worksheet (item 2 of argv) of targetBook\n${commands}\n save workbook targetBook\n close targetBook saving no\n on error msg\n close targetBook saving no\n error msg\n end try\n end tell\nend run`,[temporary,sheet]);
    }else throw Error('当前平台不支持 .xls 写回，请用 WPS 另存为 .xlsx 后打开。');
   }
   if(hash(await readFile(session.path))!==session.revision)throw Error('保存期间原 Excel 被修改，未覆盖');
   const result=await readFile(temporary);const check=XLSX.read(result,{type:'buffer'}).Sheets[sheet];for(const c of changes){const value=check[XLSX.utils.encode_cell({r:c.row-1,c:c.col-1})]?.v;if(c.price===''?value!==undefined&&value!=='':Number(value)!==Number(c.price))throw Error('单价写入校验失败，原文件保持不变');}
   try{await rename(temporary,session.path);}catch(e){if(['EPERM','EACCES','EBUSY'].includes(e.code))throw Error('原文件被 WPS/Excel 占用或没有写入权限，请关闭该表格或解除只读后重试；输入已保留。');throw e;}session.revision=hash(result);return {path:session.path};
  }finally{await unlink(temporary).catch(()=>{});}
 });session.queue=run;return run;
}
