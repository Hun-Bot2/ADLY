/** Presentation aggregates from recorded evidence. No estimates or durable state. */
import {activeAttempts,completion,localDate,shiftDate} from './workspace-data.mjs';

export function recordedSeconds(row) {
  if (Number.isFinite(row.self_seconds) && row.self_seconds >= 0) return row.self_seconds;
  if (Number.isFinite(row.self_minutes) && row.self_minutes >= 0) return row.self_minutes * 60;
  return null;
}
export function topicIds(row) {
  return [...new Set(String(row.pattern ?? '').split(',').map(value=>value.trim()).filter(Boolean))];
}
export function difficultyLabel(row) {
  const value=row.difficulty ?? row.difficulty_value;
  const label=row.platform==='leetcode' ? ({1:'Easy',2:'Medium',3:'Hard'}[value] ?? value) : value;
  return `${({leetcode:'LeetCode',codeforces:'Codeforces',atcoder:'AtCoder'})[row.platform] ?? row.platform ?? '플랫폼 미기록'} · ${label ?? '난이도 미기록'}`;
}
function groups(rows,key) {
  const map=new Map();
  for(const row of rows){const value=key(row);if(!map.has(value))map.set(value,[]);map.get(value).push(row);}
  return [...map].map(([key,rows])=>({key,rows,count:rows.length,solved:rows.filter(completion).length}));
}
export function aggregateAnalytics(events,{period='',platform='',grain='day'}={}) {
  const rows=activeAttempts(events).filter(row=>localDate(row.date)&&(!period||row.date.startsWith(period))&&(!platform||row.platform===platform));
  const solved=rows.filter(completion),failed=rows.filter(row=>row.outcome==='failed');
  const known=solved.length+failed.length,durations=rows.map(recordedSeconds).filter(value=>value!==null);
  const topics=new Map();
  for(const row of rows)for(const topic of topicIds(row)){if(!topics.has(topic))topics.set(topic,[]);topics.get(topic).push(row);}
  const byProblem=groups(rows,row=>row.problem_key??row.id);
  return {
    rows,solved,failed,unknown:rows.length-known,
    solvedProblems:new Set(solved.map(row=>row.problem_key).filter(Boolean)).size,
    attemptedProblems:new Set(rows.map(row=>row.problem_key).filter(Boolean)).size,
    activeDays:new Set(rows.map(row=>row.date)).size,
    successRate:known?solved.length/known:null,
    successDenominator:known,
    recordedSeconds:durations.length?durations.reduce((sum,value)=>sum+value,0):null,
    durationRecorded:durations.length,durationMissing:rows.length-durations.length,
    days:groups(rows,row=>row.date).sort((a,b)=>a.key.localeCompare(b.key)),
    trend:groups(rows,row=>grain==='week'?shiftDate(row.date,-((new Date(`${row.date}T12:00:00Z`).getUTCDay()+6)%7)):row.date).sort((a,b)=>a.key.localeCompare(b.key)),
    difficulties:groups(rows,difficultyLabel).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key)),
    topics:[...topics].map(([key,rows])=>({key,rows,count:rows.length,solved:rows.filter(completion).length})).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key)),
    missingTopics:rows.filter(row=>!topicIds(row).length).length,
    repeated:byProblem.filter(group=>group.count>1).sort((a,b)=>b.count-a.count||String(a.key).localeCompare(String(b.key))),
  };
}
/** Union confirmed spans only. Never sum timers into self-reported durations. */
export function confirmedTimerSummary(intervals=[],{period='',platform=''}={}) {
  const [year,month]=period.split('-').map(Number);
  const start=period?Date.UTC(year,(month||1)-1,1)-9*3600_000:-Infinity;
  const end=!period?Infinity:period.length===4?Date.UTC(year+1,0,1)-9*3600_000:Date.UTC(year,month,1)-9*3600_000;
  const spans=[];let unavailable=0;
  for(const interval of intervals){
    if(platform&&!String(interval.problem_key??'').startsWith(platform+':'))continue;
    if(interval.status!=='confirmed'){unavailable++;continue;}
    const rawFrom=Date.parse(interval.confirmed_start),rawTo=Date.parse(interval.confirmed_end);
    if(rawFrom>=end||rawTo<start)continue;
    const from=Math.max(start,rawFrom),to=Math.min(end,rawTo);
    if(!Number.isFinite(from)||!Number.isFinite(to)){unavailable++;continue;}
    if(to>=from)spans.push([from,to]);
  }
  spans.sort((a,b)=>a[0]-b[0]);let total=0,current=null;
  for(const span of spans){if(current&&span[0]<=current[1])current[1]=Math.max(current[1],span[1]);else{if(current)total+=current[1]-current[0];current=[...span];}}
  if(current)total+=current[1]-current[0];
  return {seconds:spans.length?total/1000:null,intervals:spans.length,unavailable};
}
export const TOPIC_LABELS={
 'greedy':'그리디','sorting':'정렬','math-geometry':'수학 · 기하','arrays-hashing':'배열 · 해시','arrays':'배열','array':'배열','hash-table':'해시 테이블','two-pointers':'투 포인터','sliding-window':'슬라이딩 윈도','stack':'스택','stacks-queues':'스택 · 큐','binary-search':'이진 탐색','linked-list':'연결 리스트','trees':'트리','tree':'트리','tries':'트라이','heap-priority-queue':'힙 · 우선순위 큐','backtracking':'백트래킹','graphs':'그래프','graph-traversal':'그래프 탐색','advanced-graphs':'고급 그래프','dynamic-programming':'동적 계획법','1d-dynamic-programming':'1차원 DP','2d-dynamic-programming':'2차원 DP','greedy':'그리디','intervals':'구간','math-geometry':'수학 · 기하','bit-manipulation':'비트 연산','sorting':'정렬','string-processing':'문자열','strings':'문자열','string':'문자열','breadth-first-search':'너비 우선 탐색','depth-first-search':'깊이 우선 탐색'};
export const topicLabel=id=>TOPIC_LABELS[id]??String(id).replaceAll('-',' ').replaceAll('_',' ');
export function durationLabel(seconds) {
  if(seconds===null||!Number.isFinite(seconds))return '미기록';
  if(seconds<60)return `${Math.round(seconds)}초`;
  const minutes=Math.floor(seconds/60);return minutes>=60?`${Math.floor(minutes/60)}시간 ${minutes%60}분`:`${minutes}분`;
}
