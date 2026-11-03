// Explicit, rate-limited platform submission sync (specs/submission-capture SC-13/SC-14). The fetcher is
// injected: nothing here touches the network unless a caller runs it. Rows are appended page by page;
// every run ends with exactly one sync mark (ok | partial | error) and an error never removes stored rows.
import {appendLedger,listEntries} from './side-ledger.mjs';
import {isInProgress,normalizeAtCoderSubmissions,normalizeCodeforcesSubmissions} from './submissions.mjs';

const HANDLE=/^[A-Za-z0-9_.-]{1,64}$/;
const SOURCE={codeforces:'codeforces_api',atcoder:'atcoder_problems_api'};
const GAP_MS={codeforces:2000,atcoder:1000}; // Codeforces asks for one call per 2 s; AtCoder Problems at least 1 s (SC-14).
const PAGE_SIZE={codeforces:100,atcoder:500};
const CRAWL_OVERLAP_S=86400;
const iso=ms=>new Date(ms).toISOString().replace(/\.\d{3}Z$/,'.000000Z');

async function fetchJson(fetcher,url) {
  const response=await fetcher(url,{headers:{accept:'application/json','user-agent':'AlgorithmRAGEngine-mastery/1.0'},signal:AbortSignal.timeout(15000)});
  const text=await response.text();
  if (text.length>8_000_000) throw new Error('response too large');
  let body=null; try { body=JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(`http ${response.status}${typeof body?.comment==='string' ? ': '+body.comment.slice(0,200) : ''}`);
  if (body===null) throw new Error('response is not JSON');
  return body;
}

export const marksOf=(ledger,platform,handle)=>(ledger.submission_sync_marks ?? []).filter(m=>m.payload.platform===platform && (handle===undefined || m.payload.handle===handle));
export function lastMark(ledger,platform,handle) { return marksOf(ledger,platform,handle).sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at) || a.entry_id.localeCompare(b.entry_id)).at(-1) ?? null; }

// Codeforces cursor `cf2:<low>:<high>:<top>:<off>:<done>`. Anything else (including the old offset form) restarts
// from the newest page; that only re-reads rows, which dedupe by id.
const CF_CURSOR=/^cf2:(\d*):(\d*):(\d*):(\d+):([01])$/;
export function parseCodeforcesCursor(cursor) {
  const m=CF_CURSOR.exec(cursor ?? ''), n=v=>v==='' ? null : Number(v);
  const st=m ? {low:n(m[1]),high:n(m[2]),top:n(m[3]),off:Number(m[4]),done:m[5]==='1'} : null;
  return st && st.top!==null && st.high!==null && st.low!==null ? st : {low:null,high:null,top:null,off:0,done:false};
}
export const formatCodeforcesCursor=st=>`cf2:${st.low ?? ''}:${st.high ?? ''}:${st.top ?? ''}:${st.off}:${st.done ? 1 : 0}`;

/** Runs one sync. Returns {status,fetched,pages,cursor,detail,skipped}. */
export async function syncSubmissions(db,learnerId,{platform,handle,fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),pages=10}={}) {
  if (!SOURCE[platform]) throw new Error('unsupported platform');
  if (typeof handle!=='string' || !HANDLE.test(handle)) throw new Error('invalid handle');
  if (!Number.isInteger(pages) || pages<1 || pages>50) throw new Error('pages must be 1-50');
  const recordedAt=iso(now.getTime());
  const allMarks=(await listEntries(db,'submission_sync_marks',learnerId));
  const handleMarks=allMarks.filter(m=>m.payload.platform===platform && m.payload.handle===handle).sort((a,b)=>a.sequence-b.sequence);
  const previous=handleMarks.at(-1) ?? null;
  const known=new Set((await listEntries(db,'platform_submissions',learnerId)).map(e=>e.entry_id));
  let fetched=0,requests=0,newest=handleMarks.map(m=>m.payload.newest_submitted_at).filter(Boolean).sort().at(-1) ?? null;
  const skipped={in_progress:0,invalid:0};
  let status='ok',cursor=null,detail=null;
  const get=async url=>{ if (requests++) await sleep(GAP_MS[platform]); return fetchJson(fetcher,url); };
  const store=async entries=>{
    const fresh=entries.filter(e=>!known.has(e.entry_id));
    if (fresh.length) await appendLedger(db,learnerId,{platform_submissions:fresh});
    fresh.forEach(e=>known.add(e.entry_id)); fetched+=fresh.length;
    for (const e of entries) if (!newest || e.occurred_at>newest) newest=e.occurred_at;
  };
  const normalizeInto=async list=>{
    const {entries,skipped:s}=(platform==='codeforces' ? normalizeCodeforcesSubmissions : normalizeAtCoderSubmissions)(list,{learnerId,recordedAt});
    skipped.in_progress+=s.in_progress; skipped.invalid+=s.invalid;
    await store(entries);
  };
  if (platform==='codeforces') {
    // user.status is newest first (descending id), so offsets shift whenever new submissions arrive. State is
    // id-based: ids in [low, high] are all stored, `top` is the newest id seen, `off` the offset hint for low.
    const st=parseCodeforcesCursor(previous?.payload.cursor);
    let budget=pages,pendingMin=null,headClosed=st.top===null;
    const page=async offset=>{
      if (budget<=0) return null;
      budget--;
      const body=await get(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=${offset+1}&count=${PAGE_SIZE.codeforces}`);
      if (body.status!=='OK' || !Array.isArray(body.result) || body.result.length>PAGE_SIZE.codeforces) throw new Error(`Codeforces: ${typeof body.comment==='string' ? body.comment.slice(0,200) : 'invalid response'}`);
      await normalizeInto(body.result);
      const ids=body.result.map(r=>r?.id).filter(Number.isInteger);
      for (const r of body.result) if (isInProgress('codeforces',r) && Number.isInteger(r.id)) pendingMin=pendingMin===null ? r.id : Math.min(pendingMin,r.id);
      return {length:body.result.length,ids};
    };
    try {
      // 1. Head: newest pages until one reaches a covered id (<= high). Only then is the gap above `high` closed.
      if (!headClosed) {
        let top=st.top,added=0;
        for (let offset=0;;) {
          const p=await page(offset); if (!p) break;
          for (const id of p.ids) { if (id>top) { top=id; } if (id>st.top) added++; }
          offset+=p.length;
          if (p.ids.some(id=>id<=st.high) || p.length<PAGE_SIZE.codeforces) { headClosed=true; break; }
        }
        if (headClosed) { st.top=top; st.high=top; st.off+=added; }   // new rows above low shift low's offset by `added`
      }
      // 2. Backfill below `low`. The first page starts one row early, at `low` itself, so the overlap is checked:
      //    if it already starts below `low`, rows were removed upstream and the hint overshot; step back a page.
      if (headClosed && !st.done) {
        let offset=st.low===null ? 0 : Math.max(0,st.off-1),verified=st.low===null;
        for (;;) {
          const p=await page(offset); if (!p) break;
          if (!verified && offset>0 && p.ids.length && p.ids[0]<st.low) { offset=Math.max(0,offset-PAGE_SIZE.codeforces); continue; }
          verified=true;
          if (p.ids.length) {
            const max=Math.max(...p.ids),min=Math.min(...p.ids);
            if (st.top===null || max>st.top) { st.top=max; st.high=max; }
            st.low=st.low===null ? min : Math.min(st.low,min);
          }
          offset+=p.length; st.off=offset;
          if (p.length<PAGE_SIZE.codeforces) { st.done=true; break; }
        }
      }
      if (!headClosed) { status='partial'; detail=`more than ${pages} page(s) of new submissions; run sync again`; }
      else if (!st.done) { status='partial'; detail=`page limit reached after ${requests} request(s)`; }
    } catch (error) { status='error'; detail=String(error.message ?? error).slice(0,500); }
    // A submission still being judged must be re-read: keep `high` below it so the next head reaches it.
    if (headClosed && pendingMin!==null && st.high!==null) st.high=Math.min(st.high,pendingMin-1);
    cursor=formatCodeforcesCursor(st);
  } else {
    // AtCoder Problems: `epoch_second >= from_second ORDER BY epoch_second LIMIT 500` (no id tiebreak). The
    // cursor is a second; each page re-reads its last second (rows dedupe by id). A new run starts
    // CRAWL_OVERLAP_S before the cursor because the crawler can add older submissions late.
    const start=previous?.payload.cursor!=null && /^\d+$/.test(previous.payload.cursor) ? Number(previous.payload.cursor) : 0;
    let from=Math.max(0,start-(start>0 ? CRAWL_OVERLAP_S : 0)),safe=start,pendingMin=null;
    try {
      for (let used=0;; used++) {
        if (used===pages) { status='partial'; detail=`page limit reached after ${pages} request(s)`; break; }
        const list=await get(`https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${from}`);
        if (!Array.isArray(list) || list.length>PAGE_SIZE.atcoder) throw new Error('AtCoder Problems: invalid response');
        await normalizeInto(list);
        for (const r of list) if (isInProgress('atcoder',r) && Number.isInteger(r.epoch_second)) pendingMin=pendingMin===null ? r.epoch_second : Math.min(pendingMin,r.epoch_second);
        const last=Math.max(from,...list.filter(r=>Number.isInteger(r?.epoch_second)).map(r=>r.epoch_second));
        if (list.length<PAGE_SIZE.atcoder) { safe=Math.max(safe,last); break; }
        if (last===from) { status='partial'; detail='a full page shares one second; cannot advance'; break; }
        safe=Math.max(safe,last); from=last;   // `last` itself is re-read by the next page
      }
    } catch (error) { status='error'; detail=String(error.message ?? error).slice(0,500); }
    // Never move the cursor past a submission still being judged.
    if (pendingMin!==null) safe=Math.min(safe,pendingMin);
    cursor=String(safe);
  }
  const extra=skipped.in_progress||skipped.invalid ? `skipped in_progress=${skipped.in_progress} invalid=${skipped.invalid}` : null;
  if (extra) detail=detail ? `${detail}; ${extra}` : extra;
  const mark={schema_version:1,entry_id:`submark:${platform}:${handle.toLowerCase()}:${handleMarks.length+1}`,learner_id:learnerId,occurred_at:recordedAt,recorded_at:recordedAt,
    source:SOURCE[platform],supersedes:null,payload:{platform,handle,cursor,newest_submitted_at:newest,status,fetched,detail}};
  await appendLedger(db,learnerId,{submission_sync_marks:[mark]});
  return {platform,handle,status,fetched,requests,cursor,newest_submitted_at:newest,detail,skipped};
}

/** Read-only summary for `submissions list`. */
export function summarizeSubmissions(ledger,{platform=null,limit=10}={}) {
  const rows=(ledger.platform_submissions ?? []).filter(r=>!platform || r.payload.platform===platform);
  const byPlatform={};
  for (const r of rows) { const c=byPlatform[r.payload.platform] ??= {submissions:0,accepted:0}; c.submissions++; if (r.payload.verdict==='accepted') c.accepted++; }
  return {counts:byPlatform,recent:rows.slice(-limit).reverse().map(r=>({occurred_at:r.occurred_at,platform:r.payload.platform,problem_key:r.payload.problem_key,verdict:r.payload.verdict,submission_id:r.payload.submission_id})),
    marks:(ledger.submission_sync_marks ?? []).filter(m=>!platform || m.payload.platform===platform).slice(-limit).map(m=>({recorded_at:m.recorded_at,...m.payload}))};
}
