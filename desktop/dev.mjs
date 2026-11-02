/** Executable loopback prototype. Native shell selection remains ADR007 DA-0 gated. */
import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFile as read, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createSupervisor} from './backend/supervisor.mjs';
import {appDataRoot,readJson,atomicWrite,safePath} from './backend/paths.mjs';
import * as repositories from './backend/repositories.mjs';
import {saveDraft,loadDraft} from './backend/drafts.mjs';
import {prepareDailyLog,openDailyLog,addProblemToDaily} from './backend/dailylog.mjs';
import {createUpdater} from './backend/updates.mjs';
import {availableCatalogs,installDatasets} from './backend/datasets.mjs';
import {detectToolchains,runFile} from './backend/runner.mjs';
import {syncRepository,pushRepository} from './backend/sync.mjs';
const ROOT=fileURLToPath(new URL('..',import.meta.url));
const json=(r,value,status=200)=>{r.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});r.end(JSON.stringify(value));};
async function body(request){let size=0,chunks=[];for await(const chunk of request){size+=chunk.length;if(size>2*1024*1024)throw Error('request too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
export async function startDesktop({port=0,appData=appDataRoot(),catalogRoot=process.env.DESKTOP_CATALOG_ROOT??join(ROOT,'private-learning/mastery'),companyRoot=catalogRoot,engineConnection=null,engineArgs=[],initialState=null}={}){
 await mkdir(appData,{recursive:true,mode:0o700});const freshDatabase=!existsSync(join(appData,'learner.sqlite3'));if(process.env.DESKTOP_PACKAGED==='1'){installDatasets(catalogRoot,join(appData,'catalogs'));catalogRoot=join(appData,'catalogs');companyRoot=catalogRoot;}const statePath=join(appData,'state.json'),state=initialState??readJson(statePath,{repositories:[]});
 const updateOrigin=process.env.DESKTOP_UPDATE_ORIGIN,updateUrl=process.env.DESKTOP_UPDATE_MANIFEST_URL,updateKey=process.env.DESKTOP_UPDATE_PUBLIC_KEY;let updateEnvelope=null;
 const updater=updateOrigin&&updateUrl&&updateKey?createUpdater({publicKey:updateKey,allowedOrigins:[updateOrigin],currentVersion:'0.0.1',appData}):null;
 const token=randomBytes(32).toString('hex'),sessionName='mastery_'+randomBytes(8).toString('hex'),runs=new Map(),activeRuns=new Map();let closing=false;let supervisor=null,connection=engineConnection,origin=null,busy=new Set();
 const persist=()=>atomicWrite(statePath,JSON.stringify(state,null,2)+'\n');
 const tracked=async operation=>{const controller=new AbortController(),pending=Promise.resolve().then(()=>operation(controller.signal));runs.set(controller,pending);try{return await pending;}finally{runs.delete(controller);}};
 const engine=async(path,{method='GET',body:payload}={})=>{if(!connection)throw Error('engine reconnecting');const r=await fetch(connection.url+path,{method,headers:{Origin:origin,'X-App-Token':connection.token,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});const result=await r.json();if(!r.ok)throw Error(result.error??'engine request failed');return result;};
 async function registerEngine(repo){const branch=repositories.git(repo.path,['branch','--show-current']);try{repositories.git(repo.path,['rev-parse','HEAD']);}catch{return {status:'awaiting_first_commit'};}return engine('/api/local/repositories',{method:'POST',body:{repoId:repo.id,path:repo.path,branch}});}
 const commands=async input=>{
  if(closing)throw Error('desktop shutting down');
  const {command}=input;
  if(['register','create','clone'].includes(command)){
   if(typeof input.path!=='string'||!input.path.trim())throw Error('repository path required');
   const info=command==='create'?repositories.createRepository(resolve(input.path),{remote:typeof input.remote==='string'&&input.remote?input.remote:null}):command==='clone'?repositories.cloneRepository(input.url,resolve(input.path)):repositories.registerRepository(resolve(input.path));
   const id='repo-'+createHash('sha256').update(info.path).digest('hex').slice(0,16);let repo=state.repositories.find(r=>r.id===id);
   if(!repo){repo={id,path:info.path,sync:false};state.repositories.push(repo);persist();}
   return {...repo,ingestion:await registerEngine(repo)};
  }
  if(command==='update-check')return tracked(async signal=>{if(!updater)throw Error('서명된 업데이트 채널이 설정되지 않았습니다.');const url=new URL(updateUrl);if(url.protocol!=='https:'||url.origin!==new URL(updateOrigin).origin||url.username||url.password)throw Error('invalid update manifest origin');const response=await fetch(url,{redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});if(!response.ok||!response.body)throw Error('update manifest unavailable');let size=0,chunks=[];for await(const chunk of response.body){size+=chunk.byteLength;if(size>65536)throw Error('update manifest too large');chunks.push(chunk);}updateEnvelope=JSON.parse(Buffer.concat(chunks).toString());return updater.verify(updateEnvelope);});
  if(command==='update-stage'){if(!updater||!updateEnvelope)throw Error('업데이트를 먼저 확인하세요.');return tracked(signal=>updater.stage(updateEnvelope,{confirmed:input.confirmed===true,signal}));}
  if(command==='appearance-setting'){if(!['system','light','dark'].includes(input.appearance))throw Error('invalid appearance');state.appearance=input.appearance;persist();return {appearance:state.appearance};}
  if(command==='layout-setting'){
   const inputLayout=input.layout,allowed=['explorerWidth','panelHeight','explorerCollapsed','panelCollapsed','panel'];
   if(!inputLayout||typeof inputLayout!=='object'||Array.isArray(inputLayout)||Object.keys(inputLayout).some(k=>!allowed.includes(k)))throw Error('invalid layout settings');
   const layout={...(state.layout??{})};
   for(const [key,value]of Object.entries(inputLayout)){
    if(['explorerCollapsed','panelCollapsed'].includes(key)){if(typeof value!=='boolean')throw Error('invalid layout flag');layout[key]=value;}
    else if(key==='panel'){if(!['output','input','tests','record','git'].includes(value))throw Error('invalid workspace panel');layout[key]=value;}
    else{if(typeof value!=='number'||!Number.isFinite(value))throw Error('invalid layout dimension');const [min,max]=key==='explorerWidth'?[160,440]:[160,520];layout[key]=Math.max(min,Math.min(max,Math.round(value)));}
   }
   state.layout=layout;persist();return {layout};
  }
  if(command==='catalog')return engine('/api/catalog/use',{method:'POST',body:{version:input.version}});
  const repo=state.repositories.find(r=>r.id===input.repoId);if(!repo)throw Error('unknown registered repository');
  if(command==='cancel-run'){activeRuns.get(repo.id)?.abort();return {cancelled:true};}
  if(command==='draft'){safePath(repo.path,input.path);saveDraft(appData,repo.path,input.path,input.content);return {saved:true};}
  if(busy.has(repo.id))throw Error('repository operation already running');busy.add(repo.id);
  try{
   switch(command){
    case 'files':return {files:repositories.listFiles(repo.path)};
    case 'read':return {content:repositories.readFile(repo.path,input.path),draft:loadDraft(appData,repo.path,input.path)};
    case 'sync-setting':if(typeof input.enabled!=='boolean')throw Error('enabled must be boolean');repo.sync=input.enabled;persist();return {enabled:repo.sync};
    case 'open':return repositories.withRepositoryLock(repo.path,()=>repositories.openProblem(repo.path,input));
    case 'daily-open':return repositories.withRepositoryLock(repo.path,()=>openDailyLog(repo.path,{date:input.date,folder:input.folder}));
    case 'daily-add':return repositories.withRepositoryLock(repo.path,()=>addProblemToDaily(repo.path,{date:input.date,folder:input.folder,url:input.url,title:input.title,language:input.language}));
    case 'save':return repositories.withRepositoryLock(repo.path,()=>{repositories.saveFile(repo.path,input.path,input.content);saveDraft(appData,repo.path,input.path,input.content);return {saved:true};});
    case 'record':return await repositories.withRepositoryLock(repo.path,async()=>{const prepared=prepareDailyLog(repo.path,input);const validated=await engine('/api/local/daily-log/validate',{method:'POST',body:{path:prepared.relative,source:prepared.content}});if(!Array.isArray(validated.flags)||validated.flags.length)throw Error('Daily log validation failed: '+(validated.flags??['invalid validation response']).join(', '));repositories.saveFile(repo.path,prepared.relative,prepared.content);return prepared;});
    case 'preview':return repositories.previewCommit(repo.path,input.paths);
    case 'commit':{const committed=await repositories.withRepositoryLock(repo.path,()=>repositories.commitFiles(repo.path,input.paths,input.message));try{const registration=await registerEngine(repo);return {...committed,registration,ingestion:await engine('/api/local/ingest',{method:'POST',body:{}})};}catch(error){return {...committed,ingestion:{status:'error',error:error.message},notice:'Commit saved locally; retry ingestion, not commit.'};}}
    case 'run':{const controller=new AbortController();const pending=runFile(repo.path,input.path,{signal:controller.signal,input:input.input??'',line:Number.isInteger(input.line)&&input.line>0?input.line:1,...(input.tests?{tests:input.tests}:{})});runs.set(controller,pending);activeRuns.set(repo.id,controller);try{return await pending;}finally{runs.delete(controller);activeRuns.delete(repo.id);}}
    case 'sync':{const result=await repositories.withRepositoryLock(repo.path,()=>syncRepository(repo.path,{enabled:repo.sync}));if(result.state==='fast_forwarded')await engine('/api/local/ingest',{method:'POST',body:{}});return result;}
    case 'push':return repositories.withRepositoryLock(repo.path,()=>pushRepository(repo.path));
    default:throw Error('unknown desktop command');
   }
  }finally{busy.delete(repo.id);}
 };
 const server=createServer(async(req,res)=>{
  try{
   if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end();return;}
   if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==origin)){res.writeHead(403);res.end();return;}
   const url=new URL(req.url,origin);
   if(url.pathname.startsWith('/desktop/api/')){
    if(req.headers['x-desktop-token']!==token){json(res,{error:'desktop token required'},403);return;}
    if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin){json(res,{error:'same-origin required'},403);return;}
    if(url.pathname==='/desktop/api/state'&&req.method==='GET'){json(res,{repositories:state.repositories,appearance:state.appearance??'light',layout:state.layout??{},catalogs:availableCatalogs(catalogRoot),engine:supervisor?.state??'running',updates:{configured:Boolean(updater)},toolchains:detectToolchains()});return;}
    if(url.pathname==='/desktop/api/command'&&req.method==='POST'){json(res,await commands(await body(req)));return;}
    json(res,{error:'not found'},404);return;
   }
   if(req.method==='GET'&&url.pathname==='/'){
    const html=(await read(new URL('./ui/index.html',import.meta.url),'utf8')).replace('{{TOKEN}}',token);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Set-Cookie':`${sessionName}=${token}; HttpOnly; SameSite=Strict; Path=/`,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src 'self'; frame-ancestors 'none'"});res.end(html);return;
   }
   const assets={'/desktop/ui/style.css':['./ui/style.css','text/css'],'/desktop/ui/editor-bundle.js':['./ui/editor-bundle.js','text/javascript']};
   if(req.method==='GET'&&assets[url.pathname]){const [file,type]=assets[url.pathname];res.writeHead(200,{'Content-Type':type});res.end(await read(new URL(file,import.meta.url)));return;}
   if(!connection){json(res,{error:'engine reconnecting'},503);return;}
   const allowed=url.pathname.startsWith('/api/')||['/workspace/','/index.html','/app.mjs','/workspace.mjs','/workspace-data.mjs','/company.mjs','/styles.css','/design-system.css','/ui.mjs','/overlays.mjs','/appearance.mjs','/analytics.mjs','/analytics-data.mjs','/analytics.css','/company.css','/learning-data.mjs','/learning-views.mjs','/research-view.mjs','/workspace-layout.css','/fonts/PretendardVariable.woff2','/fonts/JetBrainsMonoVariable.woff2','/fonts/Pretendard-LICENSE.txt','/fonts/JetBrainsMono-LICENSE.txt','/fonts/manifest.json'].includes(url.pathname)||/^\/library\/file\/[a-z0-9-]+$/.test(url.pathname)||url.pathname.startsWith('/comparison/');
   if(!allowed){json(res,{error:'not found'},404);return;}
   if(!(req.headers.cookie??'').split(';').map(x=>x.trim()).includes(sessionName+'='+token)){json(res,{error:'desktop session required'},403);return;}
   if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin){json(res,{error:'same-origin required'},403);return;}
   const path=url.pathname==='/workspace/'?'/'+url.search:url.pathname+url.search;
   const headers={Origin:origin,'X-App-Token':connection.token};if(req.headers['content-type'])headers['Content-Type']=req.headers['content-type'];
   const payload=!['GET','HEAD'].includes(req.method)?JSON.stringify(await body(req)):undefined;
   const response=await fetch(connection.url+path,{method:req.method,headers,...(payload?{body:payload}:{})});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){json(res,{error:error.message},400);}
 });
 await new Promise((yes,no)=>server.once('error',no).listen(port,'127.0.0.1',yes));origin=`http://127.0.0.1:${server.address().port}`;
 try{
  if(!connection){supervisor=createSupervisor({origin,args:[join(ROOT,'hosted/local.mjs'),'--port','0','--database',join(appData,'learner.sqlite3'),'--catalog-root',catalogRoot,'--company-root',companyRoot,...engineArgs],onState:state=>{if(state!=='running')connection=null;else connection=supervisor.connection;}});connection=await supervisor.start();}
  if(freshDatabase&&supervisor){const version=availableCatalogs(catalogRoot)[0];if(version)await engine('/api/catalog/use',{method:'POST',body:{version}});}
 }catch(e){await supervisor?.stop();await new Promise(resolve=>server.close(resolve));throw e;}
 const periodic=setInterval(()=>{for(const repo of state.repositories)if(repo.sync)commands({command:'sync',repoId:repo.id}).then(result=>{repo.last_sync={at:new Date().toISOString(),...result};persist();}).catch(error=>{repo.last_sync={at:new Date().toISOString(),state:'error',error:error.message};persist();});},15*60*1000);periodic.unref();
 return {url:origin,token,commands,async close(){closing=true;clearInterval(periodic);for(const controller of runs.keys())controller.abort();await Promise.allSettled([...runs.values()]);await supervisor?.stop();await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const app=await startDesktop({appData:process.env.DESKTOP_APP_DATA||undefined,port:Number(process.env.DESKTOP_PORT??0)});console.log('Desktop development preview: '+app.url);for(const event of ['SIGINT','SIGTERM'])process.once(event,async()=>{await app.close();process.exit(0);});}
