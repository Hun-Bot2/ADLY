// DA-0 process-tree measurement. Uses a new synthetic learner directory only.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,stat,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {performance} from 'node:perf_hooks';
const exec=promisify(execFile);
const args=process.argv.slice(2),arg=name=>{const i=args.indexOf('--'+name);return i<0?null:args[i+1];};
const candidate=arg('candidate')??'tauri',data=arg('app-data'),executable=arg('executable'),catalogRoot=arg('catalog-root');
if(candidate!=='tauri'||!data||!executable)throw Error('usage: node measure.mjs [--candidate tauri] --executable <binary> --app-data <NEW temporary directory> [--catalog-root <immutable datasets>] [--seconds 60] [--bundle <installed directory>]');
const seconds=Number(arg('seconds')??60);if(!Number.isFinite(seconds)||seconds<1||seconds>240)throw Error('seconds must be in [1,240]');
await mkdir(resolve(data),{recursive:false,mode:0o700});
const started=performance.now(),env={...process.env,DESKTOP_APP_DATA:resolve(data),DESKTOP_SPIKE_NODE:process.execPath,DESKTOP_SPIKE_SMOKE:'1',DESKTOP_SPIKE_HOLD_MS:String(seconds*1000+1500),...(catalogRoot?{DESKTOP_CATALOG_ROOT:resolve(catalogRoot),DESKTOP_COMPANY_ROOT:resolve(catalogRoot)}:{})};
const child=spawn(resolve(executable),[],{env,stdio:['ignore','pipe','pipe']});
child.stderr.resume();let buffer='',readyRecord;
const closed=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
const ready=await new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{child.kill();reject(Error('native shell startup timeout'));},60000);
 child.once('error',error=>{clearTimeout(timer);reject(error);});
 child.once('exit',()=>{clearTimeout(timer);if(!readyRecord)reject(Error('candidate exited before shell-ready'));});
 child.stdout.on('data',chunk=>{buffer=(buffer+chunk).slice(-65536);let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let record;try{record=JSON.parse(line);}catch{continue;}if(record.type==='shell-ready'){readyRecord=record;clearTimeout(timer);resolve(record);}}});
});
const firstRenderMs=performance.now()-started;
const landing=await fetch(ready.url+'/',{signal:AbortSignal.timeout(30000)});const cookie=landing.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
const journalStart=performance.now();const journal=await fetch(ready.url+'/api/journal',{headers:{Cookie:cookie},signal:AbortSignal.timeout(30000)});const journalBody=await journal.json();
const firstJournalMs=performance.now()-started;
await new Promise(resolve=>setTimeout(resolve,seconds*1000));
async function processes(){
 if(process.platform==='win32'){
  const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Json -Compress']);
  const rows=JSON.parse(stdout);return (Array.isArray(rows)?rows:[rows]).map(r=>({pid:r.ProcessId,ppid:r.ParentProcessId,rss_bytes:Number(r.WorkingSetSize)}));
 }
 const {stdout}=await exec('ps',['-axo','pid=,ppid=,rss=']);return stdout.trim().split('\n').map(line=>{const [pid,ppid,rss]=line.trim().split(/\s+/).map(Number);return {pid,ppid,rss_bytes:rss*1024};});
}
const rows=await processes(),owned=new Set([child.pid]);let changed=true;
while(changed){changed=false;for(const row of rows)if(owned.has(row.ppid)&&!owned.has(row.pid)){owned.add(row.pid);changed=true;}}
const tree=rows.filter(row=>owned.has(row.pid));
let timeout;const exit=await Promise.race([closed,new Promise((_,reject)=>{timeout=setTimeout(()=>{child.kill();reject(Error('candidate did not quit after hold'));},12000);})]);clearTimeout(timeout);
await new Promise(resolve=>setTimeout(resolve,500));const after=await processes();const survivors=after.filter(row=>owned.has(row.pid));
async function bytes(path){const s=await stat(path);if(s.isFile())return s.size;let total=0;for(const item of await readdir(path,{withFileTypes:true})){if(item.isSymbolicLink())continue;total+=await bytes(join(path,item.name));}return total;}
console.log(JSON.stringify({candidate,platform:process.platform,arch:process.arch,recorded_at:new Date().toISOString(),node_version:process.versions.node,workload:'synthetic learner; supplied immutable catalog/company sources',first_ui_load_ms:Math.round(firstRenderMs),first_journal_response_ms:Math.round(firstJournalMs),journal_request_ms:Math.round(firstJournalMs-journalStart+started),journal_http_status:journal.status,journal_available:journalBody.available===true,idle_after_seconds:seconds,processes:tree,rss_bytes_sum:tree.reduce((sum,row)=>sum+row.rss_bytes,0),memory_note:'Owned process-tree RSS/working-set only; shared pages counted multiple times. macOS system-managed WebKit processes may be outside this tree; not a full candidate memory comparison. No process command lines captured',installed_bytes:arg('bundle')?await bytes(resolve(arg('bundle'))):null,exit,survivors,release_gate:seconds>=60&&journalBody.available===true&&survivors.length===0?'partial native-development measurement; packaged/Windows gates remain':'incomplete DA-0 workload'},null,2));
