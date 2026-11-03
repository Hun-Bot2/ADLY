/** Loopback-only development service. Never bundled into the production Worker. */
import {comparisonResponse} from './local-comparison.mjs';
import {libraryResponse} from './local-library.mjs';
import {createServer} from 'node:http';
import {readFile, mkdir, chmod} from 'node:fs/promises';
import {resolve, dirname, extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createGitSync} from './mastery/git-sync.mjs';
import {cachedProviders,syncProvider} from './provider-service.mjs';
import {contestDiscoveryFit} from './mastery/contest-discovery-fit.mjs';
import {readLedger,highWaterMarks} from './mastery/ledger.mjs';
import {activeLocalCatalog,createJournalService} from './mastery/journal.mjs';
import {createExplanationService,withExplanations} from './mastery/explanations.mjs';
import {createApp} from './core/app.mjs';
import {timingSafeEqual} from 'node:crypto';
import {createContestSchedule} from './local-contest-sync.mjs';
import {desktopResponse} from './local-desktop.mjs';
import {attachCompanyLayer,loadCompanyLists} from './mastery/company.mjs';
import {createDatabase} from './runtime/database.mjs';

const ROOT=fileURLToPath(new URL('..',import.meta.url));
const PUBLIC = new URL('./public/',import.meta.url);
const TYPES = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.json':'application/json'};
export async function startLocal({port=8787,database=resolve(ROOT,'private-learning/hosted.sqlite3'),learnerId='local-owner',
  curriculum,annotations={},catalogRoot=resolve(ROOT,'private-learning/mastery'),catalogProvider=null,gitSyncIntervalMs=5000,autoGitSync=true,explanationEnv=process.env,contestFetcher,progressionVersion='v2',companyRoot=catalogRoot,companyProvider=null,comparisonFetcher,submissionFetcher,submissionSleep,apiOnly=false,appToken=null,allowedOrigin=null}={}) {
  if(apiOnly && (typeof appToken!=='string'||appToken.length<32||!allowedOrigin))throw new Error('API-only mode requires APP_TOKEN (at least 32 characters) and APP_ORIGIN');
  const databasePath = database === ':memory:' ? database : resolve(database);
  if (databasePath !== ':memory:') await mkdir(dirname(databasePath),{recursive:true,mode:0o700});
  const db = createDatabase(databasePath);
  if (databasePath !== ':memory:') await chmod(databasePath,0o600);
  const assets = {async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!['index.html','app.mjs','workspace.mjs','workspace-data.mjs','company.mjs','styles.css','design-system.css','ui.mjs','overlays.mjs','appearance.mjs','analytics.mjs','analytics-data.mjs','analytics.css','company.css','learning-data.mjs','learning-views.mjs','research-view.mjs','workspace-layout.css','fonts/PretendardVariable.woff2','fonts/JetBrainsMonoVariable.woff2','fonts/Pretendard-LICENSE.txt','fonts/JetBrainsMono-LICENSE.txt','fonts/manifest.json'].includes(filename)) return new Response('Not found',{status:404});
    try { return new Response(await readFile(new URL(filename,PUBLIC)),{headers:{'content-type':TYPES[extname(filename)]}}); }
    catch { return new Response('Not found',{status:404}); }
  }};
  const gitSync=createGitSync({db,learnerId,intervalMs:gitSyncIntervalMs,catalogRoot,catalogProvider});
  const explanations=createExplanationService({cacheRoot:resolve(dirname(databasePath),'explanations'),env:explanationEnv});
  const loadCompany=async catalog=>{if(companyProvider)return companyProvider(catalog);const info=attachCompanyLayer(db.sqlite,companyRoot,catalog);return info.available?{...loadCompanyLists(db.sqlite),...info}:info;};
  const loadCatalog=async()=>{const ledger=await readLedger(db,learnerId);return {ledger,catalog:catalogProvider?await catalogProvider(ledger):activeLocalCatalog(db,ledger,catalogRoot)};};
  const journal=withExplanations(createJournalService({db,catalogRoot,catalogProvider,progressionVersion,companyProvider:loadCompany}),explanations,db);
  const contests=async({learnerId,now})=>{
    const cache=await cachedProviders(db,learnerId,now),ledger=await readLedger(db,learnerId,{cutoff:now.toISOString()});
    let catalog;try{catalog=catalogProvider?await catalogProvider(ledger):activeLocalCatalog(db,ledger,catalogRoot);}catch{/* No catalog: explicit insufficient evidence. */}
    return {...cache,items:cache.items.map(c=>({...c,recommendation:contestDiscoveryFit(c,{ledger,catalog,now})}))};
  };
  const contestSync=async({learnerId,now})=>{
    const results=await Promise.allSettled(['codeforces','atcoder','leetcode'].map(platform=>syncProvider({db,learnerId,platform,discovery:true,env:{PROVIDERS_ENABLED:'true'},now,fetcher:contestFetcher})));
    return {results:results.map((r,i)=>({platform:['codeforces','atcoder','leetcode'][i],...(r.status==='fulfilled'?r.value:{status:'unavailable',error:'sync_in_progress_or_failed'})}))};
  };
  const contestSchedule=await createContestSchedule({path:databasePath===':memory:'?null:resolve(dirname(databasePath),'contest-sync.json'),sync:now=>contestSync({learnerId,now})});
  const app = createApp({db,journal,curriculum,annotations,assets,contests,contestSync:()=>contestSchedule.run(true),authenticate:async()=>({learner_id:learnerId})});
  const server = createServer(async (incoming,outgoing) => {
    try {
      const host = incoming.headers.host;
      if (!/^127\.0\.0\.1:\d+$/.test(host ?? '')) { outgoing.writeHead(403);outgoing.end();return; }
      const base = `http://${host}`, url = new URL(incoming.url,base);
      if (url.origin !== base) { outgoing.writeHead(403);outgoing.end();return; }
      const origin=incoming.headers.origin;
      if(appToken&&incoming.method==='OPTIONS'){
        if(origin!==allowedOrigin){outgoing.writeHead(403);outgoing.end();return;}
        outgoing.writeHead(204,{'access-control-allow-origin':allowedOrigin,'access-control-allow-methods':'GET,POST,PUT,HEAD','access-control-allow-headers':'content-type,x-app-token','vary':'Origin'});outgoing.end();return;
      }
      if(appToken){
        const supplied=Buffer.from(String(incoming.headers['x-app-token']??'')),expected=Buffer.from(appToken);
        if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){outgoing.writeHead(403);outgoing.end('App token required');return;}
        if(origin && origin!==allowedOrigin){outgoing.writeHead(403);outgoing.end('Origin rejected');return;}
        if(origin===allowedOrigin){outgoing.setHeader('access-control-allow-origin',allowedOrigin);outgoing.setHeader('vary','Origin');}
      }
      if(apiOnly&&(!url.pathname.startsWith('/api/')||url.pathname.startsWith('/api/local/library')||url.pathname.startsWith('/api/local/comparison'))){outgoing.writeHead(404);outgoing.end();return;}
      const researchHeaders=new Headers(incoming.headers);if(appToken&&researchHeaders.has('origin'))researchHeaders.set('origin',base);
      if(url.pathname==='/api/local/library'||url.pathname.startsWith('/library/')){
        const library=await libraryResponse(new Request(url,{method:incoming.method,headers:researchHeaders}),{root:ROOT});
        outgoing.writeHead(library.status,Object.fromEntries(library.headers));outgoing.end(Buffer.from(await library.arrayBuffer()));return;
      }
      if(url.pathname==='/api/local/comparison'||url.pathname.startsWith('/comparison/')){
        const proxy=await comparisonResponse(new Request(url,{method:incoming.method,headers:researchHeaders}),{fetcher:comparisonFetcher});
        outgoing.writeHead(proxy.status,Object.fromEntries(proxy.headers));outgoing.end(Buffer.from(await proxy.arrayBuffer()));return;
      }
      if(incoming.method==='GET' && url.pathname==='/api/local/sync'){
        const marks=await highWaterMarks(db,learnerId);
        const row=await db.prepare('SELECT revision FROM learners WHERE learner_id=?').bind(learnerId).first();
        outgoing.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
        outgoing.end(JSON.stringify({revision:JSON.stringify([row?.revision ?? 0,marks]),enabled:autoGitSync,status:gitSync.status()}));return;
      }
      const headers = new Headers();
      for (const [key,value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key,Array.isArray(value)?value.join(','):value);
      if (!['GET','HEAD'].includes(incoming.method) && headers.get('origin') !== (appToken?allowedOrigin:base)) {
        outgoing.writeHead(403);outgoing.end('Same-origin required');return;
      }
      if(!['GET','HEAD'].includes(incoming.method)&&headers.get('content-type')?.split(';')[0].trim()!=='application/json'){outgoing.writeHead(403);outgoing.end('JSON required');return;}
      // Core keeps its same-origin invariant; the desktop origin was checked above.
      if(appToken&&headers.has('origin'))headers.set('origin',base);
      let body;
      if(!['GET','HEAD'].includes(incoming.method)){
        const chunks=[];let size=0;
        for await(const chunk of incoming){size+=chunk.length;if(size>2_000_000){outgoing.writeHead(413);outgoing.end('Request too large');return;}chunks.push(chunk);}
        body=Buffer.concat(chunks);
      }
      const request=new Request(url,{method:incoming.method,headers,...(body?{body}:{})});
      const response = await desktopResponse(request.clone(),{db,learnerId,catalogRoot,loadCatalog,loadCompany,gitSync,contestSchedule,...(submissionFetcher?{submissionFetcher}:{}),submissionSleep}) ?? await app.fetch(request);
      outgoing.writeHead(response.status,Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch(error) { outgoing.writeHead(400,{'content-type':'application/json'});outgoing.end(JSON.stringify({error:error.message??'Local service error'})); }
  });
  await new Promise((resolve,reject)=>server.once('error',reject).listen(port,'127.0.0.1',resolve));
  if(autoGitSync)gitSync.start();
  return {url:`http://127.0.0.1:${server.address().port}`,db,server,gitSync,
    async close(){ await contestSchedule.close();await gitSync.close();await new Promise(resolve=>server.close(resolve));db.close(); }};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {curriculum,annotations} = await import('./generated/curriculum.mjs');
  const args=process.argv.slice(2),arg=name=>{const i=args.indexOf('--'+name);return i<0?undefined:args[i+1];};
  const service = await startLocal({apiOnly:args.includes('--api-only'),appToken:process.env.APP_TOKEN,allowedOrigin:process.env.APP_ORIGIN,catalogRoot:arg('catalog-root'),companyRoot:arg('company-root'),port:Number(arg('port')??process.env.PORT ?? 8787),database:arg('database')??process.env.LOCAL_DATABASE,learnerId:process.env.LOCAL_LEARNER_ID ?? 'local-owner',curriculum,annotations,progressionVersion:process.env.PROGRESSION_VERSION??'v2'});
  console.log(`Private development service: ${service.url} (loopback only; not Access authentication)`);
  const stop = async()=>{await service.close();process.exit(0);};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
