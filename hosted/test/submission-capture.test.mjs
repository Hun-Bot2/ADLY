import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createDatabase} from './helpers/d1.mjs';
import {appendEvents,getPreferences,putPreferences} from '../core/store.mjs';
import {appendLedger,listEntries,normalizeEntry} from '../mastery/side-ledger.mjs';
import {readLedger,attemptStream} from '../mastery/ledger.mjs';
import {normalizeCodeforcesSubmissions,normalizeAtCoderSubmissions,sha256Hex,submissionEntryId} from '../mastery/submissions.mjs';
import {syncSubmissions,summarizeSubmissions} from '../mastery/submission-sync.mjs';
import {run as cli} from '../cli.mjs';

const L='owner';
const REC='2026-11-02T00:00:00.000000Z';
const sec=iso=>Date.parse(iso)/1000;
const cfItem=(id,verdict,at,over={})=>({id,contestId:4,creationTimeSeconds:sec(at),relativeTimeSeconds:2147483647,problem:{contestId:4,index:'A',name:'Watermelon'},
  programmingLanguage:'Python 3',verdict,testset:'TESTS',passedTestCount:3,timeConsumedMillis:31,memoryConsumedBytes:1024,...over});
const acItem=(id,result,at,over={})=>({id,epoch_second:sec(at),problem_id:'abc001_a',contest_id:'abc001',user_id:'u',language:'Python (3.8)',point:100,length:10,result,execution_time:12,...over});
const validPayload=()=>({platform:'codeforces',submission_id:'1',id_kind:'native',problem_key:'codeforces:4A',verdict:'accepted',raw_verdict:'OK',language:null,judge_time_ms:null,judge_memory_bytes:null,passed_tests:null,elapsed_seconds:null,active_seconds:null,time_source:'none',time_confidence:'none',contest_id:'4'});
const envelope=payload=>({schema_version:1,entry_id:'x',learner_id:L,occurred_at:REC,recorded_at:REC,source:'manual',payload,supersedes:null});

test('migration 009 on fresh and upgraded databases; append-only triggers; source CHECK', t=>{
  const fresh=createDatabase();t.after(()=>fresh.close());
  const tables=fresh.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
  assert.ok(tables.includes('platform_submissions') && tables.includes('submission_sync_marks'));
  assert.equal(fresh.sqlite.prepare('SELECT name FROM schema_migrations WHERE version=9').get().name,'009_platform_submissions');
  fresh.sqlite.prepare("INSERT INTO learners(learner_id) VALUES('o')").run();
  const insert=(table,source)=>fresh.sqlite.prepare(`INSERT INTO ${table}(entry_id,learner_id,schema_version,occurred_at,recorded_at,source,payload,canonical) VALUES ('e','o',1,'a','b',?,'{}','{}')`).run(source);
  assert.throws(()=>insert('platform_submissions','bogus'),/CHECK/);
  assert.throws(()=>insert('submission_sync_marks','extension'),/CHECK/);
  insert('platform_submissions','extension'); insert('submission_sync_marks','codeforces_api');
  assert.throws(()=>fresh.sqlite.prepare('UPDATE platform_submissions SET payload=1').run(),/append-only/);
  assert.throws(()=>fresh.sqlite.prepare('DELETE FROM submission_sync_marks').run(),/append-only/);
  // Upgrade from a store that stops at migration 008: snapshot is taken, data survives, 009 applies.
  const root=mkdtempSync(join(tmpdir(),'sub-upgrade-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const path=join(root,'l.sqlite3'),old=new DatabaseSync(path);
  for (let v=1;v<=8;v++) {
    const name=['001_core','002_delivery','003_providers','004_contest_history','005_operations','006_immutable_missions','007_git_evidence','008_mastery_ledger'][v-1];
    old.exec(readFileSync(new URL(`../migrations/${name}.sql`,import.meta.url),'utf8'));
  }
  old.exec("INSERT INTO learners(learner_id) VALUES('kept')");old.close();
  const upgraded=createDatabase(path);t.after(()=>upgraded.close());
  assert.ok(upgraded.migrationBackup);
  assert.equal(upgraded.sqlite.prepare('SELECT MAX(version) AS v FROM schema_migrations').get().v,9);
  assert.equal(upgraded.sqlite.prepare('SELECT learner_id FROM learners').get().learner_id,'kept');
  assert.equal(upgraded.sqlite.prepare('SELECT COUNT(*) AS n FROM platform_submissions').get().n,0);
});

test('platform_submissions and sync mark validators', ()=>{
  assert.doesNotThrow(()=>normalizeEntry('platform_submissions',envelope(validPayload())));
  const bad=(patch,pattern)=>assert.throws(()=>normalizeEntry('platform_submissions',envelope({...validPayload(),...patch})),pattern);
  bad({verdict:'nope'},/verdict/);
  bad({platform:'baekjoon'},/platform/);
  bad({problem_key:'atcoder:abc001_a'},/does not match platform/);
  bad({problem_key:'4A'},/problem key/);
  bad({id_kind:'native',submission_id:null},/native/);
  bad({id_kind:'fingerprint',submission_id:'1'},/native|fingerprint/);
  bad({raw_verdict:'x'.repeat(65)},/ledger text/);
  bad({judge_time_ms:-1},/count/);
  bad({passed_tests:1.5},/count/);
  bad({elapsed_seconds:5},/disagree/);                       // source none with a time value
  bad({time_confidence:'low'},/disagree/);                    // source none with confidence
  bad({time_source:'browser_elapsed',time_confidence:'low'},/disagree/);  // source without any value
  bad({time_source:'browser_elapsed',elapsed_seconds:5},/disagree/);      // value without confidence
  bad({time_source:'sensor',elapsed_seconds:5,time_confidence:'low'},/time source/);
  bad({active_seconds:-3,time_source:'user',time_confidence:'low'},/seconds/);
  bad({extra:1},/payload/);
  bad({contest_id:''},/ledger text/);
  assert.doesNotThrow(()=>normalizeEntry('platform_submissions',envelope({...validPayload(),time_source:'browser_active',time_confidence:'medium',active_seconds:300,elapsed_seconds:null})));
  assert.doesNotThrow(()=>normalizeEntry('platform_submissions',envelope({...validPayload(),platform:'leetcode',problem_key:'leetcode:two-sum',id_kind:'fingerprint',submission_id:null})));
  const mark={platform:'atcoder',handle:'u',cursor:'10',newest_submitted_at:REC,status:'partial',fetched:3,detail:'x'};
  assert.doesNotThrow(()=>normalizeEntry('submission_sync_marks',{...envelope(mark),source:'atcoder_problems_api'}));
  for (const patch of [{status:'done'},{platform:'leetcode'},{fetched:-1},{handle:''},{newest_submitted_at:'yesterday'},{extra:1}])
    assert.throws(()=>normalizeEntry('submission_sync_marks',{...envelope({...mark,...patch}),source:'atcoder_problems_api'}));
  assert.throws(()=>normalizeEntry('submission_sync_marks',envelope(mark)),/source/);
});

test('sha256Hex matches node:crypto', ()=>{
  for (const s of ['','abc','codeforces|codeforces:4A|1700000000|WRONG_ANSWER','가나다'.repeat(40),'a'.repeat(55),'a'.repeat(56),'a'.repeat(64)])
    assert.equal(sha256Hex(s),createHash('sha256').update(s).digest('hex'));
});

test('Codeforces normalizer: WA x5 then OK, TESTING skipped, gym kept, fingerprint path', ()=>{
  const items=[...[1,2,3,4,5].map(i=>cfItem(100+i,'WRONG_ANSWER',`2026-11-01T0${i}:00:00Z`)),cfItem(106,'OK','2026-11-01T06:00:00Z'),
    cfItem(107,'TESTING','2026-11-01T07:00:00Z'),{...cfItem(108,undefined,'2026-11-01T07:30:00Z')},
    cfItem(109,'TIME_LIMIT_EXCEEDED','2026-11-01T08:00:00Z'),cfItem(110,'MEMORY_LIMIT_EXCEEDED','2026-11-01T08:10:00Z'),cfItem(111,'RUNTIME_ERROR','2026-11-01T08:20:00Z'),
    cfItem(112,'COMPILATION_ERROR','2026-11-01T08:30:00Z'),cfItem(113,'SKIPPED','2026-11-01T08:40:00Z'),
    cfItem(114,'OK','2026-11-01T09:00:00Z',{contestId:100500,problem:{contestId:100500,index:'B1',name:'Gym'}}),
    {id:'bad',problem:null,verdict:'OK',creationTimeSeconds:1}];
  const {entries,skipped}=normalizeCodeforcesSubmissions(items,{learnerId:L,recordedAt:REC});
  assert.deepEqual(skipped,{in_progress:2,invalid:1});
  assert.equal(entries.length,12);
  entries.forEach(e=>normalizeEntry('platform_submissions',e));
  assert.deepEqual(entries.slice(0,6).map(e=>e.payload.verdict),['wrong_answer','wrong_answer','wrong_answer','wrong_answer','wrong_answer','accepted']);
  assert.deepEqual(entries.slice(6,11).map(e=>e.payload.verdict),['time_limit','memory_limit','runtime_error','compile_error','other']);
  assert.equal(entries[11].payload.problem_key,'codeforces:100500B1');
  assert.equal(entries[11].payload.contest_id,'100500');
  const ok=entries[5];
  assert.equal(ok.entry_id,'sub:codeforces:106');
  assert.equal(ok.occurred_at,'2026-11-01T06:00:00.000000Z');
  assert.equal(ok.recorded_at,REC);
  assert.deepEqual(ok.payload,{platform:'codeforces',submission_id:'106',id_kind:'native',problem_key:'codeforces:4A',verdict:'accepted',raw_verdict:'OK',language:'Python 3',
    judge_time_ms:31,judge_memory_bytes:1024,passed_tests:3,elapsed_seconds:null,active_seconds:null,time_source:'none',time_confidence:'none',contest_id:'4'});
  assert.equal(entries[10].payload.raw_verdict,'SKIPPED');
  // fingerprint path: no native id
  const noId=normalizeCodeforcesSubmissions([{...cfItem(0,'OK','2026-11-01T06:00:00Z'),id:undefined}],{learnerId:L,recordedAt:REC}).entries[0];
  const hex=createHash('sha256').update(`codeforces|codeforces:4A|${sec('2026-11-01T06:00:00Z')}|OK`).digest('hex').slice(0,24);
  assert.equal(noId.entry_id,`sub:codeforces:fp:${hex}`);
  assert.equal(noId.payload.id_kind,'fingerprint'); assert.equal(noId.payload.submission_id,null);
  assert.deepEqual(submissionEntryId('atcoder','atcoder:abc001_a',5,'AC'),submissionEntryId('atcoder','atcoder:abc001_a',5,'AC'));
  // future timestamps and non-array input
  assert.equal(normalizeCodeforcesSubmissions([cfItem(1,'OK','2030-01-01T00:00:00Z')],{learnerId:L,recordedAt:REC}).skipped.invalid,1);
  assert.throws(()=>normalizeCodeforcesSubmissions({},{learnerId:L,recordedAt:REC}));
});

test('AtCoder normalizer: verdict map, in-progress skipped, judge fields', ()=>{
  const items=[acItem(1,'WA','2026-11-01T01:00:00Z'),acItem(2,'AC','2026-11-01T02:00:00Z'),acItem(3,'WJ','2026-11-01T03:00:00Z'),acItem(4,'WR','2026-11-01T03:01:00Z'),
    acItem(5,'Judging','2026-11-01T03:02:00Z'),acItem(6,'3/20','2026-11-01T03:03:00Z'),acItem(7,'TLE','2026-11-01T04:00:00Z'),acItem(8,'MLE','2026-11-01T04:01:00Z'),
    acItem(9,'RE','2026-11-01T04:02:00Z'),acItem(10,'CE','2026-11-01T04:03:00Z'),acItem(11,'OLE','2026-11-01T04:04:00Z',{execution_time:null})];
  const {entries,skipped}=normalizeAtCoderSubmissions(items,{learnerId:L,recordedAt:REC});
  assert.deepEqual(skipped,{in_progress:4,invalid:0});
  assert.deepEqual(entries.map(e=>e.payload.verdict),['wrong_answer','accepted','time_limit','memory_limit','runtime_error','compile_error','other']);
  entries.forEach(e=>normalizeEntry('platform_submissions',e));
  assert.equal(entries[1].entry_id,'sub:atcoder:2');
  assert.equal(entries[1].source,'atcoder_problems_api');
  assert.equal(entries[1].payload.problem_key,'atcoder:abc001_a');
  assert.equal(entries[1].payload.judge_time_ms,12); assert.equal(entries[1].payload.judge_memory_bytes,null);
  assert.equal(entries[1].payload.contest_id,'abc001');
  assert.equal(entries[6].payload.judge_time_ms,null);
});

// ---------- projection ----------
const sub=(id,verdict,at,key='codeforces:4A',platform='codeforces')=>({schema_version:1,entry_id:`sub:${platform}:${id}`,learner_id:L,occurred_at:at,recorded_at:'2026-12-01T00:00:00.000000Z',
  source:platform==='codeforces'?'codeforces_api':'atcoder_problems_api',supersedes:null,
  payload:{...validPayload(),platform,submission_id:String(id),problem_key:key,verdict,raw_verdict:verdict==='accepted'?'OK':'WA'}});
const T=iso=>iso.replace('Z','.000000Z');
const logObservation=(id,at,key='codeforces:4A',extra={})=>({schema_version:1,entry_id:id,learner_id:L,occurred_at:at,recorded_at:'2026-12-01T00:00:00.000000Z',source:'git',supersedes:null,
  payload:{repo_id:'solutions',sha:'a'.repeat(40),path:'codeforces/26-11-01.md',problem_key:key,outcome:'failed',hints:null,self_minutes:25,activity_type:'review',transfer_from:null,trailers:{},...extra}});
const importEvent=(id,at,platform='codeforces')=>({schema_version:1,event_id:`import:${platform}:${L}:${id}`,learner_id:L,occurred_at:at,recorded_at:'2026-12-01T00:00:00.000000Z',kind:'attempt',source:'platform_import',
  payload:{problem_key:'codeforces:4A',outcome:'reported_completion',hints:null,platform,external_id:String(id)},supersedes:null});

test('projection: zero submission rows leave the attempt stream identical', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  await appendEvents(db,L,[{schema_version:1,event_id:'m1',learner_id:L,occurred_at:T('2026-10-20T01:00:00Z'),recorded_at:T('2026-10-20T01:00:00Z'),kind:'attempt',source:'manual',payload:{problem_key:'leetcode:two-sum',outcome:'independent',hints:false},supersedes:null},importEvent(9,T('2026-10-21T01:00:00Z'))]);
  await appendLedger(db,L,{git_observations:[logObservation('g1',T('2026-10-22T03:00:00Z'))]});
  const ledger=await readLedger(db,L);
  // Reference: the pre-change stream, rebuilt from the same fields without the submission layer.
  const reference=attemptStream({...ledger,platform_submissions:undefined});
  assert.deepEqual(ledger.attempts,reference);
  assert.deepEqual(attemptStream({...ledger,platform_submissions:[]}),reference);
  assert.equal(ledger.attempts.length,3);
  assert.ok(ledger.attempts.every(a=>!('submissions' in a)));
  assert.deepEqual(Object.keys(ledger.attempts[2]),['id','table','occurred_at','recorded_at','problem_key','outcome','hints','recorded_outcome','recorded_hints','activity_type','transfer_from','evidence_source','self_minutes'],'pre-change attempt shape');
  assert.deepEqual(ledger.attempts.map(a=>a.id),['m1','import:codeforces:owner:9','g1']);
  // After rows exist for another problem the unrelated attempts are unchanged.
  await appendLedger(db,L,{platform_submissions:[sub(1,'accepted',T('2026-10-23T01:00:00Z'),'codeforces:1A')]});
  const after=await readLedger(db,L);
  assert.deepEqual(after.attempts.filter(a=>a.table!=='platform_submissions'),reference);
});

test('projection: WA x5 then OK on one KST day is one solved attempt with counts; next day is separate', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  const wa=[1,2,3,4,5].map(i=>sub(i,'wrong_answer',T(`2026-11-01T0${i}:00:00Z`)));
  await appendLedger(db,L,{platform_submissions:[...wa,sub(6,'accepted',T('2026-11-01T06:00:00Z')),sub(7,'wrong_answer',T('2026-11-01T16:00:00Z'))]});
  const {attempts}=await readLedger(db,L);
  // 16:00Z is 01:00 KST on 11-02: a different problem-day, failed.
  assert.equal(attempts.length,2);
  const [day1,day2]=attempts;
  assert.equal(day1.evidence_source,'platform_submission'); assert.equal(day1.self_minutes,null);
  assert.equal(day1.outcome,'independent'); assert.equal(day1.hints,false); assert.equal(day1.recorded_outcome,'reported_completion');
  assert.equal(day1.submissions,6); assert.equal(day1.failed_before_accept,5);
  assert.equal(day1.first_submitted_at,'2026-11-01T01:00:00.000000Z'); assert.equal(day1.accepted_at,'2026-11-01T06:00:00.000000Z');
  assert.equal(day2.outcome,'failed'); assert.equal(day2.accepted_at,null); assert.equal(day2.submissions,1);
  assert.equal(day1.problem_key,'codeforces:4A');
});

test('projection: a failed-only day stays failed; an accepted submission in the day wins over later failures', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  await appendLedger(db,L,{platform_submissions:[sub(1,'accepted',T('2026-11-01T01:00:00Z')),sub(2,'wrong_answer',T('2026-11-01T02:00:00Z')),sub(3,'time_limit',T('2026-11-01T02:00:00Z'),'codeforces:1A')]});
  const {attempts}=await readLedger(db,L);
  const a=attempts.find(x=>x.problem_key==='codeforces:4A'),b=attempts.find(x=>x.problem_key==='codeforces:1A');
  assert.equal(a.outcome,'independent'); assert.equal(a.failed_before_accept,0); assert.equal(a.submissions,2);
  assert.equal(b.outcome,'failed'); assert.equal(b.hints,null);
});

test('projection: a daily-log row and submissions merge into one attempt using the platform verdict', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  await appendLedger(db,L,{git_observations:[logObservation('log-1',T('2026-11-01T03:00:00Z'))],platform_submissions:[sub(1,'wrong_answer',T('2026-11-01T01:00:00Z')),sub(2,'accepted',T('2026-11-01T02:00:00Z'))]});
  const {attempts}=await readLedger(db,L);
  assert.equal(attempts.length,1);
  const a=attempts[0];
  assert.equal(a.id,'log-1'); assert.equal(a.table,'git_observations'); assert.equal(a.evidence_source,'git');
  assert.equal(a.self_minutes,25); assert.equal(a.activity_type,'review');
  assert.equal(a.outcome,'independent'); assert.equal(a.recorded_outcome,'reported_completion');   // log said failed; platform wins
  assert.equal(a.submissions,2); assert.equal(a.failed_before_accept,1);
  // Log on another day is untouched.
  await appendLedger(db,L,{git_observations:[logObservation('log-2',T('2026-11-05T03:00:00Z'))]});
  assert.equal((await readLedger(db,L)).attempts.length,2);
});

test('projection: platform_import events dedupe the matching submission group', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  await appendEvents(db,L,[importEvent(2,T('2026-11-01T02:00:00Z'))]);
  await appendLedger(db,L,{platform_submissions:[sub(1,'wrong_answer',T('2026-11-01T01:00:00Z')),sub(2,'accepted',T('2026-11-01T02:00:00Z')),sub(9,'wrong_answer',T('2026-11-03T02:00:00Z'))]});
  const {attempts}=await readLedger(db,L);
  assert.deepEqual(attempts.map(a=>[a.id,a.evidence_source]),[['import:codeforces:owner:2','platform_import'],['subday:codeforces:4A:2026-11-03','platform_submission']]);
});

test('projection respects cutoff and high-water replay', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  await appendLedger(db,L,{platform_submissions:[sub(1,'wrong_answer',T('2026-11-01T01:00:00Z'))]});
  const marks=(await readLedger(db,L)).high_water;
  await appendLedger(db,L,{platform_submissions:[sub(2,'accepted',T('2026-11-01T02:00:00Z'))]});
  assert.equal((await readLedger(db,L,{highWater:marks})).attempts[0].outcome,'failed');
  assert.equal((await readLedger(db,L)).attempts[0].outcome,'independent');
});

// ---------- sync ----------
const response=(body,status=200)=>({ok:status>=200&&status<300,status,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
const cfPages=(items,size=100)=>(url)=>{
  const from=Number(new URL(url).searchParams.get('from')),count=Number(new URL(url).searchParams.get('count'));
  assert.equal(count,size);
  return response({status:'OK',result:items.slice(from-1,from-1+count)});
};
const cfList=(n,startId=1000)=>Array.from({length:n},(_,i)=>cfItem(startId+n-i,'WRONG_ANSWER',new Date(Date.parse('2026-10-01T00:00:00Z')+(n-i)*60000).toISOString().replace('.000Z','Z')));

test('sync: backfill, idempotent re-run, mark per run, incremental stops at first known id', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  const items=cfList(130);
  const urls=[];
  const fetcher=async(url)=>{urls.push(url);return cfPages(items)(url);};
  const sleeps=[];
  const sleep=async ms=>{sleeps.push(ms);};
  const first=await syncSubmissions(db,L,{platform:'codeforces',handle:'tourist',fetcher,sleep,now:new Date('2026-11-02T00:00:00Z')});
  assert.equal(first.status,'ok'); assert.equal(first.fetched,130); assert.equal(first.requests,2); assert.deepEqual(sleeps,[2000]);
  assert.equal((await listEntries(db,'platform_submissions',L)).length,130);
  const again=await syncSubmissions(db,L,{platform:'codeforces',handle:'tourist',fetcher,sleep,now:new Date('2026-11-02T01:00:00Z')});
  assert.equal(again.fetched,0); assert.equal(again.requests,1,'incremental stops at the first page containing a known id');
  assert.equal((await listEntries(db,'platform_submissions',L)).length,130,'no second row (SC-3)');
  const marks=await listEntries(db,'submission_sync_marks',L);
  assert.deepEqual(marks.map(m=>[m.payload.status,m.payload.fetched,m.payload.cursor]),[['ok',130,'cf2:1001:1130:1130:130:1'],['ok',0,'cf2:1001:1130:1130:130:1']]);
  assert.equal(marks[0].payload.newest_submitted_at,items[0] && new Date(items[0].creationTimeSeconds*1000).toISOString().replace('.000Z','.000000Z'));
  // A new submission appears: only head page fetched, one row added.
  items.unshift(cfItem(2000,'OK','2026-11-02T02:00:00Z'));
  const third=await syncSubmissions(db,L,{platform:'codeforces',handle:'tourist',fetcher,sleep,now:new Date('2026-11-02T03:00:00Z')});
  assert.equal(third.fetched,1); assert.equal(third.requests,1);
  assert.ok(urls.every(u=>u.startsWith('https://codeforces.com/api/user.status?handle=tourist&from=')));
});

test('sync: interrupted backfill resumes from the sync mark', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  const items=cfList(350);
  const fetcher=async url=>cfPages(items)(url);
  const sleep=async()=>{};
  const first=await syncSubmissions(db,L,{platform:'codeforces',handle:'tourist',fetcher,sleep,pages:2,now:new Date('2026-11-02T00:00:00Z')});
  assert.equal(first.status,'partial'); assert.equal(first.cursor,'cf2:1151:1350:1350:200:0'); assert.equal(first.fetched,200);
  const seen=[];
  const second=await syncSubmissions(db,L,{platform:'codeforces',handle:'tourist',fetcher:async url=>{seen.push(new URL(url).searchParams.get('from'));return cfPages(items)(url);},sleep,pages:10,now:new Date('2026-11-02T01:00:00Z')});
  assert.deepEqual(seen,['1','200','300'],'head page first (known id), then resume one row before the stored offset (overlap check)');
  assert.equal(second.status,'ok'); assert.equal(second.fetched,150); assert.equal((await listEntries(db,'platform_submissions',L)).length,350);
  const last=(await listEntries(db,'submission_sync_marks',L)).at(-1);
  assert.equal(last.payload.status,'ok'); assert.equal(last.payload.cursor,'cf2:1001:1350:1350:350:1');
});

test('sync: an error appends a mark, keeps stored rows and the resume point; a later run recovers', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  const items=cfList(250);
  let fail=true;
  const fetcher=async url=>{ if (fail && new URL(url).searchParams.get('from')==='101') return response({status:'FAILED',comment:'limit exceeded'},429); return cfPages(items)(url); };
  const sleep=async()=>{};
  const bad=await syncSubmissions(db,L,{platform:'codeforces',handle:'tourist',fetcher,sleep,now:new Date('2026-11-02T00:00:00Z')});
  assert.equal(bad.status,'error'); assert.match(bad.detail,/429/); assert.equal(bad.cursor,'cf2:1151:1250:1250:100:0','resume point: ids 1151..1250 stored');
  assert.equal((await listEntries(db,'platform_submissions',L)).length,100,'rows from the first page are kept');
  fail=false;
  const good=await syncSubmissions(db,L,{platform:'codeforces',handle:'tourist',fetcher,sleep,now:new Date('2026-11-02T01:00:00Z')});
  assert.equal(good.status,'ok'); assert.equal(good.fetched,150);
  assert.deepEqual((await listEntries(db,'submission_sync_marks',L)).map(m=>m.payload.status),['error','ok']);
  // Non-JSON and FAILED bodies are errors too, and never throw out of the runner.
  const junk=await syncSubmissions(db,L,{platform:'codeforces',handle:'nobody',fetcher:async()=>response('<html>'),sleep,now:new Date('2026-11-02T02:00:00Z')});
  assert.equal(junk.status,'error');
  const failed=await syncSubmissions(db,L,{platform:'codeforces',handle:'nobody',fetcher:async()=>response({status:'FAILED',comment:'handle: not found'}),sleep,now:new Date('2026-11-02T03:00:00Z')});
  assert.match(failed.detail,/not found/);
  assert.equal((await listEntries(db,'platform_submissions',L)).length,250);
  const thrown=await syncSubmissions(db,L,{platform:'codeforces',handle:'nobody',fetcher:async()=>{throw new Error('network down');},sleep,now:new Date('2026-11-02T04:00:00Z')});
  assert.equal(thrown.status,'error');
});

test('sync: in-progress submissions are not stored and the next run picks up the final verdict', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  let items=[cfItem(2,'TESTING','2026-11-01T02:00:00Z'),cfItem(1,'WRONG_ANSWER','2026-11-01T01:00:00Z')];
  const fetcher=async url=>cfPages(items)(url);
  const sleep=async()=>{};
  const first=await syncSubmissions(db,L,{platform:'codeforces',handle:'h',fetcher,sleep,now:new Date('2026-11-02T00:00:00Z')});
  assert.equal(first.fetched,1); assert.match((await listEntries(db,'submission_sync_marks',L))[0].payload.detail,/in_progress=1/);
  items=[cfItem(2,'OK','2026-11-01T02:00:00Z'),cfItem(1,'WRONG_ANSWER','2026-11-01T01:00:00Z')];
  const second=await syncSubmissions(db,L,{platform:'codeforces',handle:'h',fetcher,sleep,now:new Date('2026-11-02T01:00:00Z')});
  assert.equal(second.fetched,1);
  assert.deepEqual((await readLedger(db,L)).attempts.map(a=>[a.outcome,a.failed_before_accept]),[['independent',1]]);
});

test('sync: AtCoder ascending cursor, 1 s spacing, resume and idempotence', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  const all=Array.from({length:600},(_,i)=>acItem(i+1,'WA',new Date(Date.parse('2026-10-01T00:00:00Z')+i*1000).toISOString().replace('.000Z','Z')));
  const calls=[],sleeps=[];
  const fetcher=async url=>{const from=Number(new URL(url).searchParams.get('from_second'));calls.push(from);return response(all.filter(s=>s.epoch_second>=from).slice(0,500));};
  const sleep=async ms=>{sleeps.push(ms);};
  const part=await syncSubmissions(db,L,{platform:'atcoder',handle:'u',fetcher,sleep,pages:1,now:new Date('2026-11-02T00:00:00Z')});
  assert.equal(part.status,'partial'); assert.equal(part.fetched,500); assert.equal(part.cursor,String(all[499].epoch_second));
  const rest=await syncSubmissions(db,L,{platform:'atcoder',handle:'u',fetcher,sleep,now:new Date('2026-11-02T01:00:00Z')});
  assert.equal(rest.status,'ok'); assert.equal(rest.fetched,100);
  assert.equal(calls[1],all[499].epoch_second-86400,'resumes one crawl-overlap day before the stored second');
  assert.equal((await listEntries(db,'platform_submissions',L)).length,600);
  const idem=await syncSubmissions(db,L,{platform:'atcoder',handle:'u',fetcher,sleep,now:new Date('2026-11-02T02:00:00Z')});
  assert.equal(idem.fetched,0); assert.equal((await listEntries(db,'platform_submissions',L)).length,600);
  // 2 requests in the run that needed two pages -> one 1000 ms gap
  const two=createDatabase();t.after(()=>two.close());
  const gaps=[];
  await syncSubmissions(two,L,{platform:'atcoder',handle:'u',fetcher,sleep:async ms=>{gaps.push(ms);},now:new Date('2026-11-02T00:00:00Z')});
  assert.deepEqual(gaps,[1000]);
  const error=await syncSubmissions(db,L,{platform:'atcoder',handle:'u',fetcher:async()=>response('boom',503),sleep,now:new Date('2026-11-02T03:00:00Z')});
  assert.equal(error.status,'error'); assert.equal((await listEntries(db,'platform_submissions',L)).length,600);
  assert.equal((await listEntries(db,'submission_sync_marks',L)).at(-1).payload.cursor,String(all[599].epoch_second),'error keeps the resume cursor');
});

test('sync (codeforces): new submissions during an interrupted backfill shift offsets without gaps or extra rows', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  const items=cfList(350);
  const fetcher=async url=>cfPages(items)(url);
  const sleep=async()=>{};
  await syncSubmissions(db,L,{platform:'codeforces',handle:'h',fetcher,sleep,pages:2,now:new Date('2026-11-02T00:00:00Z')});
  // 130 new submissions arrive before the next run: every stored row moves 130 offsets down.
  for (let i=1;i<=130;i++) items.unshift(cfItem(5000+i,'OK','2026-11-01T12:00:00Z'));
  const seen=[];
  const run=async(pages,at)=>syncSubmissions(db,L,{platform:'codeforces',handle:'h',fetcher:async url=>{seen.push(Number(new URL(url).searchParams.get('from')));return cfPages(items)(url);},sleep,pages,now:new Date(at)});
  const head=await run(1,'2026-11-02T01:00:00Z');
  assert.equal(head.status,'partial'); assert.match(head.detail,/new submissions/);
  const second=await run(10,'2026-11-02T02:00:00Z');
  assert.equal(second.status,'ok');
  assert.deepEqual(seen,[1,1,101,330,430],'head pages until a covered id, then the tail at old offset 200 + 130 new, one row early');
  const ids=(await listEntries(db,'platform_submissions',L)).map(e=>Number(e.payload.submission_id)).sort((a,b)=>a-b);
  assert.equal(ids.length,480); assert.equal(new Set(ids).size,480);
  assert.deepEqual(ids,[...items.map(i=>i.id)].sort((a,b)=>a-b),'every submission stored exactly once');
});

test('sync (codeforces): rows removed upstream make the offset hint overshoot; the tail steps back and overlaps', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  let items=cfList(450);
  const seen=[];
  const fetcher=async url=>{seen.push(Number(new URL(url).searchParams.get('from')));return cfPages(items)(url);};
  const sleep=async()=>{};
  await syncSubmissions(db,L,{platform:'codeforces',handle:'h',fetcher,sleep,pages:2,now:new Date('2026-11-02T00:00:00Z')});
  items=items.filter((_,i)=>i<50 || i>=80);   // 30 stored submissions disappear (e.g. a removed contest)
  seen.length=0;
  const next=await syncSubmissions(db,L,{platform:'codeforces',handle:'h',fetcher,sleep,now:new Date('2026-11-02T01:00:00Z')});
  assert.equal(next.status,'ok');
  assert.deepEqual(seen,[1,200,100,200,300,400],'the page at the hint starts below low, so step back one page before continuing');
  const stored=new Set((await listEntries(db,'platform_submissions',L)).map(e=>Number(e.payload.submission_id)));
  assert.ok(items.every(i=>stored.has(i.id)),'no gap below the old boundary');
});

test('sync (codeforces): a submission still judged deep in the list is re-read until it has a verdict', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  const items=cfList(150);
  items[120]={...items[120],verdict:'TESTING'};
  const fetcher=async url=>cfPages(items)(url);
  const sleep=async()=>{};
  const first=await syncSubmissions(db,L,{platform:'codeforces',handle:'h',fetcher,sleep,now:new Date('2026-11-02T00:00:00Z')});
  assert.equal(first.status,'ok'); assert.equal(first.fetched,149);
  items[120]={...items[120],verdict:'OK'};
  const second=await syncSubmissions(db,L,{platform:'codeforces',handle:'h',fetcher,sleep,now:new Date('2026-11-02T01:00:00Z')});
  assert.equal(second.fetched,1,'the judged submission is picked up once it is final');
  assert.equal(second.requests,2,'head reads down to the pending id');
  const third=await syncSubmissions(db,L,{platform:'codeforces',handle:'h',fetcher,sleep,now:new Date('2026-11-02T02:00:00Z')});
  assert.equal(third.requests,1,'afterwards incremental sync is one page again');
});

test('sync (codeforces): an old offset-only cursor restarts from the newest page without duplicates', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  const items=cfList(120);
  await appendLedger(db,L,{submission_sync_marks:[{schema_version:1,entry_id:'submark:codeforces:h:1',learner_id:L,occurred_at:REC,recorded_at:REC,source:'codeforces_api',supersedes:null,
    payload:{platform:'codeforces',handle:'h',cursor:'100',newest_submitted_at:null,status:'partial',fetched:0,detail:null}}]});
  const r=await syncSubmissions(db,L,{platform:'codeforces',handle:'h',fetcher:async url=>cfPages(items)(url),sleep:async()=>{},now:new Date('2026-11-02T00:00:00Z')});
  assert.equal(r.status,'ok'); assert.equal(r.fetched,120);
});

test('sync (atcoder): same-second submissions split across pages in unstable order are all stored once', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  const base=sec('2026-10-01T00:00:00Z');
  // 498 earlier submissions, then 5 in one second straddling the 500-row page boundary.
  const all=[...Array.from({length:498},(_,i)=>acItem(i+1,'WA',new Date((base+i)*1000).toISOString())),...Array.from({length:5},(_,i)=>acItem(1000+i,'AC',new Date((base+600)*1000).toISOString()))];
  let call=0;
  const fetcher=async url=>{
    const from=Number(new URL(url).searchParams.get('from_second'));
    const rows=all.filter(s=>s.epoch_second>=from).sort((a,b)=>a.epoch_second-b.epoch_second);
    // No id tiebreak upstream: rotate rows that share a second differently on each call.
    const same=rows.filter(r=>r.epoch_second===base+600),other=rows.filter(r=>r.epoch_second!==base+600),k=call++%same.length;
    return response([...other,...same.slice(k),...same.slice(0,k)].slice(0,500));
  };
  const r=await syncSubmissions(db,L,{platform:'atcoder',handle:'u',fetcher,sleep:async()=>{},now:new Date('2026-11-02T00:00:00Z')});
  assert.equal(r.status,'ok'); assert.equal(r.fetched,503);
  assert.equal(r.cursor,String(base+600));
  assert.equal((await listEntries(db,'platform_submissions',L)).length,503);
});

test('sync (atcoder): a judging submission holds the cursor; a late-crawled older submission is still found', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  const at=s=>new Date(s*1000).toISOString(),base=sec('2026-10-01T00:00:00Z');
  let all=[acItem(1,'AC',at(base)),acItem(2,'WJ',at(base+100)),acItem(3,'WA',at(base+200))];
  const fetcher=async url=>{const from=Number(new URL(url).searchParams.get('from_second'));return response(all.filter(s=>s.epoch_second>=from).slice(0,500));};
  const first=await syncSubmissions(db,L,{platform:'atcoder',handle:'u',fetcher,sleep:async()=>{},now:new Date('2026-11-02T00:00:00Z')});
  assert.equal(first.fetched,2); assert.equal(first.cursor,String(base+100),'cursor stays at the judging submission');
  // The judging one finishes, and the crawler adds an older submission (base+150) it had missed.
  all=[acItem(1,'AC',at(base)),acItem(2,'AC',at(base+100)),acItem(4,'TLE',at(base+150)),acItem(3,'WA',at(base+200))];
  const second=await syncSubmissions(db,L,{platform:'atcoder',handle:'u',fetcher,sleep:async()=>{},now:new Date('2026-11-02T01:00:00Z')});
  assert.equal(second.fetched,2); assert.equal(second.cursor,String(base+200));
  // Later than the overlap window, so a third run starts after it.
  all.push(acItem(5,'AC',at(base+300)));
  const third=await syncSubmissions(db,L,{platform:'atcoder',handle:'u',fetcher,sleep:async()=>{},now:new Date('2026-11-02T02:00:00Z')});
  assert.equal(third.fetched,1);
});

test('projection: an imported problem-day never hides another problem on the same date', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  await appendEvents(db,L,[importEvent(2,T('2026-11-01T02:00:00Z'))]);
  await appendLedger(db,L,{git_observations:[logObservation('log-b',T('2026-10-31T15:00:00Z'),'codeforces:1B')],
    platform_submissions:[sub(1,'wrong_answer',T('2026-11-01T01:00:00Z')),sub(2,'accepted',T('2026-11-01T02:00:00Z')),
      sub(3,'wrong_answer',T('2026-11-01T03:00:00Z'),'codeforces:1A'),sub(4,'accepted',T('2026-11-01T04:00:00Z'),'codeforces:1B')]});
  const {attempts}=await readLedger(db,L);
  assert.deepEqual(attempts.map(a=>[a.problem_key,a.id,a.outcome]).sort(),[
    ['codeforces:1A','subday:codeforces:1A:2026-11-01','failed'],
    ['codeforces:1B','log-b','independent'],
    ['codeforces:4A','import:codeforces:owner:2','independent']]);
  const imported=attempts.find(a=>a.problem_key==='codeforces:4A');
  assert.equal(imported.submissions,2); assert.equal(imported.failed_before_accept,1,'import keeps its id and gains the day counts');
});

test('projection: an import and submissions with other ids on the same problem-day stay one attempt', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  await appendEvents(db,L,[importEvent(7,T('2026-11-01T05:00:00Z'))]);
  await appendLedger(db,L,{platform_submissions:[sub(1,'wrong_answer',T('2026-11-01T01:00:00Z'))]});
  const {attempts}=await readLedger(db,L);
  assert.deepEqual(attempts.map(a=>[a.id,a.outcome,a.submissions]),[['import:codeforces:owner:7','independent',1]]);
});

test('sync rejects bad input and summaries read stored rows', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  await assert.rejects(syncSubmissions(db,L,{platform:'leetcode',handle:'h'}),/unsupported/);
  await assert.rejects(syncSubmissions(db,L,{platform:'codeforces',handle:'bad handle'}),/handle/);
  await assert.rejects(syncSubmissions(db,L,{platform:'codeforces',handle:'h',pages:0}),/pages/);
  await appendLedger(db,L,{platform_submissions:[sub(1,'accepted',T('2026-11-01T01:00:00Z'))]});
  const summary=summarizeSubmissions(await readLedger(db,L));
  assert.deepEqual(summary.counts,{codeforces:{submissions:1,accepted:1}});
  assert.equal(summary.recent[0].problem_key,'codeforces:4A');
});

test('preferences: platform_accounts is an additive validated key', async t=>{
  const db=createDatabase();t.after(()=>db.close());
  assert.equal('platform_accounts' in await getPreferences(db,L),false);
  const saved=await putPreferences(db,L,{platform_accounts:{codeforces:'tourist'}});
  assert.deepEqual(saved.platform_accounts,{codeforces:'tourist'});
  await assert.rejects(putPreferences(db,L,{platform_accounts:{leetcode:'x'}}),/platform accounts/);
  await assert.rejects(putPreferences(db,L,{platform_accounts:{codeforces:'a b'}}),/platform accounts/);
  await assert.rejects(putPreferences(db,L,{platform_accounts:[]}),/platform accounts/);
});

test('CLI: submissions sync stores the handle, uses an injected fetcher, list shows rows', async t=>{
  const root=mkdtempSync(join(tmpdir(),'sub-cli-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const dbPath=join(root,'l.sqlite3'),lines=[];
  const common=['--db',dbPath,'--learner','cli-test','--catalog-root',root];
  const items=[cfItem(2,'OK','2026-11-01T02:00:00Z'),cfItem(1,'WRONG_ANSWER','2026-11-01T01:00:00Z')];
  let calls=0;
  const fetcher=async url=>{calls++;return cfPages(items)(url);};
  const print=s=>lines.push(s);
  await assert.rejects(cli(['submissions','sync','--platform','codeforces',...common],{print,fetcher,sleep:async()=>{}}),/no handle/);
  assert.equal(calls,0,'no network without a handle');
  assert.equal(await cli(['submissions','sync','--platform','codeforces','--handle','tourist','--now','2026-11-02T00:00:00Z',...common],{print,fetcher,sleep:async()=>{}}),0);
  assert.equal(JSON.parse(lines.at(-1)).fetched,2);
  assert.equal(await cli(['submissions','sync','--platform','codeforces','--now','2026-11-02T01:00:00Z',...common],{print,fetcher,sleep:async()=>{}}),0,'handle remembered');
  assert.equal(JSON.parse(lines.at(-1)).fetched,0);
  assert.equal(await cli(['submissions','list',...common],{print}),0);
  const listing=JSON.parse(lines.at(-1));
  assert.deepEqual(listing.counts,{codeforces:{submissions:2,accepted:1}});
  assert.equal(listing.marks.length,2);
  assert.equal(await cli(['submissions','sync','--platform','codeforces','--now','2026-11-02T02:00:00Z',...common],{print,fetcher:async()=>response('x',500),sleep:async()=>{}}),4);
});
