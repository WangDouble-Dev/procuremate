import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {fields,safeUrl,normalize} from './core.mjs';

export function cellText(c) {
 if(c.isMerged && c.master.address!==c.address) return '';
 const v=c.value;
 if(v==null)return '';
 if(c._importText!==undefined)return c._importText;
 if(typeof v==='object'){
  if(v instanceof Date)return v.toISOString().slice(0,10);
  if('formula'in v||'sharedFormula'in v)return v.result==null?'':String(v.result);
  if(v.richText)return v.richText.map(x=>x.text).join('');
  if(v.text)return v.text;
 }
 if(typeof v==='number'&&c.numFmt&&/^0+$/.test(c.numFmt))return String(v).padStart(c.numFmt.length,'0');
 return String(v);
}

export async function readBook(buffer) {
 const bytes=buffer instanceof ArrayBuffer?new Uint8Array(buffer):new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);
 const b=new ExcelJS.Workbook();
 if(bytes[0]===0x50 && bytes[1]===0x4b){await b.xlsx.load(buffer);return b;}
 if(![0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((v,i)=>bytes[i]===v))throw Error('无法识别文件格式，请选择有效的 .xls 或 .xlsx 文件');
 const legacy=XLSX.read(bytes,{type:'array',cellText:true,cellNF:true,cellDates:false});
 for(const name of legacy.SheetNames){
  const source=legacy.Sheets[name],s=b.addWorksheet(name);
  for(const [address,c]of Object.entries(source)){
   if(address.startsWith('!')||!c||c.v==null)continue;
   const target=s.getCell(address);
   target.value=c.v;
   if(c.z)target.numFmt=c.z;
   target._importText=c.w??String(c.v);
  }
  for(const merge of source['!merges']||[])s.mergeCells(merge.s.r+1,merge.s.c+1,merge.e.r+1,merge.e.c+1);
 }
 return b;
}

const aliases={
 brand:['品牌','厂家品牌','制造商品牌'],name:['品名','产品名称','物料名称','物资名称','商品名称'],
 model:['型号','规格型号','规格/型号','产品型号','规格'],quantity:['数量','需求数量','采购数量','需求量'],
 unit:['单位','计量单位'],note:['备注','说明'],price:['单价','采购价','含税单价','含税单价(元)','含税单价（元）','未税单价','未税单价(元)','不含税单价'],
 materialCode:['物料编码','物料代码','物资编码'],company:['需求公司','需求单位','采购公司']
};
const headerKey=v=>String(v??'').normalize('NFKC').replace(/[\s*＊]/g,'').toLowerCase();
export function mapColumns(sheet,headerRow){
 const mapping={};
 sheet.getRow(headerRow).eachCell((cell,col)=>{
  const text=headerKey(cellText(cell));
  for(const [key,label]of Object.entries(fields))if([key,label,...(aliases[key]||[])].some(a=>headerKey(a)===text)&&!mapping[key])mapping[key]=col;
 });
 return mapping;
}
export function detectHeader(sheet){
 let best={headerRow:1,mapping:{},score:0};
 for(let n=1;n<=Math.min(sheet.rowCount,30);n++){
  const mapping=mapColumns(sheet,n),score=Object.keys(mapping).length;
  if(score>best.score)best={headerRow:n,mapping,score};
 }
 return best;
}
export function sheetRows(sheet,headerRow,mapping){
 const out=[],mapped=new Set(Object.values(mapping).filter(Boolean).map(Number));
 const extraColumns=[];
 sheet.getRow(headerRow).eachCell((c,col)=>{if(!mapped.has(col)&&cellText(c))extraColumns.push({col,header:cellText(c)});});
 const priceLabel=mapping.price?headerKey(cellText(sheet.getRow(headerRow).getCell(Number(mapping.price)))):'';
 const currencyBasis=/\(元\)|人民币|cny|rmb/.test(priceLabel)?'CNY':'';
 const taxBasis=/未税|不含税/.test(priceLabel)?'未税':/含税/.test(priceLabel)?'含税':'';
 for(let n=headerRow+1;n<=sheet.rowCount;n++){
  const r={id:`${sheet.id}:${n}`,sourceRow:n,sourceSheet:sheet.name,taxBasis,currencyBasis};
  for(const k of Object.keys(fields))r[k]=mapping[k]?cellText(k==='company'?sheet.getRow(n).getCell(Number(mapping[k])).master:sheet.getRow(n).getCell(Number(mapping[k]))):'';
  if(![r.brand,r.name,r.model,r.quantity].some(Boolean))continue;
  r.sourceExtra=extraColumns.map(({col,header})=>({col,header,value:cellText(sheet.getRow(n).getCell(col))}));
  out.push(r);
 }
 return out;
}
export async function exportBook(rows){
 const b=new ExcelJS.Workbook(),s=b.addWorksheet('采购明细');
 const extras=new Map();for(const r of rows)for(const e of r.sourceExtra||[])extras.set(`${e.col}:${e.header}`,e.header);
 const columns=[...Object.entries(fields).map(([key,header])=>({key,header,width:key==='note'?30:20})),{key:'supplier',header:'合作供货商',width:25},{key:'contact',header:'联系方式',width:30},{key:'basis',header:'价格条件与来源',width:55},...Array.from(extras,([key,header])=>({key:'extra:'+key,header,width:25}))];
 if(rows.length&&rows.every(r=>r.taxBasis==='含税'))columns.find(c=>c.key==='price').header='含税单价';
 if(rows.length&&rows.every(r=>r.taxBasis==='未税'))columns.find(c=>c.key==='price').header='未税单价';
 s.columns=columns;
 for(const r of rows){
  const data={...r};for(const e of r.sourceExtra||[])data['extra:'+`${e.col}:${e.header}`]=e.value;
  const x=s.addRow(data);if(r.supplier)x.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE6F3ED'}});
 }
 s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF215E52'}});s.views=[{state:'frozen',ySplit:1}];s.autoFilter={from:{row:1,column:1},to:{row:1,column:columns.length}};
 return b.xlsx.writeBuffer();
}
export async function catalogBook(schema,records=[]){const b=new ExcelJS.Workbook();const s=b.addWorksheet('资料');s.columns=Object.entries(schema).map(([key,header])=>({key,header,width:25}));for(const r of records)s.addRow(r);s.getRow(1).font={bold:true};return b.xlsx.writeBuffer();}
export async function importCatalog(buffer,schema){if('wechat' in schema && 'brand' in schema)return importSuppliers(buffer,schema);const b=await readBook(buffer);const s=b.worksheets[0];if(!s)throw Error('文件没有工作表');const mapping={};s.getRow(1).eachCell((c,n)=>{for(const [k,label]of Object.entries(schema))if([k,label,...(k==='keyword'?['品名 / 型号 / 备注关键词']:[])].includes(cellText(c).trim()))mapping[k]=n;});if(!Object.keys(mapping).length)throw Error('未识别表头，请下载 Excel 模板后填写');const records=[];for(let n=2;n<=s.rowCount;n++){const r={};for(const [k,col]of Object.entries(mapping))r[k]=cellText(s.getRow(n).getCell(col));if(Object.values(r).some(Boolean))records.push(r);}return records;}

export async function importSuppliers(buffer,schema){
 const b=await readBook(buffer);let found;
 const aliases={brand:['品牌名称'],aliases:['品牌别名','别名'],name:['供应商名称','供货商','供应商'],contact:['联系人姓名'],wechat:['微信号'],phone:['联系电话','手机号'],url:['店铺链接','店铺网址','网址','链接'],note:['备注','说明']};
 for(const sheet of b.worksheets){for(let row=1;row<=Math.min(30,sheet.rowCount);row++){
  const mapping={};sheet.getRow(row).eachCell((cell,col)=>{const h=headerKey(cellText(cell));for(const [key,label] of Object.entries(schema))if([key,label,...(aliases[key]||[])].some(x=>headerKey(x)===h))mapping[key]=col;});
  if(mapping.brand&&Object.keys(mapping).length>=2){found={sheet,row,mapping};break;}
 }if(found)break;}
 if(!found)throw Error('未识别供货商表头，请包含品牌、供货商名称或联系人等列');
 const {sheet,row,mapping}=found,records=[];
 for(let n=row+1;n<=sheet.rowCount;n++){
  const r={};for(const [k,col] of Object.entries(mapping)){const cell=sheet.getRow(n).getCell(col);r[k]=cellText(k==='brand'?cell.master:cell).trim();}
  if(!Object.values(r).some(Boolean))continue;
  if(!r.brand)throw Error(`供货商表第 ${n} 行缺少品牌，请补充后导入`);
  r.aliases=String(r.aliases||'').split(/[|｜,，;；\n]/).map(x=>x.trim()).filter(Boolean).join('|');
  const links=new Set();if(r.url){if(!safeUrl(r.url))throw Error(`供货商表第 ${n} 行店铺网址无效`);links.add(r.url);}
  for(const col of Object.values(mapping)){const cell=sheet.getRow(n).getCell(col),v=cell.value;const link=cell.hyperlink||(v&&typeof v==='object'?v.hyperlink:null);if(link&&safeUrl(link))links.add(link);}
  if(links.size>1)throw Error(`供货商表第 ${n} 行包含多个不同链接，请拆成多条供货商记录`);
  if(links.size)r.url=[...links][0];
  records.push(r);
 }
 // Explicit aliases identify repeated Chinese/English brand entries in this catalog.
 const owners=new Map();for(const r of records)for(const a of r.aliases.split('|').filter(Boolean)){const key=normalize(a);if(!owners.has(key))owners.set(key,new Set());owners.get(key).add(r.brand);}
 for(const r of records){const candidates=owners.get(normalize(r.brand));if(candidates?.size===1){const owner=[...candidates][0];if(normalize(owner)!==normalize(r.brand)&&!owners.has(normalize(owner)))r.brand=owner;}}
 const unique=new Map();for(const r of records){const key=JSON.stringify(Object.keys(schema).map(k=>k==='aliases'?'':k==='brand'?normalize(r[k]):String(r[k]||'').trim()));if(unique.has(key)){const prior=unique.get(key);prior.aliases=[...new Set([...prior.aliases.split('|'),...r.aliases.split('|')].filter(Boolean))].join('|');}else unique.set(key,r);}
 return [...unique.values()];
}
