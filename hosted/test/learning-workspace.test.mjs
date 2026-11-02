import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardModel,reviewQueue,contestPhase,filterContestPhase,calendarMarks} from '../public/learning-data.mjs';
const today='2026-10-29';
const actual=(id,key,outcome='independent')=>({id,problem_key:key,outcome,date:today,occurred_at:today+'T00:00:00Z',layer:'actual'});
test('dashboard counts actual attempts, deduplicates solved problems and prioritizes overdue work without inventing activity',()=>{
 const events=[actual('a','leetcode:a'),actual('a2','leetcode:a'),{...actual('old','leetcode:old'),'status':'superseded'},{id:'plan',date:today,layer:'plan',problem_key:'leetcode:next',progress:'pending',carried_from:'2026-10-28'},{id:'new',date:today,layer:'plan',problem_key:'leetcode:new',progress:'pending'}];
 const journal={reviews:{priority:[{problem_key:'leetcode:next',due_date:'2026-10-28'}],normal:[{problem_key:'leetcode:review',due_date:today},{problem_key:'leetcode:future',due_date:'2026-10-30'}]}};
 const model=dashboardModel(events,journal,today);
 assert.deepEqual(model.counts,{solved:1,attempts:2,overdue:1,reviews:2});
 assert.equal(model.plan.length,3);assert.equal(model.plan[0].problem_key,'leetcode:next');assert.equal(model.plan.some(r=>r.problem_key==='leetcode:future'),false);
 assert.equal(model.recent.length,2);assert.equal(model.trend.length,14);assert.equal(model.trend.at(-1).attempted,2);assert.equal(model.trend[0].attempted,0);
 assert.equal(events.length,5,'the projection does not modify recorded source events');
});
test('review queue labels policy deadlines separately from scheduled user plans',()=>{
 const rows=reviewQueue({reviews:{priority:[{problem_key:'atcoder:fixture',due_date:'2026-10-28'}],normal:[{problem_key:'atcoder:fixture',due_date:'2026-10-28'},{problem_key:'leetcode:future',due_date:'2026-11-01'}]}},today);
 assert.equal(rows.length,1);assert.equal(rows[0].policy_due,true);assert.equal(rows[0].date,'2026-10-28');assert.equal(rows[0].platform,'atcoder');assert.equal(rows[0].priority,'overdue');
});
test('contest phases are explicit and unknown duration is never called ongoing or past',()=>{
 const now=new Date(today+'T12:00:00Z'),base={layer:'contest',platform:'atcoder'};
 const events=[{...base,id:'future',start_at:today+'T13:00:00Z',duration_minutes:120},{...base,id:'ongoing',start_at:today+'T11:00:00Z',duration_minutes:120},{...base,id:'past',start_at:today+'T08:00:00Z',duration_minutes:120},{...base,id:'unknown',start_at:today+'T08:00:00Z',duration_minutes:null}];
 assert.deepEqual(events.map(e=>contestPhase(e,now)),['upcoming','ongoing','past','unknown']);
 for(const phase of ['upcoming','ongoing','past'])assert.equal(filterContestPhase(events,{phase,now}).length,1);
 assert.equal(filterContestPhase(events,{phase:'all',now}).length,4);assert.equal(filterContestPhase(events,{phase:'all',platform:'leetcode',now}).length,0);
});
test('calendar remains bounded at three category marks while retaining ten-plus attempt records',()=>{
 const attempts=Array.from({length:12},(_,i)=>actual('a'+i,'leetcode:'+i,i<8?'independent':i===8?null:'failed'));
 const events=[...attempts,{id:'plan',date:today,layer:'plan',problem_key:'leetcode:next',progress:'pending'},{id:'mock',date:today,layer:'mock'}];
 const marks=calendarMarks(events);assert.equal(marks.visible.length,3);assert.equal(marks.groups.length,4);assert.equal(marks.total,14);assert.equal(marks.activityCount,12);assert.equal(marks.groups[0][2].length,8);assert.equal(marks.groups[1][2].length,4);assert.equal(events.length,14);
});
