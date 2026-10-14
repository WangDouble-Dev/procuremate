import {destinationFor,provinceOptions,normalizeCompany} from './destination.mjs';
export const fields = {brand:'品牌',name:'品名',model:'型号',quantity:'数量',unit:'单位',note:'备注',price:'单价',company:'需求公司'};
export const normalize = v => String(v ?? '').normalize('NFKC').trim().toLowerCase();
export const clean = v => String(v ?? '').replace(/[\r\n\t]+/g,' ').trim();
export function validDate(v) {if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;}
export const today = () => new Date().toLocaleDateString('sv-SE');
const brandIndexes=new WeakMap();
function brandIndex(suppliers){
 if(brandIndexes.has(suppliers))return brandIndexes.get(suppliers);
 const names=new Map(),groups=new Map();
 for(const s of suppliers){const brand=normalize(s.brand);for(const value of [s.brand,...String(s.aliases||'').split(/[|，,]/)]){const key=normalize(value);if(!key)continue;if(!names.has(key))names.set(key,new Set());names.get(key).add(brand);}}
 const canonicalName=value=>{const key=normalize(value),hits=names.get(key);return hits?.size===1?hits.values().next().value:key;};
 for(const s of suppliers){const key=canonicalName(s.brand);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s.brand,s.aliases||'');}
 const result={canonicalName,text:new Map([...groups].map(([key,values])=>[key,values.join(' ')]))};brandIndexes.set(suppliers,result);return result;
}
export function canonical(brand,suppliers){return brandIndex(suppliers).canonicalName(brand);}
export function isGenericBrand(brand) {return ['', '不限','不限品牌','品牌不限','市场件','其他','其它','无品牌','通用'].includes(normalize(brand));}
export function suppliersFor(row, suppliers) {if(isGenericBrand(row.brand))return [];const b=canonical(row.brand,suppliers); return b?suppliers.filter(s=>normalize(s.brand)===b&&[s.name,s.contact,s.wechat,s.phone,s.url].some(v=>String(v||'').trim())):[];}
export function quoteFor(row, data, date=today()) {
 if(isGenericBrand(row.brand))return {reason:'未指定具体品牌，请人工确认报价'};
 if(!row.brand||!row.model||!row.unit) return {reason:'缺少品牌、型号或单位'};
 const candidates=data.prices.filter(p=>canonical(p.brand,data.suppliers)===canonical(row.brand,data.suppliers)&&normalize(p.model)===normalize(row.model)&&normalize(p.unit)===normalize(row.unit));
 const valid=candidates.filter(p=>validDate(p.validUntil)&&p.validUntil>=date&&(!p.validFrom||(validDate(p.validFrom)&&p.validFrom<=date))&&p.price!==''&&Number.isFinite(Number(p.price))&&Number(p.price)>=0&&['含税','未税'].includes(p.tax)&&(!row.taxBasis||p.tax===row.taxBasis)&&(!row.currencyBasis||normalize(p.currency)===normalize(row.currencyBasis))&&p.currency&&p.supplier&&p.freight&&Number(row.quantity)>0&&Number(row.quantity)>=Number(p.minQty||1));
 if(valid.length===1) return {quote:valid[0],reason:'可回填'};
 return {reason:valid.length>1?'多个有效报价，请先整理价格表':candidates.length?'报价过期、税务口径/币种/起订量不符或计价条件不完整':'无匹配价格'};
}
export function reminders(row,data) {return data.rules.filter(r=>(!r.brand||canonical(r.brand,data.suppliers)===canonical(row.brand,data.suppliers))&&(!normalize(r.keyword)||normalize(row.name).includes(normalize(r.keyword)))&&(!r.noSupplier||!suppliersFor(row,data.suppliers).length));}
export function inquiry(rows,companies=[]) {
 const {province}=destinationFor(rows,companies);
 const items=rows.map(r=>[
  `【品牌】${clean(r.brand)||'待确认'}`,
  `【品名】${clean(r.name)||'—'}`,
  `【型号 / 规格】${clean(r.model)||'待确认'}`,
  `【数量】${[clean(r.quantity)||'待确认',clean(r.unit)].filter(Boolean).join(' ')}`,
 ].join('；'));
 return '您好，请帮忙报价以下产品：\n'+items.join('\n──────────\n')+`\n发往${clean(province)||'（需求公司所在地待确认）'}。\n报价请含税含运费，并支持开具 13% 增值税专用发票。`;
}
export function searchLinks(brand, generic=false) {const q=encodeURIComponent(clean(brand)); return [{name:'淘宝搜索',url:`https://s.taobao.com/search?q=${q}`},{name:'京东搜索',url:`https://search.jd.com/Search?keyword=${q}`},{name:'1688 搜索',url:`https://s.1688.com/selloffer/offer_search.htm?keywords=${q}`},{name:generic?'查找供货渠道':'查找官网',url:`https://www.bing.com/search?q=${encodeURIComponent(clean(brand)+(generic?' 供应商 联系方式':' 官方网站 官方直营 联系方式'))}`} ];}
export function safeUrl(value) {try {let u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export const emptyData=()=>({suppliers:[],prices:[],channels:[],rules:[],companies:[],inquiryMarks:[]});
export function validateData(d) {
 if(!d||typeof d!=='object') throw Error('资料必须是对象');
 if(d.inquiryMarks!==undefined&&(!Array.isArray(d.inquiryMarks)||d.inquiryMarks.some(k=>typeof k!=='string'||!k)))throw Error('询价标记必须是有效记录列表');
 for(const key of ['suppliers','prices','channels','rules']) if(!Array.isArray(d[key])||d[key].some(x=>!x||typeof x!=='object'||Array.isArray(x))) throw Error(`${key} 必须是记录列表`);
 for(const key of ['suppliers','prices','channels','rules']) for(const record of d[key]) for(const [field,value] of Object.entries(record)) if(value!==null&&!['string','number','boolean'].includes(typeof value)) throw Error(`${key}.${field} 必须是文本、数字或布尔值`);
 if(d.companies!==undefined){
  if(!Array.isArray(d.companies))throw Error('公司省份必须是记录列表');
  const names=new Set();
  for(const c of d.companies){
   if(!c||typeof c.company!=='string'||!normalizeCompany(c.company))throw Error('公司省份必须填写需求公司');
   if(!provinceOptions.includes(c.province))throw Error('请选择有效的发往省份');
   const name=normalizeCompany(c.company);if(names.has(name))throw Error('同一需求公司只能配置一条省份记录，请编辑已有记录');names.add(name);
   for(const value of Object.values(c))if(value!==null&&!['string','number','boolean'].includes(typeof value))throw Error('公司省份字段必须是文本、数字或布尔值');
  }
 }
 for(const s of d.suppliers){if(!String(s.brand||'').trim())throw Error('供货商资料必须填写品牌');if(s.url&&!safeUrl(s.url))throw Error('供货商店铺网址必须是有效的 http 或 https 链接');}
 for(const p of d.prices) if(!p.brand||!p.model||!p.unit||p.price===''||!Number.isFinite(Number(p.price))||Number(p.price)<0) throw Error('价格必须填写品牌、型号、单位和非负单价');
 for(const c of d.channels) if(!c.brand||!safeUrl(c.url)||!c.source||!safeUrl(c.source)||!validDate(c.checkedAt)) throw Error('渠道必须填写品牌、有效网址、核实来源网址和核实日期');
 for(const r of d.rules) if(!r.message) throw Error('提醒必须填写内容');
 return d;
}

export function channelTargets(rows,suppliers){const targets=new Map();for(const row of rows){if(suppliersFor(row,suppliers).length)continue;const generic=isGenericBrand(row.brand),query=generic?[row.name,row.model].filter(Boolean).join(' '):row.brand;if(!query)continue;const key=(generic?'item:':'brand:')+query;targets.set(key,{key,query,generic,label:generic?row.name||row.model:row.brand});}return [...targets.values()];}

export function brandSearchText(brand,suppliers){const index=brandIndex(suppliers);return `${brand||''} ${index.text.get(index.canonicalName(brand))||''}`;}
export function matchesPurchase(row,query,suppliers){const q=normalize(query);return !q||normalize(`${brandSearchText(row.brand,suppliers)} ${row.name||''} ${row.model||''}`).includes(q);}
export function matchesReference(record,query,suppliers){const q=normalize(query);return !q||normalize(`${Object.values(record).join(' ')} ${brandSearchText(record.brand,suppliers)}`).includes(q);}
export function rowReminders(row,data){return data.rules.filter(rule=>(rule.brand||normalize(rule.keyword))&&reminders(row,{...data,rules:[rule]}).length);}

// A changed row or a row from another file must not inherit an inquiry mark.
export function inquiryRowKey(row){return JSON.stringify([row.sourceFile||'',row.sourceSheet||'',row.sourceRow??row.id,...Object.keys(fields).map(k=>String(row[k]??'')),row.sourceExtra||[]]);}
export function updateInquiryMarks(marks,rows,done){const next=new Set(marks||[]);for(const row of rows){const key=inquiryRowKey(row);if(done)next.add(key);else next.delete(key);}return [...next];}
