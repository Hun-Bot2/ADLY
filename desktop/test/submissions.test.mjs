// Submission capture S6-S7 end to end: real engine (temporary DB, authored catalog, mocked Codeforces API) and the
// desktop bridge writing the user's daily logs. No network, no real learner data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {startDesktop} from '../dev.mjs';
import {startLocal} from '../../hosted/local.mjs';
import {catalogFromData} from '../../hosted/mastery/catalog.mjs';
import {readLedger} from '../../hosted/mastery/ledger.mjs';

const catalog=catalogFromData({problems:[
  {key:'codeforces:4A',platform:'codeforces',title:'Watermelon',url:'https://codeforces.com/problemset/problem/4/A'},
  {key:'codeforces:1B',platform:'codeforces',title:'Spreadsheets',url:'https://codeforces.com/problemset/problem/1/B'},
  {key:'codeforces:2C',platform:'codeforces',title:'Commentator problem',url:'https://codeforces.com/problemset/problem/2/C'},
  ...Array.from({length:12},(_,i)=>({key:`codeforces:${100+i}A`,platform:'codeforces',title:`Authored ${i}`,url:`https://codeforces.com/problemset/problem/${100+i}/A`})),
]});
const sec=iso=>Date.parse(iso)/1000;
let nextId=1;
const cf=(contestId,index,verdict,at)=>({id:nextId++,contestId,creationTimeSeconds:sec(at),problem:{contestId,index},programmingLanguage:'Python 3',verdict,passedTestCount:1,timeConsumedMillis:15,memoryConsumedBytes:0});
const freePort=()=>new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>resolve(port));});});

test('sync from the settings commands, append only missing problem-days to the daily logs, ingest without double counting',async t=>{
  const root=mkdtempSync(join(tmpdir(),'aldy submissions 한 '));t.after(()=>rmSync(root,{recursive:true,force:true}));
  // Newest first, like user.status. 11-01 KST: 4A (already named in the log with an empty result) and 1B; 11-02: 2C; a gym problem.
  let submissions=[cf(2,'C','WRONG_ANSWER','2026-11-02T03:00:00Z'),cf(1,'B','OK','2026-11-01T02:00:00Z'),cf(4,'A','OK','2026-11-01T01:30:00Z'),
    cf(4,'A','WRONG_ANSWER','2026-11-01T01:00:00Z'),cf(100001,'A','OK','2026-11-01T00:30:00Z')].sort((a,b)=>b.id-a.id);
  const urls=[];
  const submissionFetcher=async url=>{urls.push(url);const u=new URL(url),from=Number(u.searchParams.get('from')),count=Number(u.searchParams.get('count'));
    return {ok:true,status:200,text:async()=>JSON.stringify({status:'OK',result:submissions.slice(from-1,from-1+count)})};};
  const port=await freePort(),origin=`http://127.0.0.1:${port}`,token='t'.repeat(40);
  const engine=await startLocal({port:0,database:join(root,'learner.sqlite3'),curriculum:{schema_version:1,curriculum_version:'fixture',problems:[],relationships:[]},
    apiOnly:true,appToken:token,allowedOrigin:origin,autoGitSync:false,catalogProvider:()=>catalog,submissionFetcher,submissionSleep:async()=>{}});
  t.after(()=>engine.close());
  const app=await startDesktop({port,appData:join(root,'app'),catalogRoot:root,engineConnection:{url:engine.url,token}});
  t.after(()=>app.close());
  const command=async(name,input={})=>{const r=await fetch(app.url+'/desktop/api/command',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','X-Desktop-Token':app.token},body:JSON.stringify({command:name,...input})});
    const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;};

  const before=await command('submissions-status');
  assert.deepEqual(before.platforms.codeforces,{handle:null,counts:{submissions:0,accepted:0},last:null});
  assert.equal(urls.length,0,'reading the status never touches the network');

  const repo=await command('create',{path:join(root,'solutions')});
  execFileSync('git',['-C',repo.path,'config','user.name','Fixture']);execFileSync('git',['-C',repo.path,'config','user.email','fixture@example.invalid']);
  mkdirSync(join(repo.path,'codeforces'),{recursive:true});
  const existing='# 2026-11-01\n\n| Problem | Result | Time | Review | Memo |\n| --- | --- | --- | --- | --- |\n| https://codeforces.com/problemset/problem/4/A |  |  | 1 | my note |\n\n## Watermelon\n';
  writeFileSync(join(repo.path,'codeforces/26-11-01.md'),existing);

  const synced=await command('submissions-sync',{platform:'codeforces',handle:'fixture_user'});
  assert.equal(synced.status,'ok');assert.equal(synced.fetched,5);
  const status=await command('submissions-status');
  assert.equal(status.platforms.codeforces.handle,'fixture_user','handle remembered in preferences');
  assert.deepEqual(status.platforms.codeforces.counts,{submissions:5,accepted:3});
  assert.equal(status.platforms.codeforces.last.status,'ok');

  const written=await command('submissions-log',{repoId:repo.id});
  assert.equal(written.written,true);assert.equal(written.rows,2);assert.deepEqual(written.paths.sort(),['codeforces/26-11-01.md','codeforces/26-11-02.md']);
  const day1=readFileSync(join(repo.path,'codeforces/26-11-01.md'),'utf8');
  assert.ok(day1.startsWith(existing.split('\n\n## ')[0].trimEnd()+'\n| https://codeforces.com/problemset/problem/1/B | 1 | | 0 | |\n'),'existing row untouched; new row appended inside the table');
  assert.ok(day1.endsWith('## Watermelon\n'));
  assert.equal((day1.match(/problem\/4\/A/g)??[]).length,1,'a problem already named in the table gets no second row');
  const day2=readFileSync(join(repo.path,'codeforces/26-11-02.md'),'utf8');
  assert.match(day2,/^# 2026-11-02\n/);assert.match(day2,/\| https:\/\/codeforces\.com\/problemset\/problem\/2\/C \| 0 \| \| 0 \| \|/);
  assert.ok(!existsSync(join(repo.path,'codeforces/26-11-00.md')));
  assert.equal(execFileSync('git',['-C',repo.path,'status','--porcelain']).toString().includes('codeforces/'),true,'files are written but not committed');

  const again=await command('submissions-log',{repoId:repo.id});
  assert.equal(again.rows,0,'idempotent: the rows are now in the tables');

  // Commit through the Git panel command; ingestion must not double count the problem-days.
  const committed=await command('commit',{repoId:repo.id,paths:['codeforces/26-11-01.md','codeforces/26-11-02.md'],message:'study: synced'});
  assert.notEqual(committed.ingestion?.status,'error',JSON.stringify(committed.ingestion));
  const {attempts}=await readLedger(engine.db,'local-owner');
  const byDay=attempts.map(a=>`${a.problem_key}|${a.id.startsWith('subday:')?'sub':a.table}|${a.outcome}|${a.submissions??'-'}`).sort();
  assert.deepEqual(byDay,['codeforces:100001A|sub|independent|1','codeforces:1B|git_observations|independent|1','codeforces:2C|git_observations|failed|1','codeforces:4A|sub|independent|2'],
    'one attempt per problem-day: 1B and 2C merge into their new log rows; 4A (empty result in the log) and the gym problem stay submission attempts');
});

test('a large backfill returns counts first and writes only after confirmation; a file with an unsaved draft is skipped',async t=>{
  const root=mkdtempSync(join(tmpdir(),'aldy submissions confirm '));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const submissions=Array.from({length:12},(_,i)=>cf(100+i,'A','OK',`2026-10-${String(10+i).padStart(2,'0')}T03:00:00Z`)).sort((a,b)=>b.id-a.id);
  const submissionFetcher=async url=>{const u=new URL(url),from=Number(u.searchParams.get('from'));return {ok:true,status:200,text:async()=>JSON.stringify({status:'OK',result:submissions.slice(from-1,from+99)})};};
  const port=await freePort(),origin=`http://127.0.0.1:${port}`,token='u'.repeat(40);
  const engine=await startLocal({port:0,database:join(root,'learner.sqlite3'),curriculum:{schema_version:1,curriculum_version:'fixture',problems:[],relationships:[]},
    apiOnly:true,appToken:token,allowedOrigin:origin,autoGitSync:false,catalogProvider:()=>catalog,submissionFetcher,submissionSleep:async()=>{}});
  t.after(()=>engine.close());
  const app=await startDesktop({port,appData:join(root,'app'),catalogRoot:root,engineConnection:{url:engine.url,token}});
  t.after(()=>app.close());
  const command=async(name,input={})=>{const r=await fetch(app.url+'/desktop/api/command',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','X-Desktop-Token':app.token},body:JSON.stringify({command:name,...input})});
    const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;};
  const repo=await command('create',{path:join(root,'solutions')});
  // An open, edited (unsaved) log for 10-10 must not be rewritten underneath the editor.
  mkdirSync(join(repo.path,'codeforces'),{recursive:true});
  const disk='# 2026-10-10\n\n| Problem | Result | Time | Review | Memo |\n| --- | --- | --- | --- | --- |\n';
  writeFileSync(join(repo.path,'codeforces/26-10-10.md'),disk);
  await command('draft',{repoId:repo.id,path:'codeforces/26-10-10.md',content:disk+'| typing in progress |'});
  assert.equal((await command('submissions-sync',{platform:'codeforces',handle:'fixture_user'})).fetched,12);
  const ask=await command('submissions-log',{repoId:repo.id});
  assert.equal(ask.needsConfirmation,true);assert.equal(ask.written,false);assert.equal(ask.files,11);assert.equal(ask.rows,11);
  assert.deepEqual(ask.skipped_drafts,['codeforces/26-10-10.md']);
  assert.equal(existsSync(join(repo.path,'codeforces/26-10-11.md')),false,'nothing written before confirmation');
  const done=await command('submissions-log',{repoId:repo.id,confirmed:true});
  assert.equal(done.written,true);assert.equal(done.rows,11);
  assert.equal(readFileSync(join(repo.path,'codeforces/26-10-10.md'),'utf8'),disk,'file with an unsaved draft left untouched');
  assert.match(readFileSync(join(repo.path,'codeforces/26-10-21.md'),'utf8'),/problem\/111\/A \| 1 \|/);
});
