import {DatabaseSync} from 'node:sqlite';
const R=new URL('../../hosted/mastery/',import.meta.url).href;
const {attachCatalog,loadCatalog}=await import(R+'catalog.mjs');
const {planProgression}=await import(R+'progression.mjs');
const {planDay}=await import(R+'planner.mjs');
const {trustedConcepts}=await import(R+'related.mjs');
const pattern=(await import(R+'progression-pattern.v1.json',{with:{type:'json'}})).default;
const interview=(await import(R+'interview-curriculum.v1.json',{with:{type:'json'}})).default;
const db=new DatabaseSync(':memory:');
attachCatalog(db,process.env.CATALOG ?? 'private-learning/mastery/catalog-v4/catalog-v4.sqlite3',{verify:false});
const catalog=loadCatalog(db); catalog.base_version='catalog-v4';
const config={...pattern,...interview,version:pattern.version};
let n=0; const at=(d)=>`2026-10-${String(d).padStart(2,'0')}T03:00:00Z`;
const att=(key,y,day,extra={})=>({id:'a'+(n++),problem_key:key,occurred_at:at(day),outcome:y?'independent':'failed',hints:y?false:null,activity_type:'practice',...extra});
const prog=(attempts,date='2026-10-28')=>planProgression({date,ledger:{attempts,cutoff:null},catalog,config});
const show=(label,p)=>{const nx=p.next;const pr=nx&&catalog.problems.get(nx.problem_key);console.log(label,'=>',nx?.concept,nx?.stage,nx?.problem_key,pr?`diff=${pr.difficulty_value} concepts=[${[...trustedConcepts(pr)]}]`:'',JSON.stringify(nx?.prediction??null));};
// 1. cold start
const cold=prog([]); show('cold',cold);
// how candidate chosen: list first 5 alphabetical easy arrays-hashing pool vs predicted
const pool=[...catalog.problems.values()].filter(p=>p.platform==='leetcode'&&p.difficulty_value===1&&p.eligible&&trustedConcepts(p).has('arrays-hashing')).map(p=>p.key).sort();
console.log('easy arrays-hashing pool size',pool.length,'first',pool.slice(0,5));
// 2. follow the recommendations greedily, solving everything; record path
let attempts=[],day=1,path=[];
for(let i=0;i<12;i++){const p=prog(attempts,`2026-10-${String(day).padStart(2,'0')}`);const nx=p.next;if(!nx){path.push('none');break;}
  const extra=nx.stage==='cross_platform_transfer'?{activity_type:'transfer',transfer_from:nx.transfer_from}:nx.stage==='retention_review'?{activity_type:'review'}:{};
  path.push(`${nx.concept}/${nx.stage}/${nx.problem_key}`);attempts.push(att(nx.problem_key,1,day,extra));day+=1;}
console.log('greedy all-solved path:\n '+path.join('\n '));
// 3. blocked concepts: which concepts have stage current but no candidate at their stage across a fully-progressed learner? Use per-concept transfer pool from progression states
const st=prog(attempts).concepts;
console.log('status counts',Object.entries(Object.values(st).reduce((m,s)=>(m[s.status+':'+s.next_stage]=(m[s.status+':'+s.next_stage]||0)+1,m),{})));
// 4. structural dead ends: for each concept, simulate 3E+2M solves then ask for transfer candidate
const dead=[];
for(const c of interview.concept_order){
  const E=[...catalog.problems.values()].filter(p=>p.platform==='leetcode'&&p.difficulty_value===1&&p.eligible&&trustedConcepts(p).has(c));
  const M=[...catalog.problems.values()].filter(p=>p.platform==='leetcode'&&p.difficulty_value===2&&p.eligible&&trustedConcepts(p).has(c));
  // pick distinct-signature problems
  const sig=p=>[...trustedConcepts(p)].sort().join(',')+'|'+p.tags.map(t=>t.toLowerCase()).sort().join(',');
  const pickD=(L,k)=>{const s=new Set(),o=[];for(const p of L.sort((a,b)=>a.key.localeCompare(b.key))){if(!s.has(sig(p))){s.add(sig(p));o.push(p);}if(o.length===k)break;}return o;};
  const ea=pickD(E,3),me=pickD(M,2);
  if(ea.length<3||me.length<2){dead.push([c,'easy/medium variation shortage',ea.length,me.length]);continue;}
  const as=[...ea,...me].map((p,i)=>att(p.key,1,i+1));
  // satisfy prerequisites by pretending none (use config without prereqs)
  const p=planProgression({date:'2026-10-28',ledger:{attempts:as,cutoff:null},catalog,config:{...config,prerequisites:{}}});
  const s=p.concepts[c];
  dead.push([c,s.next_stage,s.next_candidate,s.unverified_semantic_fallback?.problem_key??null]);
}
console.log('per-concept after 3E+2M (prereqs ignored): [concept, stage, candidate, semantic_fallback]');for(const d of dead)console.log(' ',JSON.stringify(d), catalog.problems.get(d[2])?`diff=${catalog.problems.get(d[2]).difficulty_value}`:'');
