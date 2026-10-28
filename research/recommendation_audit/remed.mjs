const R=new URL('../../hosted/mastery/',import.meta.url).href;
const {catalogFromData}=await import(R+'catalog.mjs');
const {planDay}=await import(R+'planner.mjs');
const {fitAll,predict}=await import(R+'calibration.mjs');
const C=id=>[{id,status:'ai_reviewed'}];
const problems=[{key:'leetcode:x',platform:'leetcode',difficulty_kind:'lc_level',difficulty_value:2,concepts:C('dp')},
 ...Array.from({length:30},(_,i)=>({key:`leetcode:p${String(i).padStart(2,'0')}`,platform:'leetcode',difficulty_kind:'lc_level',difficulty_value:1+(i%3),concepts:C(i%2?'dp':'greedy')}))];
const catalog=catalogFromData({problems,concepts:[{id:'dp'},{id:'greedy'}]});
const prefs={weekly_rhythm:['practice','practice','practice','practice','practice','review','review'],weekday_minutes:120,mastery:{practice_platform:'leetcode',contest_platforms:['codeforces']}};
const failed={id:'f1',problem_key:'leetcode:x',occurred_at:'2026-08-01T03:00:00Z',outcome:'failed',hints:null,activity_type:'practice'};
for (const date of ['2026-08-03','2026-10-28']) {
  const p=planDay({date,now:date+'T00:00:00Z',ledger:{attempts:[failed],cutoff:null},catalog,preferences:prefs});
  console.log(date,'slots:',p.slots.map(s=>s.kind+(s.sub_kind?'/'+s.sub_kind:'')+':'+s.problem_key).join(' | '),'rotation:',p.rotation?.used);
}
// repeated solves of the same CF problem inflate ability
const cf={key:'codeforces:1A',platform:'codeforces',difficulty_kind:'cf_rating',difficulty_value:800};
const cat2=catalogFromData({problems:[cf]});
for (const k of [1,5,20]) { const at=Array.from({length:k},(_,i)=>({id:'r'+i,problem_key:cf.key,occurred_at:`2026-10-01T00:00:${String(i).padStart(2,'0')}Z`,outcome:'independent',hints:false,activity_type:'practice'}));
  const a=fitAll(at,cat2,[]).codeforces; console.log(`CF same problem solved x${k}: mean=${a.mean.toFixed(0)} sd=${a.sd.toFixed(0)} status=${a.status}`); }
