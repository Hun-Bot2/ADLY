import {searchProblems} from './local-problems.mjs';
// Local-only desktop bridge. The engine remains the sole learner-state writer.
import {registerRepository} from './mastery/git-ingest.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {attachCatalog} from './mastery/catalog.mjs';
import {appendLedger} from './mastery/side-ledger.mjs';
import {parseDailyLog,dailyLogKeys} from './mastery/daily-log.mjs';
import {syncSubmissions,lastMark} from './mastery/submission-sync.mjs';
import {getPreferences,putPreferences} from './core/store.mjs';
import {companySummary,validateCompanyFocus,companyScope} from './mastery/company.mjs';
import {companyMockContest,snapshotExposures} from './mastery/mock-contest.mjs';
import {buildWeeklyReport} from './mastery/weekly.mjs';
import {weekInfo} from './mastery/planner.mjs';
import {saveSnapshot} from './mastery/ledger.mjs';
import {normalizeMastery} from './core/preferences.mjs';
import {seoulDate} from './core/policy.mjs';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const SYNC_PLATFORMS=['codeforces','atcoder'];
let submissionSyncRunning=false;
export async function desktopResponse(request,{db,learnerId,catalogRoot,loadCatalog,loadCompany,gitSync,contestSchedule,submissionFetcher=fetch,submissionSleep}) {
  const {pathname:path,searchParams}=new URL(request.url),method=request.method;
  if(path==='/api/local/contest-sync'){if(method==='GET')return json(contestSchedule.status());if(method==='PUT')return json(await contestSchedule.configure(await request.json()));}
  if(path==='/api/local/repositories'){if(method==='GET')return json({repositories:(await db.prepare('SELECT repo_id,path_hint AS path,branch FROM git_repositories WHERE learner_id=? ORDER BY repo_id').bind(learnerId).all()).results});if(method==='POST'){const input=await request.json();if(!input||Object.keys(input).some(k=>!['repoId','path','branch'].includes(k)))throw new Error('invalid repository registration');return json(await registerRepository(db,learnerId,input),201);}}
  if(path==='/api/problems'&&method==='GET'){let catalog;try{catalog=(await loadCatalog()).catalog;}catch{return json({available:false,reason:'활성 카탈로그가 없습니다.',items:[],total:0});}return json(searchProblems(catalog,searchParams));}
  if(path==='/api/health'&&method==='GET')return json({ok:true,api_version:1});
  if(path==='/api/local/ingest'&&method==='POST')return json(await gitSync.tick());
  if(path==='/api/catalog/use'&&method==='POST'){
    const {version}=await request.json();
    if(typeof version!=='string'||!/^catalog-v[1-9]\d*$/.test(version))throw new Error('invalid catalog version');
    const info=attachCatalog(db.sqlite,join(catalogRoot,version,version+'.sqlite3'));
    const {readLedger}=await import('./mastery/ledger.mjs');const ledger=await readLedger(db,learnerId);
    const previous=ledger.catalog_switches.at(-1)?.payload.to_version??null;
    if(previous===version)return json({active:version,changed:false});
    const at=new Date().toISOString();
    await appendLedger(db,learnerId,{catalog_switches:[{schema_version:1,entry_id:randomUUID(),learner_id:learnerId,occurred_at:at,recorded_at:at,source:'manual',supersedes:null,payload:{from_version:previous,to_version:version,catalog_sha256:info.sha256}}]});
    return json({active:version,previous,sha256:info.sha256});
  }
  if(path==='/api/local/daily-log/validate'&&method==='POST'){
    const input=await request.json();
    if(typeof input.path!=='string'||typeof input.source!=='string'||input.source.length>1_000_000)throw new Error('invalid daily log');
    return json(parseDailyLog(input.path,input.source,(await loadCatalog()).catalog));
  }
  // Submission capture (specs/submission-capture S6-S7). Network only on an explicit POST from the user.
  if(path==='/api/local/submissions'&&method==='GET'){
    const {readLedger}=await import('./mastery/ledger.mjs');const ledger=await readLedger(db,learnerId),preferences=await getPreferences(db,learnerId);
    const accounts=preferences.platform_accounts??{},counts={};
    for(const r of ledger.platform_submissions??[]){const c=counts[r.payload.platform]??={submissions:0,accepted:0};c.submissions++;if(r.payload.verdict==='accepted')c.accepted++;}
    return json({accounts,running:submissionSyncRunning,platforms:Object.fromEntries(SYNC_PLATFORMS.map(p=>{const m=lastMark(ledger,p,accounts[p]);return [p,{handle:accounts[p]??null,counts:counts[p]??{submissions:0,accepted:0},last:m?{recorded_at:m.recorded_at,status:m.payload.status,fetched:m.payload.fetched,detail:m.payload.detail}:null}];}))});
  }
  if(path==='/api/local/submissions/sync'&&method==='POST'){
    const input=await request.json();
    if(!input||Object.keys(input).some(k=>!['platform','handle'].includes(k))||!SYNC_PLATFORMS.includes(input.platform))throw new Error('invalid submission sync request');
    const preferences=await getPreferences(db,learnerId),accounts=preferences.platform_accounts??{};
    const handle=typeof input.handle==='string'&&input.handle.trim()?input.handle.trim():accounts[input.platform];
    if(!handle)throw new Error('handle required');
    if(submissionSyncRunning)return json({error:'submission sync already running'},409);
    if(accounts[input.platform]!==handle)await putPreferences(db,learnerId,{platform_accounts:{...accounts,[input.platform]:handle}});
    submissionSyncRunning=true;
    try{return json(await syncSubmissions(db,learnerId,{platform:input.platform,handle,fetcher:submissionFetcher,...(submissionSleep?{sleep:submissionSleep}:{})}));}
    finally{submissionSyncRunning=false;}
  }
  // Problem-days known only from platform submissions: the rows S7 may append to <platform>/YY-MM-DD.md.
  if(path==='/api/local/submissions/log-candidates'&&method==='GET'){
    const {ledger,catalog}=await loadCatalog(),items=[];
    for(const a of ledger.attempts){
      if(a.evidence_source!=='platform_submission')continue;
      const p=catalog.problems.get(a.problem_key);
      if(!p||!SYNC_PLATFORMS.includes(p.platform)||typeof p.url!=='string')continue;   // gym/unknown problems stay out of the log (SC-7)
      items.push({platform:p.platform,date:a.id.slice(-10),problem_key:a.problem_key,url:p.url,title:p.title,solved:a.outcome==='independent'});
    }
    return json({items:items.sort((x,y)=>x.date.localeCompare(y.date)||x.problem_key.localeCompare(y.problem_key))});
  }
  if(path==='/api/local/daily-log/keys'&&method==='POST'){
    const input=await request.json();
    if(typeof input.path!=='string'||typeof input.source!=='string'||input.source.length>1_000_000)throw new Error('invalid daily log');
    return json({keys:dailyLogKeys(input.path,input.source,(await loadCatalog()).catalog)});
  }
  if(path==='/api/company/mock'&&method==='POST'){
    const input=await request.json(),{catalog,ledger}=await loadCatalog(),layer=await loadCompany(catalog);
    const preferences=await getPreferences(db,learnerId),focus=input.focus??preferences.mastery?.company_focus;
    if(!focus)throw new Error('select a company focus first');validateCompanyFocus(focus,layer);
    const rows=(await db.prepare('SELECT kind,local_date,payload FROM recommendation_snapshots WHERE learner_id=?').bind(learnerId).all()).results.map(r=>({...r,payload:JSON.parse(r.payload)}));
    const date=seoulDate(new Date()),scope=companyScope(layer,focus);
    const kind='company_mock-'+createHash('sha256').update(JSON.stringify([catalog.version,scope.company_id,scope.window,scope.layer_sha256])).digest('hex').slice(0,24);
    const existing=rows.find(r=>r.kind===kind&&r.local_date===date);
    const report=buildWeeklyReport({ledger,catalog,plans:rows.map(r=>r.payload).filter(p=>Array.isArray(p.slots)),weekStart:weekInfo(date).weekStart,preferences});
    if(existing)return json({...existing.payload,frozen:true});
    const record=companyMockContest({catalog,attempts:ledger.attempts,exposures:snapshotExposures(rows),weakConcepts:report.weaknesses.map(w=>w.concept),learnerId,date,mastery:normalizeMastery(preferences.mastery),scope,count:input.count??2,minutes:input.minutes??45});
    return json(await saveSnapshot(db,learnerId,kind,date,record),201);
  }
  if(path==='/api/company'||path.startsWith('/api/company/')){
    let context;try{context=await loadCatalog();}catch{return json({available:false,reason:'company data not available for this catalog version'});}
    const {catalog,ledger}=context,layer=await loadCompany(catalog);
    if(!layer?.available)return json({available:false,reason:layer?.reason??'company data not available for this catalog version'});
    const companyId=path==='/api/company'?null:decodeURIComponent(path.slice('/api/company/'.length));
    if(method==='GET')return json({available:true,...companySummary(layer,catalog,ledger.attempts,{companyId,window:searchParams.get('window')??'all'})});
  }
  if(path==='/api/preferences'&&method==='PUT'){
    const input=await request.json();
    if(input?.mastery?.company_focus){const {catalog}=await loadCatalog();validateCompanyFocus(input.mastery.company_focus,await loadCompany(catalog));}
    return json(await putPreferences(db,learnerId,input));
  }
  return null;
}
