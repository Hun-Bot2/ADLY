// Node-only, immutable company metadata. Never writes learner or catalog data.
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {trustedConcepts,canonicalKey} from './related.mjs';
import {practiceObservations,fitLeetCode,predict} from './calibration.mjs';
import {SOLVED_OUTCOMES} from './ledger.mjs';
export const COMPANY_WINDOWS=['30d','3m','6m','gt6m','all'];
export const COMPANY_UNAVAILABLE='company data not available for this catalog version';
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
export function attachCompanyLayer(sqlite,root,catalog){
  if(sqlite.prepare('PRAGMA database_list').all().some(r=>r.name==='company'))sqlite.exec('DETACH DATABASE company');
  if(!root||!existsSync(root))return {available:false,reason:COMPANY_UNAVAILABLE};
  const versions=readdirSync(root).filter(n=>/^company-v\d+$/.test(n)).sort((a,b)=>Number(b.slice(9))-Number(a.slice(9)));
  for(const version of versions){
    const dir=resolve(root,version),receiptPath=join(dir,'receipt.json');
    if(!existsSync(receiptPath))continue;
    const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
    if(receipt.catalog_version!==catalog.version)continue;
    const file=join(dir,`${version}.sqlite3`),sha256=hash(file);
    if(sha256!==receipt.output_sha256)throw new Error('company hash does not match its receipt');
    if(receipt.version!==version)throw new Error('company version mismatch');
    if(catalog.sha256&&catalog.sha256!==receipt.catalog_sha256)throw new Error('company catalog hash mismatch');
    sqlite.exec(`ATTACH DATABASE '${pathToFileURL(file).href.replace(/'/g,"''")}?mode=ro&immutable=1' AS company`);
    const layer=loadCompanyLists(sqlite);
    if(layer.meta.catalog_version!==catalog.version||layer.version!==version||layer.meta.catalog_sha256!==receipt.catalog_sha256){sqlite.exec('DETACH DATABASE company');throw new Error('company metadata mismatch');}
    return {...layer,available:true,sha256};
  }
  return {available:false,reason:COMPANY_UNAVAILABLE};
}
export function loadCompanyLists(sqlite){
  const meta=Object.fromEntries(sqlite.prepare('SELECT key,value FROM company.company_meta').all().map(r=>[r.key,r.value]));
  const companies=sqlite.prepare('SELECT company_id,name FROM company.companies ORDER BY name,company_id').all().map(r=>({...r}));
  const lists=new Map(companies.map(c=>[c.company_id,new Map(COMPANY_WINDOWS.map(w=>[w,[]]))]));
  for(const row of sqlite.prepare('SELECT company_id,window,problem_key,rank,frequency FROM company.company_problems ORDER BY company_id,window,rank,problem_key').all())lists.get(row.company_id)?.get(row.window)?.push({problem_key:row.problem_key,rank:row.rank,frequency:row.frequency});
  const unmatched=new Map();
  for(const r of sqlite.prepare('SELECT company_id,window,count(*) AS n FROM company.company_unmatched GROUP BY company_id,window').all())unmatched.set(`${r.company_id}|${r.window}`,r.n);
  return {available:true,version:meta.version,meta,companies,lists,unmatched};
}
export function validateCompanyFocus(focus,layer){
  if(focus===null||focus===undefined)return null;
  if(!focus||Object.keys(focus).sort().join('|')!=='company_id|fill_from_general|window'||typeof focus.company_id!=='string'||!COMPANY_WINDOWS.includes(focus.window)||typeof focus.fill_from_general!=='boolean')throw new Error('invalid company focus');
  if(!layer?.available)throw new Error(COMPANY_UNAVAILABLE);
  if(!layer.lists.has(focus.company_id))throw new Error('unknown company');
  return {...focus};
}
export function companyScope(layer,focus){
  if(!focus||!layer?.available)return null;
  validateCompanyFocus(focus,layer);
  return {kind:'company',...focus,list:layer.lists.get(focus.company_id).get(focus.window),layer_version:layer.version,layer_sha256:layer.sha256,upstream_commit_date:layer.meta.commit_date,company_name:layer.companies.find(c=>c.company_id===focus.company_id).name};
}
export function companySummary(layer,catalog,attempts=[],{companyId=null,window='all'}={}){
  if(!layer?.available)return {available:false,reason:COMPANY_UNAVAILABLE};
  if(!COMPANY_WINDOWS.includes(window))throw new Error('invalid company window');
  const attempted=new Set(attempts.map(a=>canonicalKey(catalog,a.problem_key))),solved=new Set(attempts.filter(a=>SOLVED_OUTCOMES.has(a.outcome)).map(a=>canonicalKey(catalog,a.problem_key)));
  const ability=fitLeetCode(practiceObservations(attempts,catalog,'leetcode'));
  const catalogLeetcodeCount=[...catalog.problems.values()].filter(p=>p.platform==='leetcode').length;
  const companies=layer.companies.filter(c=>!companyId||c.company_id===companyId).map(company=>{
    const windows=Object.fromEntries(COMPANY_WINDOWS.map(w=>{const list=layer.lists.get(company.company_id).get(w);return [w,{matched:list.length,catalog_count:catalogLeetcodeCount,catalog_share:catalogLeetcodeCount?list.length/catalogLeetcodeCount:null,unmatched:layer.unmatched?.get(`${company.company_id}|${w}`)??0,small_list:list.length<10}];}));
    const rows=layer.lists.get(company.company_id).get(window).map(row=>({...row,problem:catalog.problems.get(row.problem_key)})).filter(r=>r.problem);
    const levels=Object.fromEntries([1,2,3].map(level=>{const items=rows.filter(r=>r.problem.difficulty_value===level),fresh=items.filter(r=>!attempted.has(r.problem_key));return [level,{matched:items.length,attempted:items.filter(r=>attempted.has(r.problem_key)).length,solved:items.filter(r=>solved.has(r.problem_key)).length,unattempted:fresh.length,estimated_solve_probability:fresh.length?predict(fresh[0].problem,{leetcode:ability}).p_mean:null,estimate_label:'uncalibrated estimate'}];}));
    const concepts=new Map();for(const r of rows)for(const c of trustedConcepts(r.problem)){if(!concepts.has(c))concepts.set(c,{concept:c,total:0,attempted:0,solved:0});const x=concepts.get(c);x.total++;x.attempted+=Number(attempted.has(r.problem_key));x.solved+=Number(solved.has(r.problem_key));}
    return {...company,windows,window,levels,concepts:[...concepts.values()].sort((a,b)=>a.concept.localeCompare(b.concept)),...(companyId?{problems:rows.map(({problem,...r})=>({...r,title:problem.title,url:problem.url,difficulty:problem.difficulty_value,attempted:attempted.has(r.problem_key),solved:solved.has(r.problem_key)}))}:{})};
  });
  if(companyId&&!companies.length)throw new Error('unknown company');
  return {available:true,version:layer.version,sha256:layer.sha256,meta:layer.meta,companies,provenance:'Company list membership does not mean the problem will be asked.',match_rate_label:'카탈로그 문제 중 회사 목록에 포함된 비율'};
}
