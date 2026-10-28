import {fitLeetCode,fitAbility,predict,atcoderInternalRating,priorFor} from '../../hosted/mastery/calibration.mjs';
const obs=(cells)=>Object.entries(cells).flatMap(([l,[s,n]])=>Array.from({length:n},(_,i)=>({problem:{difficulty_value:Number(l)},y:i<s?1:0})));
const lc=c=>Object.fromEntries(Object.entries(fitLeetCode(obs(c)).levels).map(([l,v])=>[l,{mean:+v.mean.toFixed(6),sd:+v.sd.toFixed(6)}]));
const CFp={mean:1000,sd:350,at:null};
const ab=(o,prior=CFp)=>{const r=fitAbility('codeforces',o.map(([t,d,y])=>({occurred_at:t,problem:{difficulty_value:d},y})),prior);return {mean:+r.mean.toFixed(4),sd:+r.sd.toFixed(4)};};
const lcAb={leetcode:fitLeetCode([])};
console.log(JSON.stringify({
 lc_cold:lc({}),lc_easy_heavy:lc({1:[10,10],2:[1,4]}),lc_violate:lc({1:[1,4],2:[4,4]}),lc_hard_violate:lc({2:[0,3],3:[3,3]}),
 cf_cold:ab([]),cf_seq:ab([['2026-01-01T00:00:00Z',1200,1],['2026-01-08T00:00:00Z',1400,0],['2026-01-08T00:00:01Z',1400,0]]),
 cf_repeat10:ab(Array.from({length:10},(_,i)=>[`2026-01-01T00:00:${String(i).padStart(2,'0')}Z`,800,1])),
 cf_pred:predict({platform:'codeforces',difficulty_value:1200,difficulty_kind:'cf_rating'},{codeforces:{mean:1000,sd:350,status:'x'}}),
 atc_pred:predict({platform:'atcoder',difficulty_value:-1400,difficulty_kind:'atc_irt',atc_discrimination:0.004479398673070138},{atcoder:{mean:0,sd:400,status:'x'}}),
 atc_internal:[atcoderInternalRating(1200,10),atcoderInternalRating(300,3),atcoderInternalRating(1200,1)],
 lc_pred_cold:[1,2,3].map(l=>predict({platform:'leetcode',difficulty_value:l,difficulty_kind:'lc_level'},lcAb)),
}));
