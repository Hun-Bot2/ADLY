// Opt-in while-running sync. Attempt time is persisted before network to avoid retry storms.
import {readFile,writeFile,rename} from 'node:fs/promises';
export async function createContestSchedule({path=null,sync,now=()=>new Date(),intervalMs=60_000}) {
  let state={enabled:false,last_attempt_at:null,last_success_at:null,error:null},pending=null,closed=false;
  if(path)try{const saved=JSON.parse(await readFile(path,'utf8'));if(typeof saved.enabled!=='boolean')throw new Error('invalid contest sync settings');for(const key of ['last_attempt_at','last_success_at'])if(saved[key]!==null&&(typeof saved[key]!=='string'||!Number.isFinite(Date.parse(saved[key]))))throw new Error('invalid contest sync timestamp');if(saved.error!==null&&typeof saved.error!=='string')throw new Error('invalid contest sync error');state={enabled:saved.enabled,last_attempt_at:saved.last_attempt_at,last_success_at:saved.last_success_at,error:saved.error};}catch(e){if(e.code!=='ENOENT')throw e;}
  const persist=async()=>{if(path){await writeFile(path+'.tmp',JSON.stringify(state)+'\n',{mode:0o600});await rename(path+'.tmp',path);}};
  const status=()=>({...state,running:Boolean(pending)});
  async function run(force=false){
    if(closed||pending)return pending??status();
    const at=now(),last=Date.parse(state.last_attempt_at);
    if(!force&&(!state.enabled||(Number.isFinite(last)&&at-last<86_400_000)))return status();
    pending=(async()=>{state.last_attempt_at=at.toISOString();state.error=null;await persist();
      try{const result=await sync(at);const failed=result?.results?.filter(r=>r.status==='unavailable'||r.error)??[];if(failed.length)state.error=failed.map(r=>r.platform+': '+(r.error??r.status)).join('; ');else state.last_success_at=at.toISOString();await persist();return result;}
      catch(e){state.error=String(e.message??e);await persist();return {error:state.error};}
    })().finally(()=>{pending=null;});return pending;
  }
  const timer=setInterval(()=>{void run().catch(()=>{});},intervalMs);timer.unref?.();
  return {status,run,async configure(input){if(!input||Object.keys(input).join('|')!=='enabled'||typeof input.enabled!=='boolean')throw new Error('expected enabled boolean');if(pending)await pending;state.enabled=input.enabled;await persist();return status();},async close(){closed=true;clearInterval(timer);if(pending)await pending;}};
}
