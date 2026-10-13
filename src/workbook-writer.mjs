import {readFile} from 'node:fs/promises';
import {extname,isAbsolute} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chooseWorkbook} from './platform-workbook.mjs';
const exec=promisify(execFile);
const apple=async script=>{try{const {stdout}=await exec('/usr/bin/osascript',['-e',script],{timeout:120000});return stdout.trim();}catch(e){throw Error(e.killed?'文件选择窗口未响应，请重试。':`文件选择失败：${e.stderr||e.message}`);}};
export async function openWorkbook(path){
 if(!path)path=await chooseWorkbook({apple});
 if(!path)return {cancelled:true};
 if(!isAbsolute(path)||!['.xls','.xlsx'].includes(extname(path).toLowerCase()))throw Error('请选择本机 .xls 或 .xlsx 文件');
 const bytes=await readFile(path);if(bytes.length>20*1024*1024)throw Error('Excel 超过 20 MB');
 return {path,content:bytes.toString('base64')};
}
