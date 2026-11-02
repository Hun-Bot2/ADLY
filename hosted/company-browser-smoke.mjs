/** Synthetic company preparation Chrome/CDP smoke; no learner data or live providers. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {startLocal} from './local.mjs';
import {catalogFromData} from './mastery/catalog.mjs';
import {COMPANY_WINDOWS} from './mastery/company.mjs';
const temp=await mkdtemp(join(tmpdir(),'company-browser-')),output=resolve(process.env.SMOKE_OUTPUT_DIR??join(temp,'receipts'));await mkdir(output,{recursive:true});
const chrome=spawn(process.env.CHROME_BINARY??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--remote-debugging-port=0',`--user-data-dir=${join(temp,'chrome')}`,'about:blank'],{stdio:'ignore'});
let launchError;chrome.on('error',e=>{launchError=e;});const delay=ms=>new Promise(r=>setTimeout(r,ms));
const catalog=catalogFromData({problems:[1,2,3].flatMap(level=>[1,2,3].map(n=>({key:`leetcode:authored-${level}-${n}`,platform:'leetcode',title:`Authored ${level} ${n}`,url:`https://leetcode.com/problems/authored-${level}-${n}/`,difficulty_kind:'lc_level',difficulty_value:level,tags:['arrays'],variation_group:`v${n}`,concepts:[{id:'arrays-hashing',status:'approved'}]})))});
const layer={available:true,version:'company-fixture',sha256:'fixture-hash',meta:{commit_date:'2026-10-29',upstream_url:'https://example.invalid'},companies:[{company_id:'example',name:'Example'}],lists:new Map([['example',new Map(COMPANY_WINDOWS.map(w=>[w,w==='all'?[...catalog.problems.keys()].map((problem_key,i)=>({problem_key,rank:i+1,frequency:10})):[]]))]]),unmatched:new Map()};
let service,socket;const errors=[];
try{
 let port;for(let i=0;i<100;i++){if(launchError)throw launchError;try{port=(await readFile(join(temp,'chrome/DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await delay(100);}}assert.ok(port,'Chrome did not start');
 service=await startLocal({port:0,database:':memory:',curriculum:{schema_version:1,curriculum_version:'fixture',problems:[],relationships:[]},catalogProvider:()=>catalog,companyProvider:()=>layer,autoGitSync:false});
 const target=await(await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(service.url)}`,{method:'PUT'})).json();socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let seq=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(60);}throw Error('Timed out: '+expression);};
 const click=label=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(label)})).click()`);
 await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await wait("document.querySelector('#app').getAttribute('aria-busy')==='false' && document.querySelector('[data-view=company]')");await evaluate("document.querySelector('[data-view=company]').click()");
 await wait("document.querySelector('#app').textContent.includes('개념별 학습 기록')");
 assert.ok(await evaluate("document.querySelector('#app').textContent.includes('실제 면접 출제를 의미하지 않습니다')"));
 await click('이 회사에 집중');await wait("document.querySelector('#app').getAttribute('aria-busy')==='false' && document.querySelector('#app').textContent.includes('개념별 학습 기록')");
 assert.equal((await(await fetch(service.url+'/api/state')).json()).preferences.mastery.company_focus.company_id,'example');
 // Month cells show dots only since the calendar redesign; company-scoped plan rows render on the dashboard.
 await evaluate("document.querySelector('[data-view=dashboard]').click()");await wait("Boolean(document.querySelector('.company-badge'))");
 await evaluate("document.querySelector('[data-view=company]').click()");await wait("document.querySelector('#app').textContent.includes('개념별 학습 기록')");await click('기업 모의 면접 만들기');await wait("document.querySelector('#app').textContent.includes('기업 모의 면접') && document.querySelector('#app').textContent.includes('45분')");
 const screenshot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'company-1280.png'),Buffer.from(screenshot.data,'base64'));assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});const large=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'company-1440.png'),Buffer.from(large.data,'base64'));assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
 await click('일반 학습으로 돌아가기');await wait("document.querySelector('#app').getAttribute('aria-busy')==='false' && document.querySelector('#app').textContent.includes('개념별 학습 기록')");assert.equal((await(await fetch(service.url+'/api/state')).json()).preferences.mastery.company_focus,null);
 layer.available=false;await evaluate("document.querySelector('[data-view=calendar]').click();document.querySelector('[data-view=company]').click()");await wait("document.querySelector('#app').textContent.includes('company data not available for this catalog version')");
 assert.deepEqual(errors,[]);const receipt={synthetic:true,checks:['company list/progress/provenance','save focus','dashboard company badge','create mock','reset general','missing layer'],runtime_errors:errors};await writeFile(join(output,'company-browser.receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({...receipt,output}));
}finally{socket?.close();await service?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await new Promise(r=>{chrome.once('exit',r);setTimeout(r,3000);});await rm(join(temp,'chrome'),{recursive:true,force:true});}
