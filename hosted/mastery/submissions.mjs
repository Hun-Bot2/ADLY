// Pure, Worker-safe normalizers: platform submission payloads -> layer-1 ledger entries
// (specs/submission-capture/design.md). No network, no Node APIs, no inference of unknown values (SC-6).
import {submissionIdentity} from '../providers.mjs';

const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
// Synchronous SHA-256 over a UTF-8 string (Web Crypto is async and node:crypto is not Worker-safe).
export function sha256Hex(input) {
  const data=new TextEncoder().encode(input),length=data.length;
  const padded=new Uint8Array(((length+9+63)>>6)<<6);
  padded.set(data); padded[length]=0x80;
  const view=new DataView(padded.buffer);
  view.setUint32(padded.length-8,Math.floor(length/0x20000000)); view.setUint32(padded.length-4,(length<<3)>>>0);
  const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64);
  const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  for (let offset=0;offset<padded.length;offset+=64) {
    for (let i=0;i<16;i++) w[i]=view.getUint32(offset+i*4);
    for (let i=16;i<64;i++) { const a=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3),b=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10); w[i]=(w[i-16]+a+w[i-7]+b)>>>0; }
    let [a,b,c,d,e,f,g,hh]=h;
    for (let i=0;i<64;i++) {
      const t1=(hh+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,hh].forEach((v,i)=>{ h[i]=(h[i]+v)>>>0; });
  }
  return [...h].map(v=>v.toString(16).padStart(8,'0')).join('');
}

const iso=seconds=>new Date(seconds*1000).toISOString().replace(/\.\d{3}Z$/,'.000000Z');
const intOrNull=v=>Number.isInteger(v) && v>=0 ? v : null;
const stringOrNull=(v,max)=>typeof v==='string' && v.trim() ? v.slice(0,max) : null;

const CF_VERDICTS={OK:'accepted',WRONG_ANSWER:'wrong_answer',TIME_LIMIT_EXCEEDED:'time_limit',MEMORY_LIMIT_EXCEEDED:'memory_limit',RUNTIME_ERROR:'runtime_error',COMPILATION_ERROR:'compile_error'};
const AC_VERDICTS={AC:'accepted',WA:'wrong_answer',TLE:'time_limit',MLE:'memory_limit',RE:'runtime_error',CE:'compile_error'};
// Still being judged: never stored (SC-4). AtCoder also reports progress such as "3/20".
const inProgress={codeforces:v=>v===undefined || v===null || v==='' || v==='TESTING',
  atcoder:v=>v===undefined || v===null || v==='' || ['WJ','WR','Judging'].includes(v) || /^\d+\/\d+$/.test(v)};

// Deterministic id: native when the platform gives one, else a fingerprint of platform|problem|second|raw verdict (SC-2).
export function submissionEntryId(platform,problemKey,submittedSecond,rawVerdict,nativeId=null) {
  if (nativeId!==null && nativeId!==undefined) return {entry_id:`sub:${platform}:${nativeId}`,submission_id:String(nativeId),id_kind:'native'};
  return {entry_id:`sub:${platform}:fp:${sha256Hex([platform,problemKey,submittedSecond,rawVerdict].join('|')).slice(0,24)}`,submission_id:null,id_kind:'fingerprint'};
}

function normalize(platform,items,{learnerId,recordedAt}) {
  if (!Array.isArray(items)) throw new Error('invalid_submissions');
  const entries=[],skipped={in_progress:0,invalid:0},recordedMs=Date.parse(recordedAt);
  for (const item of items) {
    const codeforces=platform==='codeforces';
    const raw=item && (codeforces ? item.verdict : item.result);
    try {
      if (!item || typeof item!=='object') throw new Error('invalid_submission');
      const {key,seconds,id}=submissionIdentity(platform,item);
      if (inProgress[platform](raw)) { skipped.in_progress++; continue; }
      if (typeof raw!=='string' || raw.length>64 || !Number.isInteger(seconds) || seconds<0 || seconds*1000>recordedMs) throw new Error('invalid_submission');
      const identity=submissionEntryId(platform,key,seconds,raw,Number.isInteger(id) && id>=0 ? id : null);
      const common={...identity,problem_key:key,verdict:(codeforces?CF_VERDICTS:AC_VERDICTS)[raw] ?? 'other',raw_verdict:raw,
        elapsed_seconds:null,active_seconds:null,time_source:'none',time_confidence:'none'};
      const payload=codeforces
        ? {platform,...common,language:stringOrNull(item.programmingLanguage,100),judge_time_ms:intOrNull(item.timeConsumedMillis),judge_memory_bytes:intOrNull(item.memoryConsumedBytes),
          passed_tests:intOrNull(item.passedTestCount),contest_id:Number.isInteger(item.contestId) ? String(item.contestId) : String(item.problem.contestId)}
        : {platform,...common,language:stringOrNull(item.language,100),judge_time_ms:intOrNull(item.execution_time),judge_memory_bytes:null,passed_tests:null,
          contest_id:stringOrNull(item.contest_id,64)};
      const {entry_id,...rest}=payload;
      entries.push({schema_version:1,entry_id,learner_id:learnerId,occurred_at:iso(seconds),recorded_at:recordedAt,
        source:codeforces?'codeforces_api':'atcoder_problems_api',supersedes:null,payload:rest});
    } catch (error) { if (error.message==='invalid_submission') skipped.invalid++; else throw error; }
  }
  return {entries,skipped};
}
// Codeforces user.status result items. Gym problems keep their native key (SC-7).
export const normalizeCodeforcesSubmissions=(items,options)=>normalize('codeforces',items,options);
// AtCoder Problems user/submissions items (unofficial source).
export const normalizeAtCoderSubmissions=(items,options)=>normalize('atcoder',items,options);
