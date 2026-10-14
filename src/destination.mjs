// Verified company location: https://jxj.wuhan.gov.cn/zxzj/zxzj_xmgs/202410/P020241031455557935004.pdf
const knownCompanies={'武汉吉利汽车部件有限公司':'湖北省'};
const regions={
 '北京市':'北京','天津市':'天津','上海市':'上海','重庆市':'重庆',
 '河北省':'河北|石家庄|唐山|保定|张家口','山西省':'山西|太原|晋中','辽宁省':'辽宁|沈阳|大连','吉林省':'吉林|长春','黑龙江省':'黑龙江|哈尔滨|大庆',
 '江苏省':'江苏|南京|苏州|无锡|常州|徐州|南通|盐城','浙江省':'浙江|杭州|宁波|温州|台州|金华|义乌|嘉兴|绍兴|湖州',
 '安徽省':'安徽|合肥|芜湖|马鞍山','福建省':'福建|福州|厦门|泉州','江西省':'江西|南昌|上饶|赣州','山东省':'山东|济南|青岛|济宁|烟台|淄博|潍坊',
 '河南省':'河南|郑州|洛阳|开封','湖北省':'湖北|武汉|襄阳|宜昌|十堰|荆门','湖南省':'湖南|长沙|湘潭|株洲',
 '广东省':'广东|广州|深圳|佛山|东莞|珠海|惠州','海南省':'海南|海口|三亚','四川省':'四川|成都|绵阳|南充|宜宾',
 '贵州省':'贵州|贵阳','云南省':'云南|昆明','陕西省':'陕西|西安|宝鸡|咸阳','甘肃省':'甘肃|兰州','青海省':'青海|西宁',
 '内蒙古自治区':'内蒙古|呼和浩特|包头','广西壮族自治区':'广西|南宁|柳州|桂林','西藏自治区':'西藏|拉萨','宁夏回族自治区':'宁夏|银川','新疆维吾尔自治区':'新疆|乌鲁木齐',
 '香港特别行政区':'香港','澳门特别行政区':'澳门','台湾省':'台湾|台北'
};
export const provinceOptions=Object.keys(regions);
export const normalizeCompany=value=>String(value||'').normalize('NFKC').replace(/\s/g,'');
export function demandCompany(row){return String(row.company||row.sourceExtra?.find(e=>['需求公司','需求单位','采购公司'].includes(String(e.header).trim()))?.value||'').trim();}
export function companyProvince(value,companies=[]){
 const name=normalizeCompany(value);
 const configured=companies.filter(c=>normalizeCompany(c.company)===name);
 if(configured.length){const values=new Set(configured.map(c=>c.province));return values.size===1&&provinceOptions.includes(configured[0].province)?configured[0].province:'';}
 if(knownCompanies[name])return knownCompanies[name];
 const hits=new Set();
 for(const [province,places] of Object.entries(regions))for(const place of places.split('|')){
  if(name.startsWith(place)||name.includes('('+place+')')||name.includes('('+place+'市)')||name.includes(place+'分公司')||name.includes(place+'市分公司'))hits.add(province);
 }
 return hits.size===1?[...hits][0]:'';
}
export function destinationFor(rows,companies=[]){
 if(!rows.length)return {province:'',error:''};
 const provinces=new Set();
 for(const row of rows){const company=demandCompany(row);if(!company)return {province:'',error:'所选明细缺少需求公司，请检查 Excel 的需求公司列。'};const province=companyProvince(company,companies);if(!province)return {province:'',error:`暂时无法确定「${company}」所在省份，请在“公司省份”中配置发往省份。`};provinces.add(province);}
 if(provinces.size>1)return {province:'',error:'所选需求公司涉及多个省份，请按省份分批选择询价。'};
 return {province:[...provinces][0],error:''};
}
