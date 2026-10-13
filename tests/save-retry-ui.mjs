import {chromium,expect} from '@playwright/test';import {readFile,mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';import {startPreview} from './preview-fixture.mjs';
const f=await startPreview(),browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const path=f.root+'/原表.xlsx',b=new ExcelJS.Workbook(),s=b.addWorksheet('采购');s.addRow(['品牌','型号','数量','单价','需求公司']);s.addRow(['ABC','A',1,10,'武汉吉利汽车部件有限公司']);await b.xlsx.writeFile(path);
 await mkdir(f.dataDir,{recursive:true});const dataFile=f.dataDir+'/procurement-workbench.json';await writeFile(dataFile,JSON.stringify({version:1,data:{suppliers:[],prices:[],channels:[],rules:[]}}));
 const page=await browser.newPage();let fail=false,writes=0;
 await page.route('**/procurement-workbench/api',async route=>{const req=route.request();if(req.method()==='POST'){const body=req.postDataJSON();if(body.action==='openExcel')return route.continue({postData:JSON.stringify({...body,path})});if(body.action==='saveExcel'){writes++;if(fail)return route.fulfill({status:500,contentType:'application/json',body:'{"error":"测试写入失败"}'});}}return route.continue();});
 await page.goto(f.url);await page.getByRole('button',{name:'打开原 Excel',exact:true}).click();await page.getByRole('button',{name:'确认导入',exact:true}).click();await expect(page.getByRole('columnheader',{name:'单价',exact:true})).toHaveCount(0);assert.equal(await page.locator('input.pw-price').count(),0);assert.equal(writes,0);assert.equal(await page.getByRole('button',{name:'回填选中行价格'}).count(),0);assert.ok(!('rows' in JSON.parse(await readFile(dataFile,'utf8'))));
 console.log('原表 UI PASS：打开、只读单价、无写回请求、无回填按钮、JSON 不存明细。');
}finally{await browser.close();await f.close();}
