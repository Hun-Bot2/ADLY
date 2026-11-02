/** Full redesign visual/interaction audit. All learner and company data below are authored fixtures. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {startDesktop} from './dev.mjs';
import {startLocal} from '../hosted/local.mjs';
import {catalogFromData} from '../hosted/mastery/catalog.mjs';
import {appendEvents} from '../hosted/core/store.mjs';
import {putPreferences} from '../hosted/core/store.mjs';
import {localDate,shiftDate} from '../hosted/public/workspace-data.mjs';
const root=await mkdtemp(join(tmpdir(),'mastery-redesign-')),output=resolve(process.env.SMOKE_OUTPUT_DIR??join(root,'screenshots'));await mkdir(output,{recursive:true});
const token='authored-visual-fixture-token-0000000000000000',learner='visual-fixture',today=localDate(new Date()),yesterday=shiftDate(today,-1),clock=new Date();
const techniques=['arrays-hashing','two-pointers','binary-search','dynamic-programming','graph-traversal'];
const names=['배열과 해시의 경계 조건','Two Pointers on a Sorted Sequence','접두 합과 범위 질의','Binary Search with Duplicate Values','Sliding Window Frequency Counter','Graph Traversal — Connected Components','Longest Increasing Subsequence','스택으로 괄호 구조 검사','Heap Scheduling with Equal Priorities','회전된 정렬 배열 탐색','Stable Partition of Repeated Elements','같은 원소를 포함한 부분 집합','Dynamic Programming on a Small Grid','원형 큐의 삽입과 삭제','Prefix Tree for Word Lookup','Greedy Choice with Interval Boundaries','Disjoint Sets and Connectivity','Bitmask State Transitions'];
const problems=Array.from({length:42},(_,i)=>({key:'leetcode:authored-'+i,platform:'leetcode',title:names[i%names.length]+(i>=names.length?' '+(Math.floor(i/names.length)+1):''),url:'https://leetcode.com/problems/authored-'+i+'/',difficulty_kind:'lc_level',difficulty_value:1+Math.floor(i/14),tags:[['array','two-pointers','binary-search','dynamic-programming','graph'][i%5]],variation_group:'v'+i,concepts:[{id:techniques[i%5],status:'approved'}]}));
problems.push({key:'atcoder:abc999_a',platform:'atcoder',title:'Authored AtCoder Practice',url:'https://atcoder.jp/contests/abc999/tasks/abc999_a',difficulty_kind:'atc_irt',difficulty_value:240,tags:['math'],concepts:[{id:'math-geometry',status:'ai_reviewed'}]},{key:'codeforces:999A',platform:'codeforces',title:'Authored Codeforces Practice',url:'https://codeforces.com/problemset/problem/999/A',difficulty_kind:'cf_rating',difficulty_value:800,tags:['greedy'],concepts:[{id:'greedy',status:'ai_reviewed'}]});
const catalog=catalogFromData({version:'authored-redesign',problems,concepts:techniques.map(id=>({id,label:id}))});
const companies=[['example','Example Systems'],['northstar','Northstar Labs'],['hanbit','한빛 소프트웨어'],['atlas','Atlas Research']].map(([company_id,name])=>({company_id,name}));
const layer={available:true,version:'company-authored',sha256:'fixture-only',meta:{commit_date:'2026-10-29',upstream_url:'https://example.invalid/authored-fixture'},companies,lists:new Map(companies.map((c,index)=>[c.company_id,new Map(['30d','3m','6m','gt6m','all'].map(window=>[window,problems.filter(p=>p.platform==='leetcode').slice(index*3,index*3+26).map((p,i)=>({problem_key:p.key,rank:i+1,frequency:100-i}))]))])),unmatched:new Map(companies.map(c=>[c.company_id+'|all',3]))};
let researchAvailable=true;
const researchProblems=problems.slice(0,4).map(p=>({problem_key:p.key,native_key:p.key,title:p.title,platform:p.platform,original_url:p.url,source_tags:p.tags,source_dataset:'authored-fixture',source_revision:'fixture-v1',license:'Project-authored test input',collection_status:'authored fixture only',constraints_status:'not applicable',input_provenance:'authored test fields',input_views:{idea_rationale:'이 문장은 UI 검증을 위해 직접 작성한 합성 입력입니다.'}}));
const comparisonFetcher=async value=>{const url=new URL(value),key=url.searchParams.get('key')??researchProblems[0].problem_key,source=researchProblems.find(p=>p.problem_key===key)??researchProblems[0];if(!researchAvailable)return new Response('',{status:503});
 if(url.pathname==='/api/meta')return Response.json({scope:'authored',scopes:{authored:'합성 검증 자료'},methods:{title:{label:'저장된 제목 표현',description:'합성 UI 검증용 순위',score_label:'합성 저장 점수'},tags:{label:'저장된 태그 비교',description:'서로 다른 순위의 합성 검증',score_label:'합성 저장 점수'}},default_key:source.problem_key,default_a:'title',default_b:'tags',coverage:'합성 테스트 자료 4개 · 실제 학습자 결과가 아닙니다.',notice:'유사도는 학습 추천 또는 알고리즘 동등성의 근거가 아닙니다.',footer:'읽기 전용 합성 검증'});
 if(url.pathname==='/api/search')return Response.json(researchProblems.filter(p=>p.title.toLowerCase().includes((url.searchParams.get('q')??'').toLowerCase())));
 if(url.pathname==='/api/problem')return Response.json(source);
 if(url.pathname==='/api/compare'){const rows=researchProblems.filter(p=>p.problem_key!==source.problem_key);return Response.json({source,methods:{title:rows.map((p,i)=>({...p,score:0.9-i*0.2})),tags:[...rows].reverse().map((p,i)=>({...p,score:0.8-i*0.2}))}});}
 if(url.pathname==='/api/map')return Response.json({available:true,algorithm:'authored fixture coordinates',k:3,neighbor_preservation:null,points:researchProblems.map((p,i)=>({...p,x:0.12+i*0.23,y:[0.2,0.8,0.45,0.65][i]})),neighbors:Object.fromEntries(researchProblems.map(p=>[p.problem_key,researchProblems.filter(q=>q.problem_key!==p.problem_key).map(q=>q.problem_key)]))});
 return new Response('<!doctype html><title>Authored source document</title><p>합성 검증 문서</p>',{headers:{'content-type':'text/html'}});
};
let desktop,engine,socket;const connection={url:'http://127.0.0.1:1',token},errors=[],networkFailures=[],receipts=[];
const chrome=spawn(process.env.CHROME_BINARY??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--remote-debugging-port=0',`--user-data-dir=${join(root,'chrome')}`,'about:blank'],{stdio:'ignore'});let launchError;chrome.on('error',e=>launchError=e);const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 desktop=await startDesktop({appData:join(root,'app'),catalogRoot:join(root,'catalogs'),engineConnection:connection});
 engine=await startLocal({port:0,database:join(root,'learner.sqlite3'),learnerId:learner,curriculum:{schema_version:1,curriculum_version:'authored',problems:[],relationships:[]},appToken:token,allowedOrigin:desktop.url,catalogProvider:()=>catalog,companyProvider:()=>layer,comparisonFetcher,autoGitSync:false});connection.url=engine.url;
 const events=[];
 for(let i=0;i<50;i++){
  const day=i<25?yesterday:shiftDate(today,-(i-23)),time=new Date(`${day}T${String(8+i%12).padStart(2,'0')}:15:00+09:00`).toISOString(),p=problems[i%problems.length],solved=i%4!==0;
  events.push({schema_version:1,event_id:'authored-attempt-'+i,learner_id:learner,kind:'attempt',source:'manual',occurred_at:time,recorded_at:clock.toISOString(),supersedes:null,payload:{problem_key:p.key,outcome:solved?'independent':'failed',hints:solved?false:null,activity_type:'practice',...(i%3?{self_minutes:12+i%18}:{})}});
 }
 for(let i=0;i<3;i++){const time=new Date(Math.min(Date.now()-(i+1)*60000,Date.parse(`${today}T10:00:00+09:00`))).toISOString();events.push({schema_version:1,event_id:'authored-today-'+i,learner_id:learner,kind:'attempt',source:'manual',occurred_at:time,recorded_at:clock.toISOString(),supersedes:null,payload:{problem_key:problems[36+i].key,outcome:i?'independent':'failed',hints:i?false:null,activity_type:'practice'}});}
 await appendEvents(engine.db,learner,events);await putPreferences(engine.db,learner,{review_targets:[{problem_key:problems[1].key,date:shiftDate(today,-3)}]});
 const request=async(path,body)=>{const response=await fetch(engine.url+path,{method:'POST',headers:{Origin:desktop.url,'X-App-Token':token,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw Error(path+': '+await response.text());return response.json();};
 for(const [index,offset]of [[0,48],[1,-1],[2,-72]]){const starts=new Date(Date.now()+offset*3600000),ends=new Date(starts.getTime()+2*3600000);await request('/api/contests/manual',{id:'authored-contest-'+index,platform:['atcoder','codeforces','leetcode'][index],title:['AtCoder Beginner Contest — Authored Schedule','Codeforces Round with a Very Long Authored Title to Verify Ellipsis','LeetCode Weekly Authored Schedule'][index],url:['https://atcoder.jp/contests/abc999','https://codeforces.com/contest/999','https://leetcode.com/contest/weekly-contest-999/'][index],start_at:starts.toISOString(),duration_minutes:120,suitable:false})}
 let port;for(let i=0;i<100;i++){if(launchError)throw launchError;try{port=(await readFile(join(root,'chrome/DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await delay(80);}}assert.ok(port,'Chrome failed to start');
 const target=await(await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(desktop.url)}`,{method:'PUT'})).json();socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((yes,no)=>{socket.addEventListener('open',yes,{once:true});socket.addEventListener('error',no,{once:true});});let seq=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Network.responseReceived'&&m.params.response.status===404)networkFailures.push(m.params.response.url);});
 const call=(method,params={})=>new Promise((yes,no)=>{const id=++seq;pending.set(id,{resolve:yes,reject:no});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<160;i++){if(await evaluate(expression))return;await delay(80);}throw Error('Timed out: '+expression+'; '+await evaluate("document.querySelector('#notice')?.textContent"));};
 await call('Runtime.enable');await call('Network.enable');if(process.env.SMOKE_COLOR_SCHEME)await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:process.env.SMOKE_COLOR_SCHEME}]});
 const inner="document.querySelector('#learning-frame').contentDocument";
 for(const [width,height]of [[1440,900],[1280,800],[1536,960]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await wait("document.querySelector('#desktop-navigation [data-view=dashboard]') && document.querySelector('#connection').textContent==='엔진 연결됨'");
  for(const route of ['dashboard','calendar','explorer','analytics','contests','company','research','workspace']){
   await evaluate(`document.querySelector('#desktop-navigation [data-view="${route}"]').click()`);
   if(route==='workspace')await wait("!document.querySelector('#tools').hidden && document.querySelector('.cm-editor')");
   else{await wait(`${inner}?.querySelector('#app')?.getAttribute('aria-busy')==='false'`);await wait(`${inner}?.querySelector('.page-heading')`);await evaluate(`${inner}.fonts.ready`);}
   if(route==='calendar'){await wait(`${inner}.querySelector('.calendar-grid')`);await evaluate(`${inner}.querySelector('[data-date="${yesterday}"] .calendar-date').click()`);await wait(`${inner}.querySelector('.problem-inspector')`);assert.ok(await evaluate(`${inner}.querySelectorAll('.problem-inspector .workspace-row').length>=25`));assert.ok(await evaluate(`${inner}.querySelectorAll('.problem-inspector .event-symbol svg[data-icon]').length>=25`));assert.equal(await evaluate(`${inner}.querySelectorAll('[data-date="${yesterday}"] .activity-dot').length<=5`),true,'dense day keeps a bounded dot row');await evaluate(`${inner}.querySelector('.inspector-close').click()`);}
   if(route==='explorer')await wait(`${inner}.querySelectorAll('.explorer-row').length>1`);
   if(route==='company')await wait(`${inner}.querySelector('.company-detail-heading')`);
   if(route==='research')await wait(`${inner}.querySelectorAll('.research-ranking').length===2`);
   if(route==='analytics'){await wait(`${inner}.querySelector('.analytics-overview')`);assert.ok(await evaluate(`${inner}.querySelectorAll('.activity-map-cell[data-date]').length>=365`));}
   await evaluate('document.fonts.ready');await delay(200);
   const overflow=await evaluate(`(()=>{const d=${route==='workspace'?'document':inner};return {page:d.documentElement.scrollWidth>d.documentElement.clientWidth+2,body:d.body.scrollWidth>d.documentElement.clientWidth+2,font:d.defaultView.getComputedStyle(d.body).fontFamily};})()`);assert.equal(overflow.page,false,route+' horizontal page overflow at '+width);assert.ok(overflow.font.includes('system-ui'));
   const image=await call('Page.captureScreenshot',{format:'png'});const file=route+'-'+width+'x'+height+'.png';await writeFile(join(output,file),Buffer.from(image.data,'base64'));receipts.push({route,width,height,file,horizontal_overflow:false,font:overflow.font});
  }
 }
 await evaluate("document.querySelector('#desktop-navigation [data-view=research]').click()");await wait(`${inner}.querySelectorAll('.research-candidate').length===6`);
 await evaluate(`${inner}.querySelector('.research-candidate').click()`);await wait(`${inner}.querySelector('.research-choice').textContent.includes('입력·출처 비교')`);
 await evaluate(`[...${inner}.querySelectorAll('button')].find(b=>b.textContent==='입력·출처 비교').click()`);await wait(`${inner}.querySelectorAll('.research-problem-evidence').length===2`);
 await evaluate(`[...${inner}.querySelectorAll('button')].find(b=>b.textContent==='유사도 지도').click()`);await wait(`${inner}.querySelectorAll('.research-map').length===2`);
 assert.equal(await evaluate(`${inner}.querySelector('.research-map').querySelectorAll('.research-map-point').length`),4);
 researchAvailable=false;await evaluate("document.querySelector('#desktop-navigation [data-view=dashboard]').click();document.querySelector('#desktop-navigation [data-view=research]').click()");await wait(`${inner}.querySelector('.empty-state')`);
 assert.ok(await evaluate(`${inner}.querySelector('.empty-state').textContent.includes('비교 서비스를 사용할 수 없습니다')`));
 assert.deepEqual(errors,[]);assert.deepEqual(networkFailures.filter(url=>!url.endsWith('/favicon.ico')),[]);
 const report={synthetic:true,screen_count:receipts.length,screens:receipts,research_interactions:['stored ranking selection','source comparison','stored map points','unavailable retry state'],runtime_errors:errors,missing_assets:networkFailures,notes:['Authored fixture counts are not learner outcomes','Research backend unavailability is an honest empty state; live private research is not bundled']};await writeFile(join(output,'redesign-visual.receipt.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,...report}));
}finally{socket?.close();await desktop?.close();await engine?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(3000)]);await rm(join(root,'chrome'),{recursive:true,force:true});}
