import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inquiryRowKey,updateInquiryMarks,validateData,emptyData} from '../src/core.mjs';
const row={id:'1:2',sourceFile:'/a.xlsx',sourceSheet:'需求',sourceRow:2,company:'某公司',brand:'ABC',model:'001',quantity:'2'};
test('询价标记按文件、工作表、行位置与内容隔离，重新导入不依赖临时 id',()=>{
 const key=inquiryRowKey(row);assert.equal(inquiryRowKey({...row,id:'new'}),key);
 for(const changes of [{sourceFile:'/b.xlsx'},{sourceSheet:'另一表'},{sourceRow:3},{quantity:3},{company:'另一公司'},{model:'002'}])assert.notEqual(inquiryRowKey({...row,...changes}),key);
});
test('批量标记去重、撤销只影响目标行，兼容旧资料',()=>{
 const other={...row,sourceRow:3};const marks=updateInquiryMarks(undefined,[row,other,row],true);assert.equal(marks.length,2);
 assert.deepEqual(updateInquiryMarks(marks,[row],false),[inquiryRowKey(other)]);
 assert.doesNotThrow(()=>validateData({...emptyData(),inquiryMarks:marks}));
 const old=emptyData();delete old.inquiryMarks;assert.doesNotThrow(()=>validateData(old));
 assert.throws(()=>validateData({...emptyData(),inquiryMarks:[{}]}));
});
