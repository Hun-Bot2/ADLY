/** Owns only processes it starts; never writes the learner database. */
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

export function createSupervisor({command=process.execPath,args=[],env={},origin,healthTimeoutMs=15000,maxRestarts=3,onState=()=>{}}={}) {
 if(!origin)throw new Error('app origin required');
 const token=randomBytes(32).toString('hex');
 let child=null,stopping=false,starts=[],state='stopped',generation=0,restartTimer=null;
 const change=next=>{state=next;onState(next);};
 const stopChild=record=>{
  if(!record)return Promise.resolve();
  if(record.cleanup)return record.cleanup;
  record.cleanup=(async()=>{
   const proc=record.proc;
   const signal=sig=>{
    if(!proc.pid)return;
    if(process.platform==='win32'){
     // Interim candidate cleanup. Packaged Windows supervision still requires a Job Object lifecycle gate.
     const result=spawnSync('taskkill',['/PID',String(proc.pid),'/T','/F'],{windowsHide:true,timeout:5000,stdio:'ignore'});
     if((result.error||result.status!==0)&&proc.exitCode===null&&proc.signalCode===null)proc.kill('SIGKILL');
    }else{
     // Signal the group even after its leader has exited: descendants may still hold the output pipes.
     try{process.kill(-proc.pid,sig);}catch(e){if(e.code==='EPERM'){if(proc.exitCode===null&&proc.signalCode===null)proc.kill(sig);}else if(e.code!=='ESRCH')throw e;}
    }
   };
   signal('SIGTERM');
   const closed=new Promise(resolve=>{if(record.closed)resolve();else proc.once('close',resolve);});
   let timer;await Promise.race([closed,new Promise(resolve=>{timer=setTimeout(resolve,1200);})]);clearTimeout(timer);
   if(!record.closed){signal('SIGKILL');let finalTimer;await Promise.race([closed,new Promise(resolve=>{finalTimer=setTimeout(resolve,1200);})]);clearTimeout(finalTimer);}
   // A stopped supervisor must never wait indefinitely on a descendant's inherited pipe.
   proc.stdout?.destroy();proc.stderr?.destroy();
  })();
  return record.cleanup;
 };
 const start=async()=>{
  if(child)throw new Error('engine already started');
  if(restartTimer){clearTimeout(restartTimer);restartTimer=null;}
  const current=++generation;stopping=false;change('starting');
  const proc=spawn(command,args,{env:{...process.env,...env,APP_TOKEN:token,APP_ORIGIN:origin},detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
  const record={proc,url:null,ready:false,closed:false,spawnError:null,cleanup:null};child=record;
  proc.on('error',error=>{record.spawnError=error;});
  let output='';proc.stdout.on('data',chunk=>{output=(output+chunk).slice(-16384);const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match)record.url=match[0];});proc.stderr.resume();proc.once('close',()=>{record.closed=true;});
  proc.once('exit',()=>{
   if(!record.ready||stopping||current!==generation)return;
   change('reconnecting');
   void stopChild(record).then(()=>{
    if(child===record)child=null;
    if(stopping||current!==generation)return;
    starts=starts.filter(t=>Date.now()-t<60000);
    if(starts.length>=maxRestarts){change('failed');return;}
    starts.push(Date.now());restartTimer=setTimeout(()=>{restartTimer=null;if(stopping||current!==generation)return;void start().catch(()=>{if(!stopping)change('failed');});},Math.min(2000,100*2**starts.length));restartTimer.unref?.();
   }).catch(()=>{if(child===record)child=null;if(!stopping)change('failed');});
  });
  try{
   const deadline=Date.now()+healthTimeoutMs;
   while(Date.now()<deadline&&!stopping&&current===generation){
    if(record.spawnError)throw record.spawnError;
    if(proc.exitCode!==null||proc.signalCode!==null)throw new Error('engine exited before ready');
    if(record.url){try{const response=await fetch(record.url+'/api/health',{headers:{'X-App-Token':token,Origin:origin},signal:AbortSignal.timeout(700)});if(response.ok&&!stopping&&current===generation){record.ready=true;change('running');return {url:record.url,token};}}catch{}}
    await delay(50);
   }
   throw new Error(stopping?'engine start cancelled':'engine health timeout');
  }catch(error){await stopChild(record);if(child===record)child=null;if(!stopping&&current===generation)change('failed');throw error;}
 };
 return {start,get state(){return state;},get connection(){return state==='running'&&child?{url:child.url,token}:null;},async stop(){stopping=true;generation++;if(restartTimer){clearTimeout(restartTimer);restartTimer=null;}await stopChild(child);child=null;change('stopped');}};
}
