/** Read-only workspace projections. Plans, review queues and attempts retain separate evidence roles. */
import {activeAttempts,completion,pendingPlans,localDate,shiftDate} from './workspace-data.mjs';
export function reviewQueue(journal,today=localDate(new Date())) {
  const rows=[...(journal?.reviews?.priority??[]),...(journal?.reviews?.normal??[])];
  return [...new Map(rows.filter(r=>r.problem_key&&r.due_date&&r.due_date<=today).map(r=>[r.problem_key,{...r,id:'queue:'+r.problem_key,date:r.due_date,layer:'plan',kind:'review',policy_due:true,progress:'pending',platform:r.platform??r.problem_key.split(':')[0],title:r.title??r.problem_key,priority:r.due_date<today?'overdue':'review'}])).values()];
}
export function dashboardModel(events,journal,today=localDate(new Date())) {
  const attempts=activeAttempts(events),todayAttempts=attempts.filter(e=>e.date===today),due=reviewQueue(journal,today);
  const pending=pendingPlans(events.filter(e=>e.date===today)).map(e=>({...e,priority:e.carried_from?'overdue':e.kind==='review'?'review':'practice'}));
  const rank={overdue:0,review:1,practice:2},unique=new Map();
  for(const item of [...due,...pending].sort((a,b)=>rank[a.priority]-rank[b.priority]))if(!unique.has(item.problem_key))unique.set(item.problem_key,item);
  const plan=[...unique.values()];
  const counts={solved:new Set(todayAttempts.filter(completion).map(e=>e.problem_key)).size,attempts:todayAttempts.length,overdue:plan.filter(e=>e.priority==='overdue').length,reviews:plan.filter(e=>e.kind==='review').length};
  const trend=Array.from({length:14},(_,i)=>{const date=shiftDate(today,i-13),rows=attempts.filter(e=>e.date===date);return {date,rows,attempted:rows.length,solved:rows.filter(completion).length};});
  const upcoming=events.filter(e=>e.layer==='contest'&&Date.parse(e.start_at)>=Date.now()).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at))[0]??null;
  return {today,counts,plan,recent:[...attempts].sort((a,b)=>String(b.occurred_at??b.date).localeCompare(String(a.occurred_at??a.date))).slice(0,6),trend,upcoming};
}
export function contestPhase(contest,now=new Date()) {
  const start=Date.parse(contest.start_at),clock=new Date(now).getTime();
  if(!Number.isFinite(start))return 'unknown';
  if(start>clock)return 'upcoming';
  const duration=Number(contest.duration_minutes);
  if(contest.duration_minutes==null||!Number.isFinite(duration))return 'unknown';
  return start+duration*60000>clock?'ongoing':'past';
}
export function filterContestPhase(events,{platform='',phase='upcoming',now=new Date()}={}) {
  return events.filter(e=>e.layer==='contest'&&(!platform||e.platform===platform)&&(phase==='all'||contestPhase(e,now)===phase))
    .sort((a,b)=>(phase==='past'?-1:1)*(Date.parse(a.start_at)-Date.parse(b.start_at))||a.id.localeCompare(b.id));
}
export function calendarMarks(events) {
  const attempts=activeAttempts(events);
  const groups=[['solved','해결',attempts.filter(completion)],['attempted','시도',attempts.filter(e=>!completion(e))],['planned','예정',pendingPlans(events).filter(e=>!e.policy_due)],['review','복습 기한',events.filter(e=>e.policy_due)],['mock','모의',events.filter(e=>e.layer==='mock')],['contest','대회',events.filter(e=>e.layer==='contest')]].filter(([, ,rows])=>rows.length);
  return {groups,visible:groups.slice(0,3),total:events.length,activityCount:attempts.length};
}
