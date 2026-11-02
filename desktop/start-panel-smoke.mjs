/** New-user start panel with a mocked native GitHub bridge; synthetic engine and disposable folders only (NW-1..NW-6). */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {startDesktop} from './dev.mjs';
import {startLocal} from '../hosted/local.mjs';
import {catalogFromData} from '../hosted/mastery/catalog.mjs';
const temp=await mkdtemp(join(tmpdir(),'start-panel-')),output=resolve(process.env.SMOKE_OUTPUT_DIR??join(temp,'receipts'));await mkdir(output,{recursive:true});
const chrome=spawn(process.env.CHROME_BINARY??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-sync','--disable-extensions','--remote-debugging-port=0',`--user-data-dir=${join(temp,'chrome')}`,'about:blank'],{stdio:'ignore'});
let launchError;chrome.on('error',error=>{launchError=error;});const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),errors=[],checks=[];let desktop,engine,socket;
// The mock stands in for desktop/src-tauri: it never sees a token, exactly like the renderer.
const bridge=parent=>`(()=>{let signed=false;window.__created=[];Object.defineProperty(window,'algorithmNativeAuth',{value:Object.freeze({githubClientId:'Iv1.fixture',
 status:async()=>({signedIn:signed}),begin:async()=>({flowId:'flow',user_code:'ABCD-1234',verification_uri:'https://github.com/login/device',expires_in:900,interval:5}),
 complete:async()=>{await new Promise(r=>setTimeout(r,400));signed=true;return {signedIn:true};},signOut:async()=>{signed=false;return {signedIn:false};},
 githubRepositories:async()=>({login:'fixture-user',repositories:[{fullName:'fixture-user/algorithm-solution',name:'algorithm-solution',cloneUrl:'https://github.com/fixture-user/algorithm-solution.git',private:true,updatedAt:''}]}),
 githubCreateRepository:async({name,private:hidden})=>{window.__created.push({name,hidden});return {fullName:'fixture-user/'+name,name,cloneUrl:'https://github.com/fixture-user/'+name+'.git',private:hidden};},
 pickFolder:async()=>${JSON.stringify(parent)},appearance:async()=>{}})});})();`;
try{
 let port;for(let i=0;i<100;i++){if(launchError)throw launchError;try{port=(await readFile(join(temp,'chrome/DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(100);}}assert.ok(port,'Chrome did not start');
 const token='0123456789abcdef0123456789abcdef',connection={url:'http://127.0.0.1:1',token};
 desktop=await startDesktop({appData:join(temp,'app-data'),catalogRoot:join(temp,'empty-catalogs'),engineConnection:connection});
 const catalog=catalogFromData({problems:[{key:'leetcode:authored',platform:'leetcode',title:'Authored fixture',url:'https://leetcode.com/problems/authored/',difficulty_kind:'lc_level',difficulty_value:1,tags:['arrays'],concepts:[{id:'arrays-hashing',status:'approved'}]}]});
 engine=await startLocal({port:0,database:':memory:',curriculum:{schema_version:1,curriculum_version:'fixture',problems:[],relationships:[]},appToken:token,allowedOrigin:desktop.url,catalogProvider:()=>catalog,companyProvider:()=>({available:false}),autoGitSync:false});connection.url=engine.url;
 const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let seq=0;const pending=new Map();socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const job=pending.get(m.id);pending.delete(m.id);m.error?job.reject(Error(m.error.message)):job.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<180;i++){if(await evaluate(expression))return;await pause(70);}throw Error('Timed out: '+expression+'; '+await evaluate("document.querySelector('#notice')?.textContent"));};
 const parent=join(temp,'picked');await mkdir(parent);
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:bridge(parent)});await call('Page.navigate',{url:desktop.url+'#workspace'});
 await wait("document.querySelector('#connection')?.textContent==='엔진 연결됨'");
 await wait("!document.querySelector('#workspace-start').hidden && document.querySelector('#code-layout').classList.contains('no-repository')");
 assert.equal(await evaluate("document.querySelector('#start-github-sign-in').hidden"),false);assert.equal(await evaluate("document.querySelector('.start-repo-select').hidden"),true);
 checks.push('no repository: start panel replaces explorer and editor, sign-in offered with the built-in client ID');
 await evaluate("document.querySelector('#start-github-sign-in').click()");await wait("document.querySelector('#start-github-device strong')?.textContent==='ABCD-1234'");
 assert.equal(await evaluate("document.querySelector('#start-github-device a').href"),'https://github.com/login/device');
 const signing=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'start-panel-device-code.png'),Buffer.from(signing.data,'base64'));
 await wait("document.querySelector('#start-github-status').textContent.includes('@fixture-user')");
 assert.equal(await evaluate("document.querySelector('#start-github-device').children.length"),0);assert.equal(await evaluate("document.querySelector('#start-github-sign-out').hidden"),false);
 checks.push('device code shown inline, then the signed-in account');
 await evaluate("{const f=document.querySelector('[data-start=clone]');f.elements.repository.value='https://github.com/fixture-user/algorithm-solution.git';f.elements.repository.dispatchEvent(new Event('change'));document.querySelector('[data-start=clone] [data-pick=parent]').click()}");
 await wait(`document.querySelector('[data-start=clone] [data-target]').textContent==='저장 위치: '+${JSON.stringify(join(parent,'algorithm-solution'))}`);
 assert.equal(await evaluate("document.querySelector('[data-start=clone]').elements.url.value"),'https://github.com/fixture-user/algorithm-solution.git');
 checks.push('repository list fills the clone URL; folder picker fills the destination');
 const created=join(parent,'my-solutions');
 await evaluate(`{const f=document.querySelector('[data-start=create]');f.elements.path.value=${JSON.stringify(created)};f.requestSubmit()}`);
 await wait("document.querySelector('#workspace-start').hidden");
 assert.deepEqual(await evaluate('window.__created'),[{name:'my-solutions',hidden:true}]);
 assert.equal(execFileSync('git',['-C',created,'remote','get-url','origin'],{encoding:'utf8'}).trim(),'https://github.com/fixture-user/my-solutions.git');
 assert.equal(execFileSync('git',['-C',created,'rev-list','--all','--count'],{encoding:'utf8'}).trim(),'0');
 checks.push('create: private GitHub repository requested, local repository gets origin, nothing pushed or committed');
 await evaluate("document.getElementById('open-today').click()");
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await wait(`document.querySelector('#filename').textContent==='leetcode/${today.slice(2)}.md'`);
 assert.match(await readFile(join(created,`leetcode/${today.slice(2)}.md`),'utf8'),new RegExp(`^# ${today}\\n`));
 checks.push("today's daily log opens from the new repository's template");
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'start-panel-after-create.png'),Buffer.from(shot.data,'base64'));
 assert.deepEqual(errors,[]);
 const receipt={synthetic:true,checks,runtime_errors:errors,output};await writeFile(join(output,'start-panel.receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{socket?.close();await engine?.close?.();await desktop?.close?.();chrome.kill();await rm(temp,{recursive:true,force:true}).catch(()=>{});}
