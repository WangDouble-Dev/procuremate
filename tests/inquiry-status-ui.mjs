import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {exportBook} from '../src/excel.mjs';
import {startPreview} from './preview-fixture.mjs';
const f=await startPreview();let browser;
try{
 const path=f.root+'/需求.xlsx';await writeFile(path,await exportBook([{brand:'ABC',model:'A',quantity:1},{brand:'DEF',model:'B',quantity:2}]));
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await browser.newPage();p.setDefaultTimeout(15000);p.on('dialog',d=>d.accept());
 await p.route('**/procurement-workbench/api',route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().action==='openExcel')return route.continue({postData:JSON.stringify({action:'openExcel',path})});return route.continue();});
 await p.goto(f.url);
 async function importRows(){await p.getByRole('button',{name:'打开原 Excel',exact:true}).click();await p.getByRole('button',{name:'确认导入',exact:true}).click();}
 await importRows();await p.getByRole('button',{name:'A：未询价，标为已询价',exact:true}).click();
 await expect(p.locator('tr.pw-inquired')).toHaveCount(1);await expect(p.locator('.pw-storage-status')).toContainText('已保存到文件');
 await p.getByLabel('筛选询价状态').selectOption('pending');await expect(p.locator('tbody tr')).toHaveCount(1);await expect(p.locator('tbody tr')).toContainText('B');
 await p.getByRole('checkbox',{name:'选择当前筛选的全部行'}).check();await p.getByRole('button',{name:'选中标为已询价',exact:true}).click();await expect(p.locator('tbody tr')).toHaveCount(0);
 await expect(p.locator('.pw-storage-status')).toContainText('已保存到文件');await p.reload();await importRows();await expect(p.locator('tr.pw-inquired')).toHaveCount(0);await expect(p.locator('.pw-summary')).toContainText('已询价 0 行');await expect(p.locator('.pw-storage-status')).toContainText('已保存到文件');await p.getByRole('checkbox',{name:'选择当前筛选的全部行'}).check();await p.getByRole('button',{name:'选中标为已询价',exact:true}).click();await expect(p.locator('tr.pw-inquired')).toHaveCount(2);await importRows();await expect(p.locator('tr.pw-inquired')).toHaveCount(0);await p.getByRole('checkbox',{name:'选择当前筛选的全部行'}).check();await p.getByRole('button',{name:'选中标为已询价',exact:true}).click();
 await p.getByLabel('筛选询价状态').selectOption('done');await p.getByLabel('搜索采购明细').fill('A');await expect(p.locator('tbody tr')).toHaveCount(1);
 await p.getByRole('button',{name:'A：已询价，改为未询价',exact:true}).click();await expect(p.locator('tbody tr')).toHaveCount(0);
 await p.getByLabel('搜索采购明细').fill('');await p.getByLabel('筛选询价状态').selectOption('all');await expect(p.locator('tr.pw-inquired')).toHaveCount(1);
 await p.getByRole('checkbox',{name:'选择当前筛选的全部行'}).check();await p.getByRole('button',{name:'选中标为未询价',exact:true}).click();await expect(p.locator('tr.pw-inquired')).toHaveCount(0);await expect(p.locator('.pw-storage-status')).toContainText('已保存到文件');
 await p.getByRole('button',{name:'A：未询价，标为已询价',exact:true}).click();await expect(p.locator('.pw-storage-status')).toContainText('已保存到文件');await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:'test-results/询价标记.png',fullPage:true});
 console.log('询价标记 UI PASS：逐行标记、批量标记、状态与搜索筛选、重载及同页重新导入清空、撤销');
}finally{await browser?.close();await f.close();}
