import {test} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {destinationFor,companyProvince} from '../src/destination.mjs';
import {inquiry} from '../src/core.mjs';
import {sheetRows,mapColumns} from '../src/excel.mjs';
test('需求公司确定省份，兼容已有明细；未知或跨省不猜测',()=>{
 assert.equal(companyProvince('武汉吉利汽车部件有限公司'),'湖北省');
 assert.equal(companyProvince('吉利汽车（杭州）有限公司'),'浙江省');
 assert.equal(companyProvince('未知有限公司'),'');
 assert.equal(companyProvince('浙江某某武汉分公司'),'');
 assert.equal(destinationFor([{sourceExtra:[{header:'需求公司',value:'武汉吉利汽车部件有限公司'}]}]).province,'湖北省');
 assert.ok(destinationFor([{company:'武汉吉利汽车部件有限公司'},{company:'杭州某公司'}]).error);
 assert.ok(destinationFor([{}]).error);
});
test('每件产品仅占一个文本行，省份来自需求公司，保留专票税运要求',()=>{
 const row={company:'武汉吉利汽车部件有限公司',brand:'SKF',model:'001\n复杂规格',quantity:2,unit:'个'};
 const text=inquiry([row,{...row,model:'002'}]);
 assert.equal(text.split('\n').filter(l=>l.startsWith('【品牌】')).length,2);
 assert.ok(text.includes('【型号 / 规格】001 复杂规格；【数量】2 个'));
 assert.ok(text.includes('发往湖北省'));assert.ok(text.includes('含税含运费'));assert.ok(text.includes('13% 增值税专用发票'));assert.ok(!text.includes(row.company));
});
test('合并的需求公司单元格用于每条产品',()=>{
 const b=new ExcelJS.Workbook(),s=b.addWorksheet('采购');
 s.addRow(['需求公司','品牌','型号','数量']);s.addRow(['武汉吉利汽车部件有限公司','ABC','A',1]);s.addRow(['','ABC','B',2]);s.mergeCells('A2:A3');
 const rows=sheetRows(s,1,mapColumns(s,1));assert.equal(rows.length,2);assert.equal(destinationFor(rows).province,'湖北省');
});

test('手动公司省份覆盖名称识别并用于询价，删除后恢复推断',()=>{
 const companies=[{company:' 无地名（集团）有限公司 ',province:'广东省'},{company:'武汉吉利汽车部件有限公司',province:'浙江省'}];
 assert.equal(companyProvince('无地名(集团)有限公司',companies),'广东省');
 assert.equal(companyProvince('武汉吉利汽车部件有限公司',companies),'浙江省');
 assert.equal(companyProvince('武汉吉利汽车部件有限公司',[]),'湖北省');
 const rows=[{company:'无地名（集团）有限公司',model:'A',quantity:1}];
 assert.equal(destinationFor(rows,companies).province,'广东省');
 assert.match(inquiry(rows,companies),/发往广东省/);
 assert.ok(destinationFor([...rows,{company:'武汉吉利汽车部件有限公司'}],companies).error);
});

test('旧资料兼容，公司配置拒绝空名称、无效省份与归一化重复名称',async()=>{
 const {emptyData,validateData}=await import('../src/core.mjs');
 const old=emptyData();delete old.companies;assert.doesNotThrow(()=>validateData(old));
 for(const companies of [[{company:' ',province:'湖北省'}],[{company:'某公司',province:'不存在'}],[{company:'某（集团）',province:'湖北省'},{company:'某(集团)',province:'浙江省'}],{}])assert.throws(()=>validateData({...emptyData(),companies}));
 assert.doesNotThrow(()=>validateData({...emptyData(),companies:[{company:'某公司',province:'湖北省'}]}));
});
