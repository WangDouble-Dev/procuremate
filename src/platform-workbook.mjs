import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {win32} from 'node:path';
const exec=promisify(execFile);
export function powershellCommand(script,systemRoot=process.env.SystemRoot||'C:\\Windows'){
 return {file:win32.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),args:['-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop'; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false);\n"+script,'utf16le').toString('base64')]};
}
export async function runPowerShell(script,runner=exec){const command=powershellCommand(script);try{const {stdout}=await runner(command.file,command.args,{timeout:120000,windowsHide:true,maxBuffer:1024*1024,encoding:'utf8'});return stdout.replace(/^\uFEFF/,'').trim();}catch(e){throw Error(e.killed?'文件选择窗口未响应，请重试。':`Windows 文件操作失败：${e.stderr||e.message}`);}}
export const FILE_PICKER_SCRIPT=String.raw`Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '选择要查看的采购表'
$dialog.Filter = '采购表 (*.xlsx;*.xls)|*.xlsx;*.xls'
$dialog.CheckFileExists = $true
$dialog.Multiselect = $false
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
try { if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.FileName) } } finally { $dialog.Dispose(); $owner.Dispose() }`;
export async function chooseWorkbook({platform=process.platform,apple,powerShell=runPowerShell}={}){
 let path;
 if(platform==='win32')path=await powerShell(FILE_PICKER_SCRIPT);
 else if(platform==='darwin')path=await apple('try\n return POSIX path of (choose file with prompt "选择要查看的采购表")\n on error number -128\n return ""\nend try');
 else throw Error('当前支持 Windows 和 macOS 本机选择采购表。');
 return path?.trim()||null;
}
