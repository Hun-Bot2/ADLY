/** Native Tauri first-run close/cancel/new regression. Uses only disposable app data. */
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,access,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const exec=promisify(execFile),args=process.argv.slice(2),index=args.indexOf('--binary');
if(index<0||!args[index+1])throw Error('usage: node desktop/onboarding-smoke.mjs --binary <Tauri executable> [--output <receipt>]');
const binary=resolve(args[index+1]),root=await mkdtemp(join(tmpdir(),'onboarding-close-')),cases=[];
const snapshot=async()=>{const {stdout}=await exec('ps',['-axo','pid=,ppid='],{maxBuffer:4*1024*1024});return stdout.trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number));};
try{
 for(const mode of ['close','cancel','new']){
  const appData=join(root,mode),catalogRoot=join(root,'empty-catalogs');await mkdir(appData);await mkdir(catalogRoot,{recursive:true});
  const env={...process.env,DESKTOP_APP_DATA:appData,DESKTOP_CATALOG_ROOT:catalogRoot,DESKTOP_COMPANY_ROOT:catalogRoot,DESKTOP_SPIKE_NODE:process.execPath,DESKTOP_ONBOARDING_SMOKE:mode};delete env.DESKTOP_SPIKE_SMOKE;
  const child=spawn(binary,[],{env,stdio:['ignore','pipe','pipe']});const owned=new Set([child.pid]),events=[];let buffer='',diagnostic='';
  child.stdout.on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);try{events.push(JSON.parse(line));}catch{}}});child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-4096);});
  let sampling=false;const timer=setInterval(async()=>{if(sampling)return;sampling=true;try{const rows=await snapshot();let change=true;while(change){change=false;for(const [pid,parent]of rows)if(owned.has(parent)&&!owned.has(pid)){owned.add(pid);change=true;}}}catch{}finally{sampling=false;}},100);
  let deadline;const closed=new Promise((yes,no)=>{child.once('error',no);child.once('exit',(code,signal)=>yes({code,signal}));});
  let exit;try{exit=await Promise.race([closed,new Promise((_,reject)=>{deadline=setTimeout(()=>{child.kill('SIGTERM');reject(Error('native startup '+mode+' timed out'));},20000);})]);}finally{clearTimeout(deadline);clearInterval(timer);}
  assert.equal(exit.code,0,'native '+mode+' exit; diagnostic: '+diagnostic);assert.ok(events.some(e=>e.type==='onboarding-ready'),mode+' did not display the owned startup window');
  assert.equal(events.some(e=>e.type==='shell-ready'),mode==='new',mode+' unexpected engine launch');
  await new Promise(yes=>setTimeout(yes,400));const alive=await snapshot();assert.deepEqual(alive.filter(([pid])=>owned.has(pid)),[],mode+' left an observed owned process');
  let databaseExists=true;try{await access(join(appData,'learner.sqlite3'));}catch{databaseExists=false;}
  assert.equal(databaseExists,mode==='new',mode+' changed learner storage unexpectedly');
  cases.push({mode,owned_startup_window:true,main_opened:mode==='new',exit_code:exit.code,observed_owned_survivors:0,learner_created:databaseExists});
 }
 const receipt={synthetic:true,platform:process.platform,arch:process.arch,cases,limitations:['macOS only; picker interaction is not automated','Observed descendant PIDs only; system-managed WebKit processes are outside this count']};
 const out=args.indexOf('--output');if(out>=0)await writeFile(resolve(args[out+1]),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await rm(root,{recursive:true,force:true});}
