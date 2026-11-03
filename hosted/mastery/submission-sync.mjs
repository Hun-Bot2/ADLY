// Explicit, rate-limited platform submission sync (specs/submission-capture SC-13/SC-14). The fetcher is
// injected: nothing here touches the network unless a caller runs it. Rows are appended page by page;
// every run ends with exactly one sync mark (ok | partial | error) and an error never removes stored rows.
import {appendLedger,listEntries} from './side-ledger.mjs';
import {normalizeAtCoderSubmissions,normalizeCodeforcesSubmissions} from './submissions.mjs';

const HANDLE=/^[A-Za-z0-9_.-]{1,64}$/;
const SOURCE={codeforces:'codeforces_api',atcoder:'atcoder_problems_api'};
const GAP_MS={codeforces:2000,atcoder:1000}; // Codeforces asks for one call per 2 s; AtCoder Problems at least 1 s (SC-14).
const PAGE_SIZE={codeforces:100,atcoder:500};
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

/** Runs one sync. Returns {status,fetched,pages,cursor,detail,skipped}. */
export async function syncSubmissions(db,learnerId,{platform,handle,fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),pages=10}={}) {
  if (!SOURCE[platform]) throw new Error('unsupported platform');
  if (typeof handle!=='string' || !HANDLE.test(handle)) throw new Error('invalid handle');
  if (!Number.isInteger(pages) || pages<1 || pages>50) throw new Error('pages must be 1-50');
  const recordedAt=iso(now.getTime());
  const allMarks=(await listEntries(db,'submission_sync_marks',learnerId));
  const handleMarks=allMarks.filter(m=>m.payload.platform===platform && m.payload.handle===handle).sort((a,b)=>a.sequence-b.sequence);
  const previous=handleMarks.at(-1) ?? null, hasOk=handleMarks.some(m=>m.payload.status==='ok');
  const known=new Set((await listEntries(db,'platform_submissions',learnerId)).map(e=>e.entry_id));
  let fetched=0,requests=0,newest=handleMarks.map(m=>m.payload.newest_submitted_at).filter(Boolean).sort().at(-1) ?? null;
  const skipped={in_progress:0,invalid:0};
  let status='ok',cursor=null,detail=null;
  const cf={offset:0,phase:'head',resume:previous && previous.payload.status!=='ok' && previous.payload.cursor!==null && platform==='codeforces' ? Number(previous.payload.cursor) : null};
  const cfCursor=()=>String(cf.phase==='head' && cf.resume!==null ? cf.resume : cf.offset);
  const get=async url=>{ if (requests++) await sleep(GAP_MS[platform]); return fetchJson(fetcher,url); };
  const store=async entries=>{
    const fresh=entries.filter(e=>!known.has(e.entry_id));
    if (fresh.length) await appendLedger(db,learnerId,{platform_submissions:fresh});
    fresh.forEach(e=>known.add(e.entry_id)); fetched+=fresh.length;
    for (const e of entries) if (!newest || e.occurred_at>newest) newest=e.occurred_at;
    return entries.length-fresh.length;
  };
  try {
    if (platform==='codeforces') {
      // Newest first. Resume point = offset after the last stored page; later offsets can only grow, so re-reads are harmless.
      let complete=false,used=0;
      for (; used<pages; used++) {
        const body=await get(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=${cf.offset+1}&count=${PAGE_SIZE.codeforces}`);
        if (body.status!=='OK' || !Array.isArray(body.result) || body.result.length>PAGE_SIZE.codeforces) throw new Error(`Codeforces: ${typeof body.comment==='string' ? body.comment.slice(0,200) : 'invalid response'}`);
        const {entries,skipped:s}=normalizeCodeforcesSubmissions(body.result,{learnerId,recordedAt});
        skipped.in_progress+=s.in_progress; skipped.invalid+=s.invalid;
        const knownHit=await store(entries)>0;
        cf.offset+=body.result.length;
        if (body.result.length<PAGE_SIZE.codeforces) { complete=true; used++; break; }
        if (cf.phase==='head' && knownHit && (hasOk || cf.resume!==null)) {
          if (cf.resume===null) { complete=true; used++; break; }
          cf.offset=Math.max(cf.offset,cf.resume); cf.phase='tail';
        }
      }
      if (!complete) { status='partial'; cursor=cfCursor(); detail=`page limit reached after ${used} request(s)`; }
    } else {
      // Ascending from cursor second; the boundary second is re-read and de-duplicated.
      let from=previous?.payload.cursor!=null ? Number(previous.payload.cursor) : 0;
      cursor=String(from);
      for (let used=0; used<pages; used++) {
        const list=await get(`https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${from}`);
        if (!Array.isArray(list) || list.length>PAGE_SIZE.atcoder) throw new Error('AtCoder Problems: invalid response');
        const {entries,skipped:s}=normalizeAtCoderSubmissions(list,{learnerId,recordedAt});
        skipped.in_progress+=s.in_progress; skipped.invalid+=s.invalid;
        await store(entries);
        const last=Math.max(from,...list.filter(r=>Number.isInteger(r.epoch_second)).map(r=>r.epoch_second));
        if (list.length<PAGE_SIZE.atcoder) { cursor=String(last); break; }
        if (last===from) { status='partial'; cursor=String(from); detail='a full page shares one second; cannot advance'; break; }
        from=last; cursor=String(from);
        if (used===pages-1) { status='partial'; detail=`page limit reached after ${pages} request(s)`; }
      }
    }
  } catch (error) {
    status='error'; detail=String(error.message ?? error).slice(0,500);
    // Keep the resume point reached so far; stored rows are untouched.
    if (platform==='codeforces') cursor=cf.offset>0 ? cfCursor() : cf.resume!==null ? String(cf.resume) : null;
    else cursor=cursor ?? previous?.payload.cursor ?? null;
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
