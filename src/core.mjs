import {destinationFor} from './destination.mjs';
export const fields = {brand:'品牌',name:'品名',model:'型号',quantity:'数量',unit:'单位',note:'备注',price:'单价',materialCode:'物料编码',company:'需求公司'};
export const normalize = v => String(v ?? '').normalize('NFKC').trim().toLowerCase();
export const clean = v => String(v ?? '').replace(/[\r\n\t]+/g,' ').trim();
export function validDate(v) {if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;}
export const today = () => new Date().toLocaleDateString('sv-SE');
export function canonical(brand, suppliers) {
 const n=normalize(brand); const hits=new Set(suppliers.filter(s=>[s.brand,...String(s.aliases||'').split(/[|，,]/)].some(b=>normalize(b)===n && n)).map(s=>normalize(s.brand)));
 return hits.size===1?[...hits][0]:n;
}
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
export function reminders(row,data,stage) {return data.rules.filter(r=>(!r.stage||r.stage==='全部'||r.stage===stage)&&(!r.brand||canonical(r.brand,data.suppliers)===canonical(row.brand,data.suppliers))&&(!r.keyword||normalize(`${row.name} ${row.model} ${row.note}`).includes(normalize(r.keyword)))&&(!r.noSupplier||!suppliersFor(row,data.suppliers).length));}
export function inquiry(rows) {
 const {province}=destinationFor(rows);
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
export const emptyData=()=>({suppliers:[],prices:[],channels:[],rules:[]});
export function validateData(d) {
 if(!d||typeof d!=='object') throw Error('资料必须是对象');
 for(const key of ['suppliers','prices','channels','rules']) if(!Array.isArray(d[key])||d[key].some(x=>!x||typeof x!=='object'||Array.isArray(x))) throw Error(`${key} 必须是记录列表`);
 for(const key of ['suppliers','prices','channels','rules']) for(const record of d[key]) for(const [field,value] of Object.entries(record)) if(value!==null&&!['string','number','boolean'].includes(typeof value)) throw Error(`${key}.${field} 必须是文本、数字或布尔值`);
 for(const s of d.suppliers){if(!String(s.brand||'').trim())throw Error('供货商资料必须填写品牌');if(s.url&&!safeUrl(s.url))throw Error('供货商店铺网址必须是有效的 http 或 https 链接');}
 for(const p of d.prices) if(!p.brand||!p.model||!p.unit||p.price===''||!Number.isFinite(Number(p.price))||Number(p.price)<0) throw Error('价格必须填写品牌、型号、单位和非负单价');
 for(const c of d.channels) if(!c.brand||!safeUrl(c.url)||!c.source||!safeUrl(c.source)||!validDate(c.checkedAt)) throw Error('渠道必须填写品牌、有效网址、核实来源网址和核实日期');
 for(const r of d.rules) if(!r.message||!['全部','导入','询价','回填','导出'].includes(r.stage||'全部')) throw Error('提醒必须填写内容和有效场景');
 return d;
}

export function channelTargets(rows,suppliers){const targets=new Map();for(const row of rows){if(suppliersFor(row,suppliers).length)continue;const generic=isGenericBrand(row.brand),query=generic?[row.name,row.model].filter(Boolean).join(' '):row.brand;if(!query)continue;const key=(generic?'item:':'brand:')+query;targets.set(key,{key,query,generic,label:generic?row.name||row.model:row.brand});}return [...targets.values()];}
