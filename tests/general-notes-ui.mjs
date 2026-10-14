import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {exportBook} from '../src/excel.mjs';
import {startPreview} from './preview-fixture.mjs';
const f=await startPreview();let browser;
try{
 await mkdir(f.dataDir,{recursive:true});
 await writeFile(f.dataDir+'/procurement-workbench.json',JSON.stringify({version:1,data:{suppliers:[],prices:[],channels:[],rules:['核对报价条件与有效期','重物或大件物品需确认是否包含卸货','合同内的历史价格不能直接使用','确认发票要求','核对交货周期'].map(message=>({message}))}}));
 const path=f.root+'/需求.xlsx';await writeFile(path,await exportBook([{brand:'ABC',model:'A',quantity:1}]));
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await browser.newPage();p.setDefaultTimeout(15000);p.on('dialog',d=>d.accept());
 await p.route('**/procurement-workbench/api',route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().action==='openExcel')return route.continue({postData:JSON.stringify({action:'openExcel',path})});return route.continue();});
 await p.setViewportSize({width:1440,height:1000});await p.goto(f.url);
 async function importRows(){await p.getByRole('button',{name:'打开原 Excel',exact:true}).click();await p.getByRole('button',{name:'确认导入',exact:true}).click();}
 await expect(p.getByRole('region',{name:'通用注意事项'})).toContainText('导入采购明细后');await importRows();
 const notes=p.locator('.pw-general-notes-list p');await expect(notes).toHaveCount(3);await expect(p.locator('aside')).not.toContainText('通用注意事项');
 const region=await p.locator('.pw-general-notes').boundingBox(),table=await p.locator('.pw-sheet').boundingBox();if(region.y+region.height>table.y)throw Error('提醒未置于表格上方');
 await p.screenshot({path:'test-results/通用提醒.png',fullPage:true});
 await p.getByRole('button',{name:'展开全部（5 条）',exact:true}).click();await expect(notes).toHaveCount(5);
 await p.getByRole('button',{name:'收起',exact:true}).click();await expect(notes).toHaveCount(3);
 await p.getByRole('button',{name:'展开全部（5 条）',exact:true}).click();await importRows();await expect(notes).toHaveCount(3);
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:'test-results/通用提醒-移动.png',fullPage:true});
 console.log('通用提醒 UI PASS：表格上方、默认三条、展开收起、重导入收起、移动布局');
}finally{await browser?.close();await f.close();}
