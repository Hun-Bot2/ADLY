import {DatabaseSync} from 'node:sqlite';
const R=new URL('../../hosted/mastery/',import.meta.url).href;
const {attachCatalog,loadCatalog}=await import(R+'catalog.mjs');
const {relatedCandidates,trustedConcepts}=await import(R+'related.mjs');
const {fitAll}=await import(R+'calibration.mjs');
const db=new DatabaseSync(':memory:');
attachCatalog(db,process.env.CATALOG ?? 'private-learning/mastery/catalog-v4/catalog-v4.sqlite3',{verify:false});
const catalog=loadCatalog(db);
const abilities=fitAll([],catalog,[]);
// deterministic sample: LC recommendable sources with >=1 trusted concept, every k-th by key
const src=[...catalog.problems.values()].filter(p=>p.platform==='leetcode'&&p.eligible&&trustedConcepts(p).size).map(p=>p.key).sort();
const sample=src.filter((_,i)=>i%14===0); // ~195
const comps=['reviewed_edge','concept_jaccard','channel_rank','difficulty_fit','degraded_title','semantic_only'];
const W={reviewed_edge:1,concept_jaccard:1,channel_rank:1,difficulty_fit:1,degraded_title:1,semantic_only:1};
const top=(cands,w,k=3)=>cands.map(c=>({k:c.problem_key,s:comps.reduce((s,x)=>s+w[x]*c.components[x],0)})).sort((a,b)=>b.s-a.s||a.k.localeCompare(b.k)).slice(0,k).map(x=>x.k);
const overlap=(a,b)=>a.length?a.filter(x=>b.includes(x)).length/Math.max(a.length,b.length):1;
const variants={no_jaccard:{...W,concept_jaccard:0},no_channel:{...W,channel_rank:0},no_difficulty:{...W,difficulty_fit:0},jaccard_x2:{...W,concept_jaccard:2},difficulty_x0_5:{...W,difficulty_fit:0.5},channel_x2:{...W,channel_rank:2}};
const acc=Object.fromEntries(Object.keys(variants).map(v=>[v,[]])); const stats={pool:[],var:{}}; let semTop=0,chanTop=0,tot=0,diffs=[],ptop=[];
const contrib={}; for(const c of comps)contrib[c]=[];
for(const key of sample){
  const r=relatedCandidates({sourceKey:key,catalog,abilities,limit:100000});
  const all=r.candidates; stats.pool.push(all.length); if(!all.length)continue;
  const base=top(all,W);
  for(const [v,w] of Object.entries(variants)) acc[v].push(overlap(base,top(all,w)));
  for(const c of comps){const vals=all.map(x=>x.components[c]);const m=vals.reduce((a,b)=>a+b,0)/vals.length;contrib[c].push(Math.sqrt(vals.reduce((a,b)=>a+(b-m)**2,0)/vals.length));}
  const t=all.slice(0,3); tot+=t.length; semTop+=t.filter(x=>x.semantic_only).length; chanTop+=t.filter(x=>x.channel_rank!==null).length;
  for(const x of t){diffs.push(x.platform+':'+catalog.problems.get(x.problem_key).difficulty_value);ptop.push(x.prediction.p_conservative);}
}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length, q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(p*(s.length-1))];};
console.log('sources',sample.length,'pool size median/p5/p95',q(stats.pool,.5),q(stats.pool,.05),q(stats.pool,.95));
console.log('top3 overlap with base (mean over sources):');for(const [v,a] of Object.entries(acc))console.log(' ',v,mean(a).toFixed(3));
console.log('within-pool SD per component (mean over sources):');for(const c of comps)console.log(' ',c,mean(contrib[c]).toFixed(3));
console.log('top3: semantic_only share',(semTop/tot).toFixed(3),'with channel rank',(chanTop/tot).toFixed(3));
const dc={};for(const d of diffs){dc[d]=(dc[d]||0)+1;}console.log('top3 difficulty values (most common)',Object.entries(dc).sort((a,b)=>b[1]-a[1]).slice(0,8));
console.log('top3 p_conservative median',q(ptop,.5),'p5',q(ptop,.05),'p95',q(ptop,.95));
