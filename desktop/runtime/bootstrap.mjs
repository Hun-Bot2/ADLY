// DA-0 shared workload. Tauri launches this with the same external Node.
// This adapter is a spike; repository/process ownership is still in the JS prototype.
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {nativeCredentialReader} from './native-store-reader.mjs';
import {DatabaseSync} from 'node:sqlite';
// Candidate children never receive optional provider/cloud credentials implicitly.
for(const key of Object.keys(process.env))if(/^(OPENAI|GEMINI|GOOGLE_API|NVIDIA|ANTHROPIC|SLACK|AWS_|LANGSMITH|GH_TOKEN|GITHUB_TOKEN)/i.test(key))delete process.env[key];
const db=new DatabaseSync(':memory:');db.exec('SELECT 1');db.close();
if(process.versions.node!=='26.8.1')throw Error('DA-0 requires the pinned Node 26.8.1 runtime');
const root=resolve(process.env.DESKTOP_SPIKE_ROOT??'');
if(!process.env.DESKTOP_SPIKE_ROOT||!process.env.DESKTOP_APP_DATA)throw Error('explicit prototype root and isolated app-data directory required');
if(process.platform==='win32'&&process.env.DESKTOP_PACKAGED==='1'){const helper=fileURLToPath(new URL('../runtime-node/mastery-native-runner.exe',import.meta.url));if(!existsSync(helper))throw Error('packaged native Job Object runner is missing');process.env.MASTERY_NATIVE_RUNNER=helper;}
const {startDesktop}=await import(pathToFileURL(join(root,'desktop/dev.mjs')).href);
let app,startup,broker,closing=false;
async function close(){if(closing)return;closing=true;try{if(startup)app=await startup.catch(()=>null);await app?.close();await broker?.close();}finally{process.exit(0);}}
process.stdin.setEncoding('utf8');let input='';
process.stdin.on('data',chunk=>{input+=chunk;if(input.length>1024)void close();if(input.includes('\n'))void close();});
// EOF also occurs when the native shell crashes: request orderly child cleanup.
process.stdin.once('end',()=>void close());process.stdin.resume();
process.once('SIGTERM',()=>void close());process.once('SIGINT',()=>void close());
try{
 startup=(async()=>{
 if(process.env.DESKTOP_CREDENTIAL_HELPER){
  const {createAskpassBroker}=await import(pathToFileURL(join(root,'desktop/runtime/askpass.mjs')).href);
  broker=await createAskpassBroker({store:nativeCredentialReader(process.env.DESKTOP_CREDENTIAL_HELPER),node:process.execPath,helper:fileURLToPath(new URL('./askpass-helper.mjs',import.meta.url)),directory:join(process.env.DESKTOP_APP_DATA,'native-session')});
  Object.assign(process.env,broker.environment);
 }
 return startDesktop({appData:process.env.DESKTOP_APP_DATA,catalogRoot:process.env.DESKTOP_CATALOG_ROOT??join(root,'private-learning/mastery'),companyRoot:process.env.DESKTOP_COMPANY_ROOT??process.env.DESKTOP_CATALOG_ROOT??join(root,'private-learning/mastery')});
 })();
 app=await startup;
 if(!closing)console.log(JSON.stringify({type:'ready',url:app.url,pid:process.pid,node:process.versions.node,sqlite:true}));
}catch(error){await broker?.close();console.error('DA-0 startup failed: '+error.message);process.exit(1);}
