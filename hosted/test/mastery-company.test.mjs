import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {attachCompanyLayer,companyScope,companySummary,validateCompanyFocus} from '../mastery/company.mjs';
import {catalogFromData} from '../mastery/catalog.mjs';
import {normalizeMastery} from '../core/preferences.mjs';
import {planProgressionV2} from '../mastery/progression-v2.mjs';
import {candidatePool,companyMockContest,snapshotExposures} from '../mastery/mock-contest.mjs';
const p=(key,level=1,concepts=['a'])=>({key:'leetcode:'+key,platform:'leetcode',title:key,url:'https://example.invalid/'+key,difficulty_kind:'lc_level',difficulty_value:level,tags:['tag-'+key],concepts:concepts.map(id=>({id,status:'approved'}))});
const catalog=catalogFromData({problems:[p('pure'),p('ranked',1,['a','b']),p('medium',2),p('hard',3)]});
const scope={kind:'company',company_id:'example',company_name:'Example',window:'all',layer_version:'company-v1',layer_sha256:'abc',upstream_commit_date:'2026-01-01',fill_from_general:false,list:[{problem_key:'leetcode:pure',rank:5},{problem_key:'leetcode:ranked',rank:1},{problem_key:'leetcode:medium',rank:2}]};
const args={date:'2026-10-29',ledger:{attempts:[]},catalog,prerequisites:{}};
test('company scope limits pool, removes transfers and ranks before purity',()=>{
 const out=planProgressionV2({...args,scope});
 assert.equal(out.next.problem_key,'leetcode:ranked');
 assert.equal(out.next.company_rank,1);assert.equal(out.next.scope_match,true);
 assert.equal(out.next.weights.company_share,0.3);
 assert.ok(out.next.components.company_share>0);
 assert.equal(out.next.scope.layer_version,'company-v1');
 assert.deepEqual(planProgressionV2(args),planProgressionV2({...args,scope:null}));
 const empty=planProgressionV2({...args,scope:{...scope,list:[]}});
 assert.equal(empty.next,null);assert.equal(empty.status,'insufficient_company_coverage');
 const fill=planProgressionV2({...args,scope:{...scope,list:[],fill_from_general:true}});
 assert.equal(fill.next.scope_match,false);assert.equal(fill.next.scope_label,'not in Example list');
 assert.equal(fill.next.coverage[fill.next.action],'insufficient_company_coverage');
});
test('company mock restricts candidates, defaults to two problems/45 minutes and counts as exposure',()=>{
 const result=companyMockContest({catalog,attempts:[],exposures:[],weakConcepts:[],learnerId:'fixture',date:args.date,mastery:{cooldown_days:30},scope});
 assert.equal(result.kind,'company_mock');assert.equal(result.duration_minutes,45);assert.equal(result.problems.length,2);
 assert.ok(result.problems.every(p=>scope.list.some(r=>r.problem_key===p.problem_key)));
 assert.deepEqual(snapshotExposures([{kind:'company_mock',local_date:args.date,payload:result}])[0].problem_keys,result.problems.map(p=>p.problem_key));
 const pool=candidatePool({catalog,date:args.date,cooldownDays:30,restrictTo:['leetcode:medium']});
 assert.deepEqual(pool.sizes,{1:0,2:1,3:0});
});
test('company focus additive validation keeps existing preferences unchanged',()=>{
 assert.equal(Object.hasOwn(normalizeMastery({}),'company_focus'),false);
 const focus={company_id:'example',window:'all',fill_from_general:true};
 assert.deepEqual(normalizeMastery({company_focus:focus}).company_focus,focus);
 assert.throws(()=>normalizeMastery({company_focus:{...focus,window:'unknown'}}));
 assert.throws(()=>validateCompanyFocus(focus,{available:false}));
});
test('loader selects newest compatible version and verifies read-only attachment with special paths',()=>{
 const root=mkdtempSync(join(tmpdir(),'company 한 # % '));const main=new DatabaseSync(':memory:');
 try{
  for(const [version,cat] of [['company-v2','catalog-test'],['company-v10','other']]){
   const dir=join(root,version);mkdirSync(dir);const path=join(dir,version+'.sqlite3');const db=new DatabaseSync(path);
   db.exec("CREATE TABLE company_meta(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE companies(company_id,name);CREATE TABLE company_problems(company_id,window,problem_key,rank,frequency);CREATE TABLE company_unmatched(company_id,window,slug,rank);");
   for(const [k,v] of Object.entries({version,catalog_version:cat,catalog_sha256:'catalog-hash',commit_date:'2026-01-01'}))db.prepare('INSERT INTO company_meta VALUES (?,?)').run(k,v);
   db.exec("INSERT INTO companies VALUES ('example','Example');INSERT INTO company_problems VALUES ('example','all','leetcode:pure',1,10);INSERT INTO company_unmatched VALUES ('example','all','absent',2);");db.close();
   const output_sha256=createHash('sha256').update(readFileSync(path)).digest('hex');
   writeFileSync(join(dir,'receipt.json'),JSON.stringify({version,catalog_version:cat,catalog_sha256:'catalog-hash',output_sha256}));
  }
  const layer=attachCompanyLayer(main,root,catalog);assert.equal(layer.version,'company-v2');
  assert.throws(()=>main.exec("INSERT INTO company.companies VALUES ('bad','Bad')"),/readonly/);
  const focus={company_id:'example',window:'all',fill_from_general:false};
  assert.equal(companyScope(layer,focus).list.length,1);
  const summary=companySummary(layer,catalog,[],{companyId:'example'});assert.equal(summary.companies[0].windows.all.unmatched,1);
  assert.equal(summary.companies[0].levels[1].matched,1);
  assert.throws(()=>validateCompanyFocus({...focus,company_id:'absent'},layer),/unknown company/);
  writeFileSync(join(root,'company-v2','receipt.json'),JSON.stringify({version:'company-v2',catalog_version:catalog.version,output_sha256:'wrong'}));
  assert.throws(()=>attachCompanyLayer(main,root,catalog),/hash/);
  assert.equal(attachCompanyLayer(main,root,{version:'absent'}).available,false);
 }finally{main.close();rmSync(root,{recursive:true,force:true});}
});

import {createDatabase} from './helpers/d1.mjs';
import {createJournalService} from '../mastery/journal.mjs';
import {putPreferences} from '../core/store.mjs';
import {saveSnapshot} from '../mastery/ledger.mjs';
test('journal separates scopes and layer hashes and keeps company mocks out of plan iteration',async t=>{
 const db=createDatabase();t.after(()=>db.close());
 let layer={available:true,version:'company-v1',sha256:'first',meta:{commit_date:'2026-01-01'},companies:[{company_id:'example',name:'Example'}],lists:new Map([['example',new Map([['all',scope.list],['30d',scope.list]])]])};
 const service=createJournalService({db,catalogRoot:'/unused',catalogProvider:()=>catalog,companyProvider:()=>layer});
 const learnerId='company-fixture',clock=new Date('2026-10-29T00:00:00Z');
 const general=await service.view(learnerId,clock);
 await putPreferences(db,learnerId,{mastery:{company_focus:{company_id:'example',window:'all',fill_from_general:false}}});
 const focused=await service.view(learnerId,clock);assert.notEqual(focused.plan.snapshot_id,general.plan.snapshot_id);
 layer={...layer,sha256:'second'};
 const refreshed=await service.view(learnerId,clock);assert.notEqual(refreshed.plan.snapshot_id,focused.plan.snapshot_id);
 await saveSnapshot(db,learnerId,'company_mock','2026-10-28',{kind:'company_mock',local_date:'2026-10-28',problems:[{problem_key:'leetcode:medium'}]});
 const withMock=await service.view(learnerId,clock);assert.equal(withMock.mock_contests.length,1);
 assert.ok(withMock.days.every(d=>d.entries.every(e=>e.snapshot_id!=='company_mock-2026-10-28')));
 await putPreferences(db,learnerId,{mastery:{company_focus:null}});
 const restored=await service.view(learnerId,clock);assert.equal(restored.plan.progression.next?.scope,undefined);
});

test('general progression bytes match frozen pre-company implementation on authored scenarios',()=>{
 const baseline=JSON.parse(readFileSync(new URL('./fixtures/company-general-baseline.v1.json',import.meta.url),'utf8'));
 const catalog=catalogFromData({version:'authored-company-invariance',problems:baseline.problems});
 for(const fixture of baseline.cases)assert.equal(JSON.stringify(planProgressionV2({date:'2026-10-29',ledger:{attempts:fixture.attempts},catalog,prerequisites:{},learnerId:'authored'})),JSON.stringify(fixture.expected),fixture.name);
});
