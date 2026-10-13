import {test} from 'node:test';import assert from 'node:assert/strict';
import {chooseWorkbook,powershellCommand,runPowerShell} from '../src/platform-workbook.mjs';
test('Windows 选择分支保留中文和空格路径，不调用 macOS',async()=>{let calls=0;assert.equal(await chooseWorkbook({platform:'win32',apple:()=>{throw Error('错误平台')},powerShell:async s=>{calls++;assert.match(s,/OpenFileDialog/);return 'D:\\采购 资料\\需求.xlsx';}}),'D:\\采购 资料\\需求.xlsx');assert.equal(calls,1);assert.equal(await chooseWorkbook({platform:'win32',powerShell:async()=>''}),null);});
test('macOS 选择和取消均有明确结果',async()=>{assert.equal(await chooseWorkbook({platform:'darwin',apple:async()=>'/Users/test/采购.xlsx'}),'/Users/test/采购.xlsx');assert.equal(await chooseWorkbook({platform:'darwin',apple:async()=>''}),null);});
