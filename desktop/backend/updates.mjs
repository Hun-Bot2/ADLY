/** Signed download staging only. Installation and learner-data migration belong to the native shell. */
import {createHash,createPublicKey,verify as verifySignature,randomUUID} from 'node:crypto';
import {mkdir,open,link,unlink,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const FIELDS=['arch','platform','schema','sha256','size','url','version'];
export function canonicalManifest(manifest){if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||Object.keys(manifest).sort().join(',')!==FIELDS.join(','))throw new Error('unexpected update manifest fields');return JSON.stringify(Object.fromEntries(FIELDS.map(key=>[key,manifest[key]])));}
function version(value){if(typeof value!=='string'||!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value))throw new Error('expected a stable major.minor.patch version');const parts=value.split('.').map(Number);if(parts.some(n=>!Number.isSafeInteger(n)))throw new Error('version component too large');return parts;}
export function compareVersions(left,right){const a=version(left),b=version(right);for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]<b[i]?-1:1;}return 0;}
function validateOrigin(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('update origin must be HTTPS without path or credentials');return url.origin;}
export function createUpdater({publicKey,allowedOrigins=[],currentVersion,appData,platform=process.platform,arch=process.arch,maxBytes=512*1024*1024,fetcher=fetch}={}){
 const key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519')throw new Error('publisher key must be Ed25519');version(currentVersion);
 if(!appData||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>2*1024*1024*1024)throw new Error('invalid update staging configuration');
 const origins=new Set(allowedOrigins.map(validateOrigin));if(!origins.size)throw new Error('at least one trusted update origin is required');
 function verify(envelope){if(!envelope||typeof envelope!=='object'||Object.keys(envelope).sort().join(',')!=='manifest,signature')throw new Error('expected a signed manifest envelope');const {manifest,signature}=envelope;const canonical=canonicalManifest(manifest);
  if(typeof signature!=='string'||!/^([A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$/.test(signature))throw new Error('invalid update signature encoding');const bytes=Buffer.from(signature,'base64');if(bytes.length!==64||!verifySignature(null,Buffer.from(canonical),key,bytes))throw new Error('update signature verification failed');
  if(manifest.schema!==1||!['darwin','win32'].includes(manifest.platform)||!['arm64','x64'].includes(manifest.arch)||manifest.platform!==platform||manifest.arch!==arch)throw new Error('update does not match this platform and architecture');
  if(typeof manifest.sha256!=='string'||!/^[a-f0-9]{64}$/.test(manifest.sha256))throw new Error('invalid update artifact hash');
  if(!Number.isSafeInteger(manifest.size)||manifest.size<1||manifest.size>maxBytes)throw new Error('update size exceeds limit');
  if(typeof manifest.url!=='string')throw new Error('invalid update URL');const url=new URL(manifest.url);if(url.protocol!=='https:'||url.username||url.password||url.hash||!origins.has(url.origin))throw new Error('update URL is not on a trusted HTTPS origin');
  const comparison=compareVersions(manifest.version,currentVersion);return Object.freeze({...manifest,status:comparison>0?'update_available':comparison===0?'current':'older_version'});
 }
 async function stage(envelope,{confirmed=false,signal}={}){if(confirmed!==true)throw new Error('explicit update download confirmation required');const manifest=verify(envelope);if(manifest.status!=='update_available')throw new Error('only a newer version may be staged');if(signal?.aborted)throw new DOMException('Update cancelled','AbortError');
  const directory=join(resolve(appData),'updates');await mkdir(directory,{recursive:true,mode:0o700});if((await lstat(directory)).isSymbolicLink())throw new Error('update staging directory cannot be a symlink');
  const destination=join(directory,`${manifest.version}-${manifest.platform}-${manifest.arch}-${manifest.sha256}.download`);const temp=join(directory,`.${randomUUID()}.partial`);let file;
  try{file=await open(temp,'wx',0o600);const response=await fetcher(manifest.url,{redirect:'error',signal});if(!response.ok||!response.body)throw new Error('update download failed');if(response.url){const actual=new URL(response.url);if(actual.href!==new URL(manifest.url).href)throw new Error('update redirects are not allowed');}const contentLength=response.headers.get('content-length');if(contentLength!==null&&(!/^\d+$/.test(contentLength)||Number(contentLength)!==manifest.size))throw new Error('update Content-Length mismatch');
   const digest=createHash('sha256');let size=0;for await(const chunk of response.body){if(signal?.aborted)throw new DOMException('Update cancelled','AbortError');size+=chunk.byteLength;if(size>manifest.size||size>maxBytes)throw new Error('update download exceeds declared size');digest.update(chunk);await file.writeFile(chunk);}
   if(size!==manifest.size||digest.digest('hex')!==manifest.sha256)throw new Error('update artifact hash or size mismatch');await file.sync();await file.close();file=null;
   // A hard link provides atomic no-overwrite publication of the complete verified artifact.
   await link(temp,destination);return {version:manifest.version,path:destination,sha256:manifest.sha256,size,installed:false,notice:'Verified update downloaded. Installation requires the native application updater.'};
  }finally{await file?.close();await unlink(temp).catch(error=>{if(error.code!=='ENOENT')throw error;});}
 }
 return {verify,stage};
}
