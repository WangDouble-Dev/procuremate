import {chromium} from '@playwright/test';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {startPreview} from './preview-fixture.mjs';
const fixture=await startPreview();
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext();const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const saved=()=>page.locator('.pw-storage-status').filter({hasText:'已保存到文件'}).waitFor();
try{
 await mkdir(fixture.dataDir,{recursive:true});
 let file=join(fixture.dataDir,'procurement-workbench.json');
 await writeFile(file,JSON.stringify({version:1,data:{suppliers:[{brand:'演示品牌',name:'文件供货商',wechat:'demo'}],prices:[],channels:[],rules:[]},rows:[],history:[]}));
 await page.addInitScript(()=>{
  const key='dsh-procurement-workbench:v1';
  localStorage.setItem(key,JSON.stringify({version:1,data:{suppliers:[{brand:'过时品牌',name:'浏览器旧资料'}],prices:[],channels:[],rules:[]},rows:[],history:[]}));
  window.legacyStorageCalls=[];
  for(const method of ['getItem','removeItem']){const original=Storage.prototype[method];Storage.prototype[method]=function(k){if(k===key)window.legacyStorageCalls.push(method);return original.call(this,k);};}
 });
 await page.goto(fixture.url);await saved();
 assert.equal(await page.getByRole('button',{name:'迁移旧版浏览器资料'}).count(),0);
 assert.deepEqual(await page.evaluate(()=>window.legacyStorageCalls),[]);
 assert.ok(await page.evaluate(()=>Object.keys(localStorage).includes('dsh-procurement-workbench:v1')));
 assert.equal(JSON.parse(await readFile(file,'utf8')).data.suppliers[0].name,'文件供货商');
 await page.getByRole('button',{name:/^供货商/}).click();await page.getByRole('button',{name:'编辑',exact:true}).click();await page.getByLabel('供货商名称',{exact:true}).fill('已维护的供货商');await page.getByRole('button',{name:'保存修改'}).click();await saved();
 assert.equal(JSON.parse(await readFile(file,'utf8')).data.suppliers[0].name,'已维护的供货商');
 await page.getByRole('button',{name:'存储设置',exact:true}).click();const dest=join(fixture.root,'新目录');await page.getByRole('textbox',{name:'资料存储目录',exact:true}).fill(dest);await page.getByRole('button',{name:'复制当前资料并切换'}).click();await page.getByRole('status').filter({hasText:'已复制资料并切换目录'}).waitFor();
 assert.equal(JSON.parse(await readFile(fixture.configPath,'utf8')).dataDir,dest);assert.equal(JSON.parse(await readFile(join(dest,'procurement-workbench.json'),'utf8')).data.suppliers.length,1);assert.deepEqual(await readdir(dest),['procurement-workbench.json']);
 // New browser context has no localStorage and still reads the same directory.
 const second=await browser.newContext();const other=await second.newPage();await other.goto(fixture.url);await other.getByRole('button',{name:/^供货商/}).click();await other.getByText('已维护的供货商',{exact:true}).waitFor();assert.ok((await other.locator('.pw-storage-status').innerText()).includes(dest));
 // Target collision must not change the active directory.
 await page.getByRole('textbox',{name:'资料存储目录',exact:true}).fill(fixture.dataDir);await page.getByRole('button',{name:'复制当前资料并切换'}).click();await page.getByRole('status').filter({hasText:'目标目录已经有采购资料'}).waitFor();assert.equal(JSON.parse(await readFile(fixture.configPath,'utf8')).dataDir,dest);
 await page.getByRole('button',{name:'使用目标目录资料'}).click();await page.getByRole('status').filter({hasText:'已切换资料目录'}).waitFor();
 // The other window must not silently save into the newly selected directory.
 await other.getByRole('button',{name:'编辑',exact:true}).click();await other.getByLabel('供货商名称',{exact:true}).fill('旧窗口覆盖测试');await other.getByRole('button',{name:'保存修改'}).click();await other.getByRole('alert').filter({hasText:'其他窗口'}).waitFor();assert.equal(JSON.parse(await readFile(file,'utf8')).data.suppliers[0].name,'已维护的供货商');
 await page.screenshot({path:'/private/tmp/procurement-storage-ui.png'});assert.deepEqual(errors,[]);await second.close();
 console.log('文件存储 UI PASS：不检测旧资料、实际落盘、编辑维护、目录切换、跨浏览器读取、目标冲突、多窗口防覆盖。');
}finally{await browser.close();await fixture.close();}
