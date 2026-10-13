import {test} from 'node:test';import assert from 'node:assert/strict';import {emptyData,quoteFor,inquiry,suppliersFor,reminders,rowReminders,validateData,safeUrl} from '../src/core.mjs';import {exportBook,readBook,sheetRows} from '../src/excel.mjs';
const row={id:'1',brand:'ABC',name:'传感器',model:'001-A',unit:'个',quantity:'2'};
const price={brand:'ABC',model:'001-A',unit:'个',price:0,currency:'CNY',tax:'含税',freight:'到付',validUntil:'2099-12-31',supplier:'测试供货商'};
test('品牌别名精确匹配，不使用子串匹配',()=>{const s=[{brand:'ABC',aliases:'艾比西|abc inc',name:'供货商'}];assert.equal(suppliersFor({...row,brand:'艾比西'},s).length,1);assert.equal(suppliersFor({...row,brand:'AB'},s).length,0)});
test('有效唯一报价允许零价，过期/冲突/型号/单位/起订量不符时拒绝',()=>{const d={...emptyData(),prices:[price]};assert.equal(quoteFor(row,d).quote.price,0);for(const change of [{validUntil:'2000-01-01'},{unit:'箱'},{model:'001A'},{minQty:3},{tax:''},{freight:''},{price:''}])assert.ok(!quoteFor(row,{...d,prices:[{...price,...change}]}).quote);assert.ok(!quoteFor(row,{...d,prices:[price,price]}).quote);assert.ok(!quoteFor({...row,unit:''},d).quote)});
test('询价不泄露内部价格、来源与联系方式，去除单元格换行',()=>{const text=inquiry([{...row,price:12345,basis:'机密底价',contact:'私密联系人',note:'第一行\n第二行'}]);assert.ok(text.includes('001-A'));assert.ok(!text.includes('第一行')); for(const x of ['12345','机密底价','私密联系人'])assert.ok(!text.includes(x))});
test('提醒按品牌过滤，忽略旧场景',()=>{const d={...emptyData(),rules:[{brand:'ABC',stage:'询价',message:'询问货期'}]};assert.equal(reminders(row,d,'询价').length,1);assert.equal(reminders(row,d,'导出').length,1)});
test('渠道网址与资料结构校验',()=>{assert.equal(safeUrl('javascript:alert(1)'),null);assert.throws(()=>validateData({...emptyData(),prices:[{}]}));assert.throws(()=>validateData({...emptyData(),channels:[{brand:'ABC',url:'https://example.com'}]}))});
test('导出 XLSX 可重读，保持型号前导零与文本，合作行高亮',async()=>{const b=await readBook(await exportBook([{...row,model:'00123',note:'=HYPERLINK("bad")',supplier:'测试供货商'}]));const s=b.worksheets[0];const r=sheetRows(s,1,{brand:1,name:2,model:3,quantity:4,unit:5,note:6,price:7})[0];assert.equal(r.model,'00123');assert.equal(r.note,'=HYPERLINK("bad")');assert.equal(s.getCell('A2').fill.fgColor.argb,'FFE6F3ED');assert.equal(s.getCell('F2').type,3)});
test('非法日期不参与回填，嵌套对象资料不允许渲染',()=>{assert.ok(!quoteFor(row,{...emptyData(),prices:[{...price,validUntil:'2099-99-99'}]}).quote);assert.throws(()=>validateData({...emptyData(),suppliers:[{brand:'ABC',name:{bad:true}}]}))});

test('提醒品名只匹配品名，排除型号备注，品牌与品名同时限制',()=>{
 const d={...emptyData(),suppliers:[{brand:'ABC',aliases:'品牌甲',name:'供货商'}],rules:[{keyword:'轴承',message:'核对尺寸'}]};
 assert.equal(rowReminders({name:'滚动轴承',model:'A'},d).length,1);
 assert.equal(rowReminders({name:'配件',model:'轴承',note:'轴承'},d).length,0);
 d.rules=[{brand:'ABC',keyword:'轴承',message:'核对尺寸'}];
 assert.equal(rowReminders({brand:'品牌甲',name:'轴承'},d).length,1);
 assert.equal(rowReminders({brand:'其他',name:'轴承'},d).length,0);
 assert.equal(rowReminders({brand:'品牌甲',name:'配件'},d).length,0);
});
