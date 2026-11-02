/** Analytics Chrome/CDP evidence regression, authored attempts only. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {startLocal} from './local.mjs';
import {catalogFromData} from './mastery/catalog.mjs';
import {COMPANY_WINDOWS} from './mastery/company.mjs';
const temp=await mkdtemp(join(tmpdir(),'analytics-browser-')),output=resolve(process.env.SMOKE_OUTPUT_DIR??join(temp,'receipts'));await mkdir(output,{recursive:true});
const chrome=spawn(process.env.CHROME_BINARY??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--remote-debugging-port=0',`--user-data-dir=${join(temp,'chrome')}`,'about:blank'],{stdio:'ignore'});
let launchError;chrome.on('error',e=>{launchError=e;});const delay=ms=>new Promise(r=>setTimeout(r,ms));
const catalog=catalogFromData({problems:[1,2,3].flatMap(level=>[1,2,3].map(n=>({key:`leetcode:authored-${level}-${n}`,platform:'leetcode',title:`Authored ${level} ${n}`,url:`https://leetcode.com/problems/authored-${level}-${n}/`,difficulty_kind:'lc_level',difficulty_value:level,tags:['arrays'],variation_group:`v${n}`,concepts:[{id:'arrays-hashing',status:'approved'}]})))});
const layer={available:true,version:'company-fixture',sha256:'fixture-hash',meta:{commit_date:'2026-10-29',upstream_url:'https://example.invalid'},companies:[{company_id:'example',name:'Example'}],lists:new Map([['example',new Map(COMPANY_WINDOWS.map(w=>[w,w==='all'?[...catalog.problems.keys()].map((problem_key,i)=>({problem_key,rank:i+1,frequency:10})):[]]))]]),unmatched:new Map()};
let service,socket;const errors=[];
try{
 let port;for(let i=0;i<100;i++){if(launchError)throw launchError;try{port=(await readFile(join(temp,'chrome/DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await delay(100);}}assert.ok(port,'Chrome did not start');
 service=await startLocal({port:0,database:':memory:',curriculum:{schema_version:1,curriculum_version:'fixture',problems:[],relationships:[]},catalogProvider:()=>catalog,companyProvider:()=>layer,autoGitSync:false});
 for(let i=0;i<18;i++){
  const occurredAt=new Date(Date.now()-(i+1)*86400_000).toISOString();
  const response=await fetch(service.url+'/api/journal/attempt',{method:'POST',headers:{origin:service.url,'content-type':'application/json'},body:JSON.stringify({event_id:'analytics-authored-'+i,problem_key:`leetcode:authored-${i%3+1}-${i%3+1}`,outcome:i%4===0?'failed':'independent',hints:i%4===0?null:false,self_minutes:i%2===0?10:null,occurred_at:occurredAt,activity_type:'practice'})});
  assert.equal(response.status,201,await response.text());
 }
 const target=await(await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(service.url)}`,{method:'PUT'})).json();socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let seq=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(60);}throw Error('Timed out: '+expression);};
 const click=label=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(label)})).click()`);
 await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await wait("document.querySelector('#app').getAttribute('aria-busy')==='false' && document.querySelector('[data-view=analytics]')");await evaluate("document.querySelector('[data-view=analytics]').click()");
 await wait("document.querySelector('.analytics-overview')");
 await evaluate("const period=document.querySelector('[aria-label=\"분석 기간\"]');period.value='';period.dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("document.querySelectorAll('.analytics-overview .metric-value')[1].textContent"),'18');
 assert.ok(await evaluate("document.querySelector('.analytics-overview').textContent.includes('9/18회 기록')"));
 await evaluate("document.querySelector('.analytics-overview button').click()");await wait("document.querySelector('.problem-inspector')");
 assert.ok(await evaluate("document.querySelector('.problem-inspector').textContent.includes('원본 항목')"));await evaluate("document.querySelector('[aria-label=\"상세 닫기\"]').click()");
 await evaluate("document.querySelector('.analytic-bar-row').click()");await wait("document.querySelector('.problem-inspector')");await evaluate("document.querySelector('[aria-label=\"상세 닫기\"]').click()");
 await evaluate("document.querySelector('.activity-map-cell').focus()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});assert.ok(await evaluate("document.activeElement.matches('.activity-map-cell')"));
 for(const [width,height]of [[1280,800],[1440,900]]){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'analytics-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 assert.deepEqual(errors,[]);const receipt={synthetic:true,checks:['18 authored attempts aggregate','partial self-reported time coverage','metric original-record drill','chart record selection','keyboard heatmap focus','1280/1440 no horizontal overflow'],runtime_errors:errors};await writeFile(join(output,'analytics-browser.receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({...receipt,output}));
}finally{socket?.close();await service?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await new Promise(r=>{chrome.once('exit',r);setTimeout(r,3000);});await rm(join(temp,'chrome'),{recursive:true,force:true});}
