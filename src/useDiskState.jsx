import {useEffect,useRef,useState} from 'react';
import {emptyData,emptyHistory} from './core.mjs';
const EMPTY=()=>({version:1,data:emptyData(),history:emptyHistory(),rows:[]});
let queue=Promise.resolve();
function enqueue(fn){const task=queue.catch(()=>{}).then(fn);queue=task;return task;}
async function request(method='GET',body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch('/procurement-workbench/api',{method,signal:controller.signal,headers:{'X-Procurement-Workbench':'1',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let value;try{value=await response.json();}catch{throw Error('无法连接资料存储服务。请安装新版插件并重启，或启动新版预览服务。');}
  if(!response.ok)throw Error(value.error||'保存失败');return value;
 }catch(e){if(e.name==='AbortError')throw Error('资料服务响应超时，请检查文件权限或保存目录后重试。');throw e;}finally{clearTimeout(timer);}
}
export function useDiskState(){
 const [payload,setPayload]=useState(EMPTY),[info,setInfo]=useState(null),[ready,setReady]=useState(false),[status,setStatus]=useState('正在读取'),[error,setError]=useState('');
 const editVersion=useRef(0);
 const latest=useRef(payload);latest.current=payload;
 const [excelStatus,setExcelStatus]=useState('');
 const revision=useRef(''),baseline=useRef(''),failed=useRef(false),mounted=useRef(true),pending=useRef(0),loading=useRef(false);
 function accept(value){revision.current=value.revision;const payload={version:1,data:value.payload.data,history:value.history||emptyHistory(),rows:latest.current.rows||[]};baseline.current=JSON.stringify({version:1,data:payload.data,history:payload.history});setPayload(payload);latest.current=payload;setInfo(value);failed.current=false;setError('');setReady(true);setStatus(value.exists?'已保存到文件':'尚无数据，首次修改后写入文件');}
 async function reload(){
  loading.current=true;setReady(false);setStatus('正在读取');
  try{await queue.catch(()=>{});const value=await request();if(mounted.current)accept(value);}catch(e){if(mounted.current){setError(e.message);setStatus('读取失败');}}finally{loading.current=false;}
 }
 useEffect(()=>{mounted.current=true;reload();return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  if(!ready||loading.current)return;
  const serialized=JSON.stringify({version:1,data:payload.data,history:payload.history});if(serialized===baseline.current){if(!pending.current&&!failed.current)setStatus(info?.exists?'已保存到文件':'尚无数据，首次修改后写入文件');return;}
  const version=editVersion.current;baseline.current=serialized;pending.current++;setStatus('正在保存');
  enqueue(async()=>{
   if(failed.current||version!==editVersion.current)return;
   try{const value=await request('PUT',{revision:revision.current,payload:{version:1,data:payload.data},history:payload.history});revision.current=value.revision;if(mounted.current)setInfo(value);}catch(e){failed.current=true;throw e;}
  }).then(()=>{if(mounted.current&&!failed.current&&pending.current===1&&editVersion.current===version)setStatus('已保存到文件');},e=>{if(mounted.current){setError(e.message);setStatus('保存失败，当前修改未确认写入文件');}}).finally(()=>pending.current--);
 },[payload,ready]);
 useEffect(()=>{const warn=e=>{if(pending.current||failed.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
 async function saveCurrent(overwrite=false){
  await queue.catch(()=>{});
  const next={version:1,data:latest.current.data};const nextHistory=latest.current.history;
  setStatus('正在保存');pending.current++;
  try{
   await enqueue(async()=>{
    let expected=revision.current;
    if(overwrite){const current=await request();if(current.directory!==info?.directory)throw Error('资料目录已被其他窗口切换，请切回原目录后重试；当前修改仍保留。');expected=current.revision;}
    const value=await request('PUT',{revision:expected,payload:next,history:nextHistory});
    baseline.current=JSON.stringify({...next,history:nextHistory});latest.current={...latest.current,data:next.data,history:nextHistory};setPayload(p=>({...p,data:next.data,history:nextHistory}));revision.current=value.revision;setInfo(value);failed.current=false;setError('');setStatus('已保存到文件');
   });
  }catch(e){failed.current=true;setError(e.message);setStatus('保存失败，修改已保留，可重试');}finally{pending.current--;}
 }
 async function openExcel(){const service=await request();if(!service.capabilities?.openExcel)throw Error('当前页面连接的是旧版保存服务，不支持打开原 Excel。请安装新版插件，完全退出并重新打开 DeepSeek Harness；预览页面则需重启预览服务。无需切换资料目录。');const value=await request('POST',{action:'openExcel'});return value;}
 function bindExcel(value){setExcelStatus('只读文件：'+value.path);}
 async function changeDirectory(directory,mode){
  await queue.catch(()=>{}); if(failed.current)throw Error('请先处理保存失败，再切换目录。');
  const value=await enqueue(()=>request('POST',{directory,mode,revision:revision.current}));accept(value);
 }
 const setter=key=>value=>{editVersion.current++;setStatus('正在保存');setPayload(p=>({...p,[key]:typeof value==='function'?value(p[key]):value}));};
 return {openExcel,bindExcel,excelStatus,data:payload.data,history:payload.history,rows:payload.rows,saveCurrent,setData:setter('data'),setHistory:setter('history'),setRows:value=>setPayload(p=>({...p,rows:typeof value==='function'?value(p.rows):value})),ready,status,error,info,reload,changeDirectory};
}
