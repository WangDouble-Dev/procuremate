import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export async function startPreview(){
 const root=await mkdtemp(join(tmpdir(),'procurement-ui-'));
 const configPath=join(root,'config','storage.json'),dataDir=join(root,'data');
 const child=spawn(process.execPath,['scripts/preview.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:'0',PROCUREMENT_CONFIG_PATH:configPath,PROCUREMENT_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('预览服务启动超时 '+stderr)),10000);child.once('exit',code=>{clearTimeout(timer);reject(Error('预览服务退出 '+code+' '+stderr));});child.stdout.on('data',chunk=>{const m=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});});
 return {root,url,configPath,dataDir,close:async()=>{child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});await rm(root,{recursive:true,force:true});}};
}
