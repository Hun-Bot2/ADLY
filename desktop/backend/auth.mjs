/** GitHub device flow; secrets go only to an injected OS credential-store adapter. */
import {setTimeout as delay} from 'node:timers/promises';
const BASE='https://github.com';
export function createDeviceAuth({clientId,store,fetcher=fetch,sleep=delay,now=Date.now}={}){
 if(!clientId||!store?.set||!store?.get||!store?.delete)throw new Error('client id and OS credential store required');
 async function post(path,body,signal){const r=await fetcher(BASE+path,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body),signal});if(!r.ok)throw new Error('GitHub authentication unavailable');return r.json();}
 return {
  async begin({signal}={}){const r=await post('/login/device/code',{client_id:clientId},signal);if(typeof r.device_code!=='string'||!r.device_code||typeof r.user_code!=='string'||!r.user_code||!Number.isFinite(r.expires_in)||r.expires_in<=0||(r.interval!==undefined&&(!Number.isFinite(r.interval)||r.interval<=0)))throw new Error('invalid device response');return r;},
  async complete(device,{signal}={}){if(typeof device?.device_code!=='string'||!Number.isFinite(device.expires_in)||device.expires_in<0||(device.interval!==undefined&&(!Number.isFinite(device.interval)||device.interval<=0)))throw new Error('invalid device response');let interval=Math.max(1,device.interval??5)*1000;const deadline=now()+device.expires_in*1000;while(now()<deadline){await sleep(interval,undefined,{signal});if(now()>=deadline)throw new Error('expired_token');const r=await post('/login/oauth/access_token',{client_id:clientId,device_code:device.device_code,grant_type:'urn:ietf:params:oauth:grant-type:device_code'},signal);if(r.access_token){await store.set('github',r.access_token);return {signedIn:true};}if(r.error==='slow_down'){interval+=5000;continue;}if(r.error==='authorization_pending')continue;throw new Error(['access_denied','expired_token'].includes(r.error)?r.error:'authentication failed');}throw new Error('expired_token');},
  async status(){return {signedIn:Boolean(await store.get('github'))};},
  async signOut(){await store.delete('github');return {signedIn:false};}
 };
}
