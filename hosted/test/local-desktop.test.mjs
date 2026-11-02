import test from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {startLocal} from '../local.mjs';
import {catalogFromData} from '../mastery/catalog.mjs';
import {COMPANY_WINDOWS} from '../mastery/company.mjs';
import {createContestSchedule} from '../local-contest-sync.mjs';
const curriculum={schema_version:1,curriculum_version:'test',problems:[],relationships:[]};
const token='0123456789abcdef0123456789abcdef',origin='tauri://localhost';
const catalog=catalogFromData({problems:[1,2,3].flatMap(level=>[1,2].map(n=>({key:`leetcode:fixture-${level}-${n}`,platform:'leetcode',title:`Authored ${level} ${n}`,url:`https://leetcode.com/problems/fixture-${level}-${n}/`,difficulty_kind:'lc_level',difficulty_value:level,tags:['arrays'],concepts:[{id:'arrays',status:'ai_reviewed'}]})))});
const focus={company_id:'example',window:'all',fill_from_general:true};
const layer={available:true,version:'company-fixture',sha256:'fixture-hash',meta:{commit_date:'2026-10-29',upstream_url:'https://example.invalid'},companies:[{company_id:'example',name:'Example'}],lists:new Map([['example',new Map(COMPANY_WINDOWS.map(w=>[w,w==='all'?[...catalog.problems.keys()].map((problem_key,i)=>({problem_key,rank:i+1,frequency:10})):[]]))]]),unmatched:new Map()};
test('desktop token/origin/API-only boundary, company preference, scoped mock and health',async()=>{
  const service=await startLocal({port:0,database:':memory:',curriculum,apiOnly:true,appToken:token,allowedOrigin:origin,autoGitSync:false,catalogProvider:()=>catalog,companyProvider:()=>layer});
  const request=(path,method='GET',body)=>fetch(service.url+path,{method,headers:{'X-App-Token':token,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  try{
    assert.equal((await fetch(service.url+'/api/health')).status,403);
    assert.equal((await fetch(service.url+'/api/health',{headers:{'X-App-Token':token,origin:'https://evil.invalid'}})).status,403);
    const health=await request('/api/health');assert.equal(health.status,200);assert.equal(health.headers.get('access-control-allow-origin'),origin);
    assert.equal((await request('/')).status,404);assert.equal((await request('/api/local/library')).status,404);
    const preflight=await fetch(service.url+'/api/health',{method:'OPTIONS',headers:{origin,'access-control-request-method':'GET','access-control-request-headers':'x-app-token'}});assert.equal(preflight.status,204);
    const summary=await(await request('/api/company')).json();assert.equal(summary.companies[0].windows.all.matched,6);
    const detail=await(await request('/api/company/example')).json();assert.equal(detail.companies[0].problems.length,6);
    assert.equal((await request('/api/preferences','PUT',{mastery:{company_focus:{...focus,company_id:'absent'}}})).status,400);
    assert.equal((await request('/api/preferences','PUT',{mastery:{company_focus:focus}})).status,200);
    const created=await request('/api/company/mock','POST',{});assert.equal(created.status,201);const mock=await created.json();assert.equal(mock.problems.length,2);assert.equal(mock.duration_minutes,45);
    const repeated=await(await request('/api/company/mock','POST',{})).json();assert.equal(repeated.frozen,true);assert.deepEqual(repeated.problems,mock.problems);
    const journal=await(await request('/api/journal')).json();assert.equal(journal.available,true);assert.equal(journal.mock_contests.length,1);
    const valid=await(await request('/api/local/daily-log/validate','POST',{path:'leetcode/26-10-29.md',source:'# 2026-10-29\n\n| 문제 | 결과 | 메모 |\n| --- | --- | --- |\n| https://leetcode.com/problems/fixture-1-1/ | O | |\n'})).json();assert.equal(valid.rows.length,1);
    const dir=mkdtempSync(join(tmpdir(),'desktop repo 한 # % '));
    try{const git=(...args)=>execFileSync('git',['-C',dir,...args],{stdio:'pipe'});git('init','-q','-b','main');writeFileSync(join(dir,'README.md'),'authored');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','initial');
      assert.equal((await request('/api/local/repositories','POST',{repoId:'fixture',path:dir,branch:'main'})).status,201);
      const repos=await(await request('/api/local/repositories')).json();assert.equal(repos.repositories[0].path,dir);
      assert.equal((await request('/api/local/ingest','POST',{})).status,200);
    }finally{rmSync(dir,{recursive:true,force:true});}
    assert.equal((await request('/api/local/contest-sync','PUT',{enabled:true})).status,200);
  }finally{await service.close();}
});
test('API-only rejects incomplete desktop configuration before opening database',async()=>{
  await assert.rejects(startLocal({apiOnly:true,database:':memory:',curriculum}),/APP_TOKEN/);
});
test('contest schedule is opt-in, daily, records failures and permits explicit sync',async()=>{
  let count=0,time=new Date('2026-10-29T00:00:00Z');
  const schedule=await createContestSchedule({now:()=>time,sync:async()=>{count++;return {results:[{platform:'fixture',status:'unavailable',error:'offline'}]};}});
  try{await schedule.run();assert.equal(count,0);await schedule.configure({enabled:true});await schedule.run();assert.equal(count,1);assert.match(schedule.status().error,/offline/);await schedule.run();assert.equal(count,1);time=new Date(time.getTime()+86_400_000);await schedule.run();assert.equal(count,2);await schedule.run(true);assert.equal(count,3);}finally{await schedule.close();}
});
test('contest schedule persists only its settings across launches',async()=>{
  const {readFileSync}=await import('node:fs');const dir=mkdtempSync(join(tmpdir(),'contest settings 한 # % ')),path=join(dir,'contest-sync.json');
  let scheduler;try{scheduler=await createContestSchedule({path,sync:async()=>({results:[]})});await scheduler.configure({enabled:true});await scheduler.run();await scheduler.close();const document=JSON.parse(readFileSync(path,'utf8'));assert.deepEqual(Object.keys(document).sort(),['enabled','error','last_attempt_at','last_success_at']);scheduler=await createContestSchedule({path,sync:async()=>{throw Error('not due');}});assert.equal(scheduler.status().enabled,true);const previous=scheduler.status().last_success_at;await scheduler.run();assert.equal(scheduler.status().last_success_at,previous);}finally{await scheduler?.close();rmSync(dir,{recursive:true,force:true});}
});
