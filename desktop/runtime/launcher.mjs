// Node-only launcher used by native workload lifecycle tests.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
export function launchPrototype({node,bootstrap,root,appData,catalogRoot,companyRoot,packaged=false,env={},timeoutMs=30000}){
 if(!node||!bootstrap||!root||!appData)throw Error('explicit shell runtime paths required');
 const child=spawn(node,[bootstrap],{stdio:['pipe','pipe','pipe'],windowsHide:true,env:{...process.env,...env,DESKTOP_SPIKE_ROOT:root,DESKTOP_APP_DATA:appData,DESKTOP_PACKAGED:packaged?'1':'0',...(catalogRoot?{DESKTOP_CATALOG_ROOT:catalogRoot}:{}),...(companyRoot?{DESKTOP_COMPANY_ROOT:companyRoot}:{})}});
 // Provider logs are never echoed or persisted by the shell.
 let stderr='',buffer='',stopping=false,ready=false;
 child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4096);});
 const startupDiagnostic=()=>{const library=/Library not loaded:[^\n]*?([A-Za-z0-9_.-]+\.(?:dylib|dll|so))/.exec(stderr);if(library)return 'native runtime missing library '+library[1];const code=/\b(ERR_[A-Z_]+)\b/.exec(stderr);if(code)return code[1];if(/SyntaxError:/.test(stderr))return 'bootstrap module syntax or export error';if(/DA-0 startup failed:/.test(stderr))return 'bootstrap initialization failed';return 'no recognized startup diagnostic';};
 const connection=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{reject(Error('prototype startup timeout'));void stop();},timeoutMs);
  child.on('error',error=>{clearTimeout(timer);reject(Error('prototype spawn failed ('+(error.code??'unknown')+')'));});
  child.once('exit',(code,signal)=>{clearTimeout(timer);if(!ready)reject(Error('prototype exited before ready ('+(signal??('code '+code))+'; '+startupDiagnostic()+')'));});
  child.stdout.on('data',chunk=>{buffer=(buffer+chunk).slice(-65536);let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let item;try{item=JSON.parse(line);}catch{continue;}if(item.type!=='ready')continue;try{const url=new URL(item.url);if(url.hostname!=='127.0.0.1'||url.protocol!=='http:')throw Error('invalid prototype URL');ready=true;clearTimeout(timer);resolve(item);}catch(error){clearTimeout(timer);reject(error);void stop();}}});
 });
 async function stop(){
  if(stopping)return;stopping=true;
  if(child.exitCode!==null||child.signalCode!==null)return;
  const closed=once(child,'close').catch(()=>{});child.stdin.end('shutdown\n');
  let timer;await Promise.race([closed,new Promise(resolve=>{timer=setTimeout(resolve,8000);})]);clearTimeout(timer);
  if(child.exitCode===null&&child.signalCode===null){
   if(process.platform==='win32')await new Promise(resolve=>spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true}).once('exit',resolve).once('error',resolve));
   else child.kill('SIGKILL');
   await closed;
  }
 }
 return {child,connection,stop};
}
