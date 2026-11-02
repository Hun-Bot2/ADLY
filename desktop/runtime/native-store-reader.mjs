// Read-only OS-store bridge. Secret travels only over the owned helper stdout pipe.
import {spawn} from 'node:child_process';
export function nativeCredentialReader(executable,{spawnFn=spawn,timeoutMs=5000}={}){
 if(typeof executable!=='string'||!executable)throw Error('native credential helper required');
 return {get:async key=>{
  if(key!=='github')throw Error('unsupported credential key');
  return new Promise((resolve,reject)=>{
   const child=spawnFn(executable,['--credential-read'],{stdio:['ignore','pipe','ignore'],windowsHide:true});let data='',done=false;
   const fail=()=>{if(done)return;done=true;child.kill();reject(Error('OS credential read unavailable'));};
   const timer=setTimeout(fail,timeoutMs);child.once('error',()=>{clearTimeout(timer);fail();});
   child.stdout.on('data',chunk=>{data+=chunk;if(data.length>16384)fail();});
   child.once('exit',code=>{clearTimeout(timer);if(done)return;done=true;if(code===1){resolve(null);return;}if(code!==0){reject(Error('OS credential read unavailable'));return;}const value=data.replace(/\r?\n$/,'');if(!value||/[\r\n]/.test(value)){reject(Error('invalid OS credential response'));return;}resolve(value);});
  });
 }};
}
