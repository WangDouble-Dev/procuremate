import {useEffect,useRef,useState} from 'react';
import {emptyData} from './core.mjs';
const EMPTY=()=>({version:1,data:emptyData(),rows:[],history:[]});
let queue=Promise.resolve();
function enqueue(fn){const task=queue.catch(()=>{}).then(fn);queue=task;return task;}
async function request(method='GET',body){
 const response=await fetch('/procurement-workbench/api',{method,headers:{'X-Procurement-Workbench':'1',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 let value;try{value=await response.json();}catch{throw Error('无法连接资料存储服务。请安装新版插件并重启，或启动新版预览服务。');}
 if(!response.ok)throw Error(value.error||'保存失败');return value;
}
export function useDiskState(){
 const [payload,setPayload]=useState(EMPTY),[info,setInfo]=useState(null),[ready,setReady]=useState(false),[status,setStatus]=useState('正在读取'),[error,setError]=useState('');
 const editVersion=useRef(0);
 const revision=useRef(''),baseline=useRef(''),failed=useRef(false),mounted=useRef(true),pending=useRef(0),loading=useRef(false);
 function accept(value){revision.current=value.revision;baseline.current=JSON.stringify(value.payload);setPayload(value.payload);setInfo(value);failed.current=false;setError('');setReady(true);setStatus(value.exists?'已保存到文件':'尚无数据，首次修改后写入文件');}
 async function reload(){
  loading.current=true;setReady(false);setStatus('正在读取');
  try{await queue.catch(()=>{});const value=await request();if(mounted.current)accept(value);}catch(e){if(mounted.current){setError(e.message);setStatus('读取失败');}}finally{loading.current=false;}
 }
 useEffect(()=>{mounted.current=true;reload();return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  if(!ready||loading.current)return;
  const serialized=JSON.stringify(payload);if(serialized===baseline.current){if(!pending.current&&!failed.current)setStatus(info?.exists?'已保存到文件':'尚无数据，首次修改后写入文件');return;}
  const version=editVersion.current;baseline.current=serialized;pending.current++;setStatus('正在保存');
  enqueue(async()=>{
   if(failed.current)throw Error('保存已暂停，请导出当前资料后重新载入。');
   try{const value=await request('PUT',{revision:revision.current,payload});revision.current=value.revision;if(mounted.current)setInfo(value);}catch(e){failed.current=true;throw e;}
  }).then(()=>{if(mounted.current&&pending.current===1&&editVersion.current===version)setStatus('已保存到文件');},e=>{if(mounted.current){setError(e.message);setStatus('保存失败，当前修改未确认写入文件');}}).finally(()=>pending.current--);
 },[payload,ready]);
 useEffect(()=>{const warn=e=>{if(pending.current||failed.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
 async function changeDirectory(directory,mode){
  await queue.catch(()=>{}); if(failed.current)throw Error('请先处理保存失败，再切换目录。');
  const value=await enqueue(()=>request('POST',{directory,mode,revision:revision.current}));accept(value);
 }
 const setter=key=>value=>{editVersion.current++;setStatus('正在保存');setPayload(p=>({...p,[key]:typeof value==='function'?value(p[key]):value}));};
 return {data:payload.data,rows:payload.rows,history:payload.history,setData:setter('data'),setRows:setter('rows'),setHistory:setter('history'),ready,status,error,info,reload,changeDirectory};
}
