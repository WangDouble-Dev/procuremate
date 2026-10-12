import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {win32} from 'node:path';
const exec=promisify(execFile);
export function powershellCommand(script,systemRoot=process.env.SystemRoot||'C:\\Windows'){
 return {file:win32.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),args:['-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop'; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false);\n"+script,'utf16le').toString('base64')]};
}
export async function runPowerShell(script,runner=exec){const command=powershellCommand(script);try{const {stdout}=await runner(command.file,command.args,{timeout:120000,windowsHide:true,maxBuffer:1024*1024,encoding:'utf8'});return stdout.replace(/^\uFEFF/,'').trim();}catch(e){throw Error(e.killed?'文件选择或 WPS/Excel 未响应，请关闭提示窗口后重试，输入已保留。':`Windows 文件操作失败：${e.stderr||e.message}`);}}
export const FILE_PICKER_SCRIPT=String.raw`Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '选择要直接保存单价的采购表'
$dialog.Filter = '采购表 (*.xlsx;*.xls)|*.xlsx;*.xls'
$dialog.CheckFileExists = $true
$dialog.Multiselect = $false
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
try { if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.FileName) } } finally { $dialog.Dispose(); $owner.Dispose() }`;
export async function chooseWorkbook({platform=process.platform,apple,powerShell=runPowerShell}={}){
 let path;
 if(platform==='win32')path=await powerShell(FILE_PICKER_SCRIPT);
 else if(platform==='darwin')path=await apple('try\n return POSIX path of (choose file with prompt "选择要直接保存单价的采购表")\n on error number -128\n return ""\nend try');
 else throw Error('当前支持 Windows 和 macOS 本机选择采购表。');
 return path?.trim()||null;
}
export function legacyWriteScript(path,sheet,changes){
 // User paths, sheet names and values are data, never interpolated as PowerShell code.
 const encoded=Buffer.from(JSON.stringify({path,sheet,changes}),'utf8').toString('base64');
 return `$inputData = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json\n`+String.raw`$app = $null; $book = $null; $sheet = $null; $cell = $null
$alerts = $null; $security = $null
try {
 foreach ($provider in @('KET.Application','Excel.Application')) {
  try { $app = New-Object -ComObject $provider; break } catch { $app = $null }
 }
 if ($null -eq $app) { throw '没有可用的 WPS/Excel 自动化接口。请在 WPS 中将 .xls 另存为 .xlsx，再打开另存后的文件。' }
 $alerts = $app.DisplayAlerts; $app.DisplayAlerts = $false
 try { $security = $app.AutomationSecurity; $app.AutomationSecurity = 3 } catch { }
 $book = $app.Workbooks.Open([string]$inputData.path, 0, $false)
 if ($book.ReadOnly) { throw '表格以只读方式打开，未保存。' }
 $sheet = $book.Worksheets.Item([string]$inputData.sheet)
 foreach ($change in $inputData.changes) {
  $cell = $sheet.Cells.Item([int]$change.row,[int]$change.col)
  if ($cell.HasFormula) { throw '目标单价是公式，未覆盖。' }
  if ([string]$change.price -eq '') { $cell.ClearContents() | Out-Null } else { $cell.Value2 = [double]::Parse([string]$change.price,[Globalization.CultureInfo]::InvariantCulture) }
  [Runtime.InteropServices.Marshal]::ReleaseComObject($cell) | Out-Null; $cell = $null
 }
 $book.Save()
} finally {
 if ($null -ne $cell) { [Runtime.InteropServices.Marshal]::ReleaseComObject($cell) | Out-Null }
 if ($null -ne $sheet) { [Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) | Out-Null }
 if ($null -ne $book) { try { $book.Close($false) } finally { [Runtime.InteropServices.Marshal]::ReleaseComObject($book) | Out-Null } }
 if ($null -ne $app) {
  try { if ($null -ne $alerts) { $app.DisplayAlerts = $alerts }; if ($null -ne $security) { $app.AutomationSecurity = $security } } finally { [Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null }
 }
}`;
}
