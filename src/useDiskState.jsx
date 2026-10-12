import {useEffect,useRef,useState} from 'react';
import {emptyData} from './core.mjs';
const EMPTY=()=>({version:1,data:emptyData(),rows:[]});
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
 const latest=useRef(payload);latest.current=payload;
 const [excel,setExcel]=useState(null),[excelStatus,setExcelStatus]=useState(''),[excelError,setExcelError]=useState('');const excelQueue=useRef(Promise.resolve());
 const [priceDraft,setPriceDraft]=useState({});const draftRef=useRef(priceDraft);draftRef.current=priceDraft;
 const revision=useRef(''),baseline=useRef(''),failed=useRef(false),mounted=useRef(true),pending=useRef(0),loading=useRef(false);
 function accept(value){revision.current=value.revision;const payload={version:1,data:value.payload.data,rows:latest.current.rows||[]};baseline.current=JSON.stringify({version:1,data:payload.data});setPayload(payload);latest.current=payload;setPriceDraft({});setInfo(value);failed.current=false;setError('');setReady(true);setStatus(value.exists?'已保存到文件':'尚无数据，首次修改后写入文件');}
 async function reload(){
  loading.current=true;setReady(false);setStatus('正在读取');
  try{await queue.catch(()=>{});const value=await request();if(mounted.current)accept(value);}catch(e){if(mounted.current){setError(e.message);setStatus('读取失败');}}finally{loading.current=false;}
 }
 useEffect(()=>{mounted.current=true;reload();return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  if(!ready||loading.current)return;
  const serialized=JSON.stringify({version:1,data:payload.data});if(serialized===baseline.current){if(!pending.current&&!failed.current)setStatus(info?.exists?'已保存到文件':'尚无数据，首次修改后写入文件');return;}
  const version=editVersion.current;baseline.current=serialized;pending.current++;setStatus('正在保存');
  enqueue(async()=>{
   if(failed.current)return;
   try{const value=await request('PUT',{revision:revision.current,payload:{version:1,data:payload.data}});revision.current=value.revision;if(mounted.current)setInfo(value);}catch(e){failed.current=true;throw e;}
  }).then(()=>{if(mounted.current&&!failed.current&&pending.current===1&&editVersion.current===version)setStatus('已保存到文件');},e=>{if(mounted.current){setError(e.message);setStatus('保存失败，当前修改未确认写入文件');}}).finally(()=>pending.current--);
 },[payload,ready]);
 useEffect(()=>{const warn=e=>{if(pending.current||failed.current||Object.keys(draftRef.current).length){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
 async function saveCurrent(overwrite=false){
  await queue.catch(()=>{});
  const drafts=draftRef.current;
  const next={version:1,data:latest.current.data};
  setStatus('正在保存');pending.current++;
  try{
   await enqueue(async()=>{
    let expected=revision.current;
    if(overwrite){const current=await request();if(current.directory!==info?.directory)throw Error('资料目录已被其他窗口切换，请切回原目录后重试；当前修改仍保留。');expected=current.revision;}
    const value=await request('PUT',{revision:expected,payload:next});
    baseline.current=JSON.stringify(next);latest.current={...latest.current,data:next.data};setPayload(p=>({...p,data:next.data}));revision.current=value.revision;setInfo(value);failed.current=false;setError('');setStatus('已保存到文件');
   });
  }catch(e){failed.current=true;setError(e.message);setStatus('保存失败，修改已保留，可重试');}finally{pending.current--;}
 }
 async function openExcel(){if(Object.keys(draftRef.current).length)throw Error('请先重试保存未写入 Excel 的单价');const service=await request();if(!service.capabilities?.openExcel)throw Error('当前页面连接的是旧版保存服务，不支持打开原 Excel。请安装新版插件，完全退出并重新打开 DeepSeek Harness；预览页面则需重启预览服务。无需切换资料目录。');const value=await request('POST',{action:'openExcel'});return value;}
 function bindExcel(value,sheet,col){setExcel({...value,sheet,col});setPriceDraft({});setExcelError('');setExcelStatus('单价将写回：'+value.path);}
 async function flushPrices(){
  const task=excelQueue.current.catch(()=>{}).then(async()=>{
   const drafts={...draftRef.current};if(!Object.keys(drafts).length)return;
   if(!excel||!excel.col){setExcelError('请打开原 Excel 并对应单价列');return;}
   setExcelStatus('正在写入原 Excel');
   try{await request('POST',{action:'saveExcel',token:excel.token,sheet:excel.sheet,changes:latest.current.rows.filter(r=>drafts[r.id]).map(r=>({row:r.sourceRow,col:Number(excel.col),price:drafts[r.id].price}))});
    setPayload(p=>({...p,rows:p.rows.map(r=>drafts[r.id]?{...r,...drafts[r.id]}:r)}));
    setPriceDraft(p=>{const next=Object.fromEntries(Object.entries(p).filter(([id,v])=>v!==drafts[id]));draftRef.current=next;return next;});setExcelError('');setExcelStatus('单价已写入：'+excel.path);
   }catch(e){setExcelError(e.message);setExcelStatus('Excel 保存失败，输入已保留');}
  });excelQueue.current=task;return task;
 }
 function editPrice(id,price){const next={...draftRef.current,[id]:{price,basis:'手动填写，计价条件待确认'}};draftRef.current=next;setPriceDraft(next);}
 async function changeDirectory(directory,mode){
  if(Object.keys(draftRef.current).length)throw Error('请先重试写入 Excel，再切换目录。');
  await queue.catch(()=>{}); if(failed.current)throw Error('请先处理保存失败，再切换目录。');
  const value=await enqueue(()=>request('POST',{directory,mode,revision:revision.current}));accept(value);
 }
 const setter=key=>value=>{editVersion.current++;setStatus('正在保存');setPayload(p=>({...p,[key]:typeof value==='function'?value(p[key]):value}));};
 return {openExcel,bindExcel,flushPrices,excelStatus,excelError,data:payload.data,rows:payload.rows.map(r=>priceDraft[r.id]?{...r,...priceDraft[r.id]}:r),priceDirty:!!Object.keys(priceDraft).length,editPrice,saveCurrent,setData:setter('data'),setRows:value=>setPayload(p=>({...p,rows:typeof value==='function'?value(p.rows):value})),ready,status,error,info,reload,changeDirectory};
}
