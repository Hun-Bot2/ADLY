import {topicLabel} from './analytics-data.mjs';
import {COMPANY_WINDOW_LABELS} from './company.mjs';
import {renderResearchComparison} from './research-view.mjs';
import {pageHeader,compactMetric,emptyState,icon} from './ui.mjs';
import {dashboardModel,reviewQueue,contestPhase,filterContestPhase,calendarMarks} from './learning-data.mjs';
import {renderAnalytics} from './analytics.mjs';
import {TIME_ZONE,localDate,shiftDate,calendarDates,navigateDate,workspaceEvents,activeAttempts,filterAttempts,completion,outcomeText,outcomeSymbol,groupCounts,conversion,eventCategory,filterCalendarEvents,daySummary,contestList,recommendationBasis,pendingPlans,CARRY_DAYS,editorProblem} from './workspace-data.mjs';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined&&text!==null)n.textContent=String(text);return n;};
const btn=(text,action,cls='button secondary')=>{const n=el('button',cls,text);n.type='button';if(text)n.dataset.focus=text;n.addEventListener('click',event=>{n.focus({preventScroll:true});action(event);});return n;};
const fmt=(v,options={dateStyle:'medium',timeStyle:'short'})=>Number.isFinite(new Date(v).getTime())?new Intl.DateTimeFormat('ko-KR',{timeZone:TIME_ZONE,hourCycle:'h23',...options}).format(new Date(v)):'시각 미기록';
const labelDate=d=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'full',timeZone:'UTC'}).format(new Date(`${d}T12:00:00Z`));
const link=(title,url)=>{try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return null;const a=el('a','external-link',title+' ↗');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a;}catch{return null;}};
const recordedDuration=e=>e.self_seconds!=null?`${e.self_seconds}s`:e.self_minutes!=null?`${e.self_minutes}m`:'미기록';
import {openDialog,openInspector,closeInspector,requestDialogClose} from './overlays.mjs';
export {openDialog} from './overlays.mjs';
export function createWorkspace({root,getState,getJournal,adapters}) {
  let selected=localDate(new Date()),cursor=selected,mode='month',view='dashboard';
  let calendarPlatform='',showQueue=true,explorerTab='catalog',explorerOffset=0,researchTab='similarity',explorerRequest=0;
  let layers={solved:true,attempted:true,planned:true,mock:true,contest:true},filters={query:'',platform:'',outcome:'',difficulty:'',from:'',to:''};
  let contestPlatform='',contestScope='upcoming';
  const data=()=>workspaceEvents(getJournal(),getState());
  const title=e=>e.title || adapters.problemTitle(e.problem_key) || e.problem_key || '학습 활동';
  const heading=(name,subtitle)=>pageHeader(name,subtitle);
  const empty=text=>{const state=emptyState(text);state.classList.add('empty');return state;};
  const card=(name,description)=>{const c=el('section','card analytics-card');c.append(el('h2','',name));if(description)c.append(el('p','meta',description));return c;};
  function status(e){return e.layer==='actual'?outcomeText(e):e.layer==='contest'?'대회':e.layer==='mock'?'모의 대회':e.kind==='review'?'복습 예정':'학습 예정';}
  const symbol=e=>e.layer==='actual'?outcomeSymbol(e):e.layer==='contest'?'⚑':e.layer==='mock'?'◆':'◇';
  const LEVELS=['','Easy','Medium','Hard'];
  const solvingTime=m=>m%60?(m>=60?`${Math.floor(m/60)}시간 ${m%60}분`:`${m}분`):`${m/60}시간`;
  const mockMeta=e=>[`풀이 시간 ${solvingTime(e.duration_minutes)}`,`E${e.composition?.easy ?? 0} M${e.composition?.medium ?? 0} H${e.composition?.hard ?? 0}`,`기록 ${e.attempted}/${e.problems.length}`].join(' · ');
  const recommendationBadge=e=>{
    if(!e.recommended)return null;
    const icon=el('span','recommendation-badge');icon.setAttribute('role','img');icon.setAttribute('aria-label','시스템 추천 문제');icon.title='시스템 추천 문제';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M10 2l2.2 5.8L18 10l-5.8 2.2L10 18l-2.2-5.8L2 10l5.8-2.2Z');svg.append(path);icon.append(svg);return icon;
  };
  const companyBadge=e=>el('span','company-badge',`${e.scope.company_name??e.scope.company_id} · ${COMPANY_WINDOW_LABELS[e.scope.window]??e.scope.window}${e.scope_match===false?' · 일반 보충':''}`);
  function row(e,action=()=>details(e)) {
    const b=btn('',action,`workspace-row ${e.layer}${e.layer==='actual'?' '+eventCategory(e):''}${e.status==='superseded'?' superseded':''}`);
    const kind=e.layer==='actual'?eventCategory(e):e.layer==='plan'?(e.priority==='overdue'?'overdue':e.kind==='review'?'review':'planned'):e.layer==='mock'?'mock':'contest';const mark=el('span','event-symbol '+kind);mark.append(icon(kind));
    const text=el('span','row-text');text.append(el('strong','',title(e)),el('span','meta',e.layer==='mock'?mockMeta(e):[e.platform,e.difficulty,e.pattern?.split(',').map(value=>topicLabel(value.trim())).join(' · ')].filter(Boolean).join(' · ')||'추가 정보 미기록'));
    if(e.recommended)text.append(recommendationBadge(e));if(e.scope)text.append(companyBadge(e));
    b.append(mark,text,el('span','row-status',status(e)));return b;
  }
  function summaryStats(items) {
    const summary=daySummary(items),stats=el('div','day-stats');
    for(const [key,name,rows] of [['solved','해결',activeAttempts(items).filter(completion)],['attempted','시도',activeAttempts(items)],['unsolved','미해결',activeAttempts(items).filter(e=>e.outcome==='failed')]]) {
      const b=btn('',()=>drill(`${labelDate(selected)} · ${name}`,rows),'day-stat');b.dataset.stat=key;
      b.append(el('strong','',summary[key]),el('span','',name));stats.append(b);
    }
    if(summary.unknown)stats.append(el('p','meta day-unknown',`결과 미상 ${summary.unknown}회 · 시도 횟수 기준`));
    return stats;
  }
  const shortDate=d=>`${Number(d.slice(5,7))}/${Number(d.slice(8))}`;
  function planStatus(e){return e.carried_from?`${shortDate(e.carried_from)}부터 이월`:status(e);}
  function dayContent(date,items){
    const c=el('div','day-content'),today=localDate(new Date());
    const todo=pendingPlans(items).sort((a,b)=>Number(Boolean(a.carried_from))-Number(Boolean(b.carried_from))||String(a.carried_from||'').localeCompare(String(b.carried_from||'')));
    const schedule=items.filter(e=>['mock','contest'].includes(e.layer)),done=activeAttempts(items),moved=items.filter(e=>e.layer==='plan'&&e.carried_to);
    if(!items.length){c.append(el('p','agenda-empty','표시할 활동이 없어요. 다른 날짜를 선택하거나 풀이 저장소를 동기화해 보세요.'));return c;}
    if(todo.length||date>=today){
      const s=el('section','day-section plan'),h=el('div','day-section-head');
      h.append(el('h3','group-title',`${date<today?'남은 계획':'풀어야 할 문제'} · ${todo.length}`));
      if(todo.some(e=>e.carried_from)){const note=el('span','meta','이월 포함');note.title=`최근 ${CARRY_DAYS}일의 미시도 계획 · 원본 추천은 보존됩니다`;h.append(note);}
      s.append(h);
      const fresh=todo.filter(e=>!e.carried_from),carried=todo.filter(e=>e.carried_from);
      if(fresh.length){const grid=el('div','day-blocks');fresh.forEach(e=>grid.append(row(e)));s.append(grid);}
      else if(!carried.length)s.append(el('p','agenda-empty','남은 계획이 없어요.'));
      if(carried.length){const grid=el('div','day-blocks carried');grid.setAttribute('aria-label',`이월된 문제 ${carried.length}개`);s.append(el('h4','day-subtitle',`이월된 문제 · ${carried.length}`));carried.forEach(e=>grid.append(row(e)));s.append(grid);}
      c.append(s);
    }
    if(moved.length){const s=el('p','day-moved');s.append(el('span','',`오늘로 이월 · ${moved.length}`),document.createTextNode(' '+moved.map(title).join(', ')));c.append(s);}
    if(schedule.length){const s=el('section','day-section schedule'),grid=el('div','day-blocks');s.append(el('h3','group-title',`일정 · ${schedule.length}`));schedule.forEach(e=>grid.append(row(e)));s.append(grid);c.append(s);}
    if(done.length){const s=el('section','day-section actual'),list=el('div','done-chips');s.append(el('h3','group-title',`풀이 기록 · ${done.length}`));done.forEach(e=>list.append(row(e)));s.append(list);c.append(s);}
    return c;
  }
  function daily(date){
    selected=date;const content=el('div','daily-content');
    const items=calendarEvents().filter(e=>e.date===date);
    content.append(summaryStats(items),dayContent(date,items),el('p','meta',`${TIME_ZONE} · 현재 캘린더 필터 기준 · 실제 풀이 시각과 계획 날짜를 구분해요.`));
    openInspector(labelDate(date),content);
  }
  const section=(name,...children)=>{const n=el('section','inspector-section');n.append(el('h3','',name),...children);return n;};
  const facts=entries=>{const dl=el('dl','inspector-facts');for(const [k,v]of entries)if(v!=null&&v!==''){dl.append(el('dt','',k),el('dd','',v));}return dl;};
  const disclosure=(name,...children)=>{const d=el('details','inspector-disclosure');d.append(el('summary','',name),...children);return d;};
  function problemActions(e){const actions=el('div','inspector-actions'),editor=editorProblem(e);if(editor&&adapters.canOpenEditor?.())actions.append(btn('편집기에서 열기',()=>{closeInspector({returnFocus:false});adapters.openEditor(editor);},'button primary'));return actions;}
  function details(e){
    if(e.layer==='contest')return contestDetails(e);
    if(e.layer==='plan')return recommendation(e);
    if(e.layer==='mock')return mockDetails(e);
    const c=el('div','problem-details'),actions=problemActions(e);
    c.append(section('학습',facts([['결과',outcomeText(e)],['풀이 시각',fmt(e.occurred_at)],['직접 기록 시간',recordedDuration(e)],['주제',e.pattern?.split(',').map(x=>topicLabel(x.trim())).join(' · ')||'미기록']])));
    if(e.reason)c.append(section('복습 · 메모',el('p','inspector-note',e.reason)));
    const editable=(getState()?.events || []).some(x=>x.event_id===e.id&&x.source==='manual')&&e.status!=='superseded';
    const controls=el('div','actions');if(editable)controls.append(btn('기록 수정',()=>edit(e)));else controls.append(el('p','meta',e.status==='superseded'?'수정 전 기록 · 읽기 전용':'기록 수정은 원본 풀이 저장소에서 가능합니다.'));c.append(section('기록 관리',controls));
    const attempts=data().filter(x=>x.layer==='actual'&&x.problem_key===e.problem_key).sort((a,b)=>b.date.localeCompare(a.date)),history=disclosure(`모든 시도 · ${attempts.length}`);for(const x of attempts){const r=el('div','attempt-audit');r.append(el('strong','',`${x.date} · ${outcomeText(x)}${x.status==='superseded'?' · 수정 전':''}`),el('p','meta',`${fmt(x.occurred_at)} · ${recordedDuration(x)} · ${x.id}`));if(x.reason)r.append(el('p','inspector-note',x.reason));history.append(r);}c.append(section('풀이 이력',history));
    c.append(section('기록 근거',disclosure('출처 · 시간 기록 범위',facts([['문제 키',e.problem_key],['저장 시각',e.recorded_at?fmt(e.recorded_at):'미기록'],['활동',e.activity_type||'미기록'],['출처',e.evidence_source||'수동 기록']]),el('p','meta','날짜만 있는 일지는 KST 날짜 경계로 저장됩니다. 확인된 타이머와 직접 입력 시간은 겹칠 수 있어 합산하지 않습니다.'))));
    openInspector(title(e),c,{sourceUrl:e.url||getState()?.curriculum?.problems?.find(p=>p.problem_key===e.problem_key)?.canonical_url,metadata:[e.platform,e.platform==='leetcode'?LEVELS[e.difficulty]||e.difficulty:e.difficulty].filter(Boolean).join(' · '),actions});
  }
  function recommendation(e){
    const c=el('div','recommendation-detail');
    const stages={consolidate:'개념 다지기',transfer:'전이 연습',retain:'유지 복습',retention:'지연 복습',practice:'연습',review:'복습'};
    c.append(section('학습',facts([['상태',status(e)],['선택 날짜',e.date],['복습 기한',e.due_date||e.review_date||null],['학습 단계',stages[e.stage||e.kind]||e.stage||e.kind||'미기록'],['예상 시간',e.estimated_minutes==null?null:`${e.estimated_minutes}분 · 계획 추정`]])));
    const review=section('복습 정보',el('p','inspector-note',e.kind==='review'?'예정된 복습 문제입니다.':'현재 학습 단계에 따른 연습 문제입니다.'),disclosure('복습 이유 · 원문',el('p','inspector-note',e.reason||'근거 미제공')));c.append(review);
    if(e.semantic_only)c.append(el('p','notice','의미 유사 후보 · 알고리즘 동등성 미검증'));
    c.append(explanationContent(e));
    const evidence=disclosure('선정 기준 · 원래 추천 근거 보기',el('p','meta recommendation-basis',recommendationBasis(e)),el('p','inspector-note',e.reason||'근거 미제공'));evidence.classList.add('original-evidence');
    if(e.explanation?.evidence)evidence.append(el('pre','explanation-evidence',JSON.stringify(e.explanation.evidence,null,2)));
    if(e.scope)evidence.append(companyBadge(e),el('p','meta',`목록 #${e.company_rank??'해당 없음'} · ${e.scope.layer_version} · ${e.scope.upstream_commit_date} · 회사 목록은 실제 면접 출제 근거가 아닙니다.`),el('p','meta',`기업 개념 비율 ${e.components?.company_share??'자료 없음'} · 가중치 0.3 (잠정값)`));
    if(e.versions?.length){const versions=disclosure(`이 날짜의 추천 근거 변경 기록 · ${e.versions.length}개`);versions.classList.add('recommendation-versions');for(const version of e.versions){const item=el('section','attempt-audit');item.append(el('strong','',version.current?'현재 추천':version.archived?'보관된 추천':'이전 추천'),el('p','meta',[version.occurred_at?fmt(version.occurred_at):'시각 미기록',version.snapshot_id||version.id].join(' · ')),el('p','inspector-note',version.reason||'근거 미기록'));versions.append(item);}evidence.append(versions);}c.append(section('추천 근거',evidence));
    openInspector(title(e),c,{sourceUrl:e.url,metadata:[e.platform,e.platform==='leetcode'?LEVELS[e.difficulty]||e.difficulty:e.difficulty].filter(Boolean).join(' · '),actions:problemActions(e)});
  }
  function explanationContent(e){
    const c=section('AI 설명');c.classList.add('comparison-content');const results=e.explanation?.results||[],available=results.some(r=>r.status==='success');c.append(el('p','meta',available?'저장된 AI 설명 있음':'저장된 AI 설명 없음'),el('p','meta','AI 설명은 사실성 검증 전입니다.'));
    const labels={success:'저장됨',failed:'생성 실패',not_configured:'설정 필요',not_generated:'미생성',in_progress:'생성 중',unknown:'결과 확인 불가'},columns=el('div','explanation-comparison');
    for(const provider of ['gemini','nvidia']){const r=results.find(x=>x.provider===provider),item=el('details','explanation-provider');item.dataset.provider=provider;const summary=el('summary'),name=el('strong','',provider==='gemini'?'Gemini':'NVIDIA NIM');summary.append(name,el('span','provider-status',r?labels[r.status]||'상태 미상':'기록 없음'));item.append(summary);if(r?.model)item.append(el('p','meta',r.model));if(r?.status==='success')item.append(el('p','inspector-note',r.text),el('p','meta',r.cache_hit?'저장된 결과':'기록된 모델 출력'));if(r?.error)item.append(el('p','notice error',`${r.error.code||'오류'} ${r.error.http_status||''}`),el('p','meta',r.error.hint||'이 공급자의 설명을 사용할 수 없습니다.'));columns.append(item);}c.append(columns);
    if(e.explanation?.fallback)c.append(disclosure('기본 설명',el('p','inspector-note',e.explanation.fallback.text)));
    c.append(disclosure('설명 이용 안내',el('p','meta','화면 조회는 모델을 호출하지 않습니다. 공급자별 생성은 기존 CLI의 explain 명령을 사용합니다. 공급자 상태는 저장 기록이며 현재 서비스 가용성을 확인한 결과가 아닙니다.')));return c;
  }
  function edit(previous,date=localDate(new Date()),key=''){
    if(!previous)return; // New attempts are authored in the VS Code repository.
    const c=el('div','record-editor');c.append(el('p','meta',previous?'수정 내용은 새 기록으로 추가되며 기존 시도는 보존돼요.':'추천 날짜와 별개로 실제 풀이한 날짜·시각을 기록해 주세요.'));
    if(!getJournal()?.available){c.append(empty('카탈로그 일지를 사용할 수 없어요. 학습 도구의 기존 풀이 기록 양식을 이용해 주세요.'),btn('학습 도구',()=>{document.querySelector('.workspace-dialog')?.close();adapters.tools();}));return openDialog('풀이 기록',c);}
    const form=el('form','form-grid');
    const control=(name,label,type,value)=>{const wrap=el('label','field',label),n=el('input');n.name=name;n.id=`record-${name}`;n.type=type;n.value=value??'';wrap.htmlFor=n.id;wrap.append(n);form.append(wrap);return n;};
    const problem=control('problem','문제 키','text',previous?.problem_key||key);problem.required=true;problem.readOnly=!!previous;problem.placeholder='예: leetcode:two-sum';
    const options=el('datalist');options.id='record-problems';
    const choices=new Map();for(const x of [...data(),...(getState()?.curriculum?.problems || [])])if(x.problem_key)choices.set(x.problem_key,title(x));
    for(const [k,v]of choices){const o=el('option','',v);o.value=k;options.append(o);}problem.setAttribute('list',options.id);form.append(options);
    const dateInput=control('date','실제 풀이 날짜','date',previous?.date||date);dateInput.required=true;dateInput.max=localDate(new Date());
    const time=previous?.occurred_at?new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(previous.occurred_at)):'12:00:00';
    const timeInput=control('time',`시각 (${TIME_ZONE})`,'time',time);timeInput.required=true;timeInput.step='0.001';
    const wrap=el('label','field','결과'),outcome=el('select');outcome.id='record-outcome';wrap.htmlFor=outcome.id;
    // Policy v3 (ADR 005): only solved / unsolved; help is not recorded.
    for(const [v,t]of [['independent','해결'],['failed','미해결']]){const o=el('option','',t);o.value=v;outcome.append(o);}outcome.value=previous&&!completion(previous)?'failed':'independent';wrap.append(outcome);form.append(wrap);
    const minutes=control('minutes','직접 사용한 시간 (예: 10m, 40s · 선택)','text',previous&&(previous.self_seconds!=null||previous.self_minutes!=null)?recordedDuration(previous):'');minutes.placeholder='10m 또는 40s';minutes.pattern='[0-9]+[ms]';
    const error=el('p','form-error full');error.setAttribute('role','alert');const submit=el('button','button primary','저장');submit.type='submit';const cancel=btn('취소',()=>requestDialogClose(d),'button secondary');const footer=el('div','dialog-actions full');footer.append(cancel,submit);form.append(error,footer);c.append(form);
    const d=openDialog('풀이 기록 수정',c);
    let submittedPayload=null;
    form.addEventListener('submit',async event=>{event.preventDefault();error.textContent='';
      const unchanged=previous&&dateInput.value===previous.date&&timeInput.value===time;
      const occurred=unchanged?previous.occurred_at:new Date(`${dateInput.value}T${timeInput.value}+09:00`).toISOString();
      if(new Date(occurred)>new Date()){error.textContent='미래 시각에는 풀이 기록을 저장할 수 없어요.';return;}
      const duration=minutes.value.trim();
      if(duration&&!/^\d{1,5}[ms]$/.test(duration)||duration&&parseInt(duration,10)>(duration.endsWith('s')?86400:1440)){error.textContent='시간은 10m 또는 40s처럼 입력해 주세요 (최대 24시간).';return;}
      const payload={event_id:crypto.randomUUID(),problem_key:problem.value.trim(),outcome:outcome.value,hints:outcome.value==='independent'?false:null,self_minutes:duration.endsWith('m')?parseInt(duration,10):null,...(duration.endsWith('s')?{self_seconds:parseInt(duration,10)}:{}),occurred_at:occurred,activity_type:previous?.activity_type||'practice',...(previous?{supersedes:previous.id}:{}),...(previous?.transfer_from?{transfer_from:previous.transfer_from}:{})};
      submittedPayload??=payload;for(const control of form.querySelectorAll('input,select'))control.disabled=true;submit.disabled=true;try{const ok=await adapters.saveAttempt(submittedPayload);if(ok)d.close();else error.textContent='저장하지 못했어요. 화면 상단의 오류와 재시도 기록을 확인해 주세요.';}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}
    });
  }
  function mockDetails(e){
    // Selection record only: problems are solved and judged on LeetCode; results come from recorded attempts.
    const c=el('div','mock-detail');
    c.append(section('구성',facts([['날짜',labelDate(e.date)],['풀이 시간',solvingTime(e.duration_minutes)],['난이도',`Easy ${e.composition?.easy ?? 0} · Medium ${e.composition?.medium ?? 0} · Hard ${e.composition?.hard ?? 0}`],
      ['예상 해결',`${e.expected_solved}문제 (보수적) · 목표 ${e.target_expected}`],['기록된 결과',`${e.attempted} / ${e.problems.length}문제`],['선정 정책',e.policy || '미기록']])));
    const basis=section('선정 근거');
    if(e.archived)basis.append(el('p','notice','백업에서 복원된 보관 기록이에요. 일일 추천에서 문제를 제외하는 데에는 쓰이지 않아요.'));
    if(e.evidence_label)basis.append(el('p','inspector-note','LeetCode 풀이 근거가 부족해 기본 난이도 구성을 사용했어요.'),el('p','meta',e.evidence_label));
    for(const n of e.notes ?? [])basis.append(el('p','meta',n));
    if(basis.childElementCount>1)c.append(basis);
    const list=el('ol','mock-problems');
    for(const p of e.problems){
      const item=el('li',`mock-problem${p.result?' recorded':''}`),head=el('div','mock-problem-head');
      head.append(el('span','tag',LEVELS[p.level] || '레벨 미상'));const a=link(p.title || p.problem_key,p.url);head.append(a || el('strong','',p.title || p.problem_key));
      item.append(head,el('p','meta',[`해결 확률 ${p.p_conservative}–${p.p_mean} (보수적–평균)`,(p.tags || []).join(', ') || '태그 없음'].join(' · ')),el('p','mock-reason',p.reason));
      item.append(el('p',`mock-result${p.result?'':' pending-result'}`,p.result?`${p.result.symbol} ${p.result.text} · ${p.result.date}`:'아직 기록된 시도가 없어요.'));
      list.append(item);
    }
    c.append(section(`문제 · ${e.problems.length}`,list,el('p','meta','LeetCode에서 풀고 채점해 주세요. 결과는 VS Code 풀이 저장소에 작성하고 Git으로 동기화하면 여기에 표시돼요. 이 화면은 시도를 만들지 않고, 결과 연결은 표시용이에요.')));
    openInspector(title(e),c);
  }
  // Contests are events to take part in: show when/how long and how to join; no suitability verdict or cache badge.
  const joined=e=>{const ps=getState()?.participation ?? [],gone=new Set(ps.map(p=>p.supersedes).filter(Boolean));return ps.filter(p=>!gone.has(p.entry_id)&&p.contest_id===(e.contest_id ?? e.id?.replace(/^contest:/,'')));};
  function contestDetails(e){const c=el('div','contest-detail');
    c.append(section('일정',facts([['플랫폼',e.platform||'미확인'],['시작 (KST)',fmt(e.start_at)||'미확인'],['진행 시간',e.duration_minutes==null?'미확인':`${e.duration_minutes}분`],...(e.rated_range?[['Rated 범위',e.rated_range]]:[])]),el('p','inspector-note contest-tip','처음 몇 문제에만 집중해도 충분해요. 끝난 뒤 못 푼 문제를 풀이와 함께 다시 보는 업솔빙으로 이어가 보세요.')));
    const records=joined(e),participation=section('참여');if(records.length)participation.append(el('p','meta',`참여 기록: ${records.map(r=>`${r.mode} · ${r.outcome} · ${fmt(r.occurred_at)}`).join(' / ')}`));
    const actions=el('div','actions contest-actions');const a=link('대회 페이지 열기',e.url);if(a){a.className='button';actions.append(a);}
    actions.append(btn('참여 기록 남기기',()=>{const box=el('div');box.append(adapters.participationCard(),adapters.participationHistory());openDialog('대회 참여 기록',box);}),
      btn('캘린더에서 날짜 보기',()=>{selected=cursor=e.date;document.querySelector('dialog[open]')?.close();if(adapters.navigate)adapters.navigate('calendar');else render('calendar');}));participation.append(actions);c.append(participation);
    const source=el('details','inspector-disclosure contest-source');source.append(el('summary','','일정 출처'));const sourceFacts=el('dl','inspector-facts');
    for(const[k,v]of [['제공처',e.source==='manual'?'직접 입력':e.source_kind==='community_clist_mirror'?'커뮤니티 일정 미러 (CLIST → ContestDeck)':e.source_kind==='official'?'플랫폼 공식 일정':'제공처 정보'],[e.source==='manual'?'저장 시각':'마지막 동기화',e.fetched_at?fmt(e.fetched_at):'미확인'],['원본 갱신 시각',e.source_updated_at?fmt(e.source_updated_at):'제공처 미제공']])sourceFacts.append(el('dt','',k),el('dd','',v));
    source.append(sourceFacts,el('p','meta',e.stale?'최근 동기화에 실패해 이전에 받아 둔 일정이에요. 시작 시각은 대회 페이지에서 한 번 더 확인해 주세요.':'시작 시각과 참가 조건은 대회 페이지에서 확인해 주세요.'));c.append(section('출처',source));
    openInspector(title(e),c);
  }
  const inspectorOpen=()=>Boolean(document.querySelector('.problem-inspector'));
  // Selecting a date shows it in the Inspector; while the Inspector is already open it follows the selection.
  function selectDay(date,{open=false}={}) {
    selected=date;render();
    if(open||inspectorOpen())daily(date);
    root.querySelector(`[data-date="${date}"] .calendar-date`)?.focus({preventScroll:true});
  }
  function dashboard(){
    const events=data(),model=dashboardModel(events,getJournal()),head=heading('대시보드',labelDate(model.today)),actions=el('div','page-actions');
    const attemptedToday=new Set(activeAttempts(events).filter(e=>e.date>=model.today).map(e=>e.problem_key));
    const todayPlan=(getJournal()?.plan?.slots??[]).filter(slot=>slot.problem_key&&!attemptedToday.has(slot.problem_key)).map((slot,index)=>({...slot,id:'today-plan:'+index,layer:'plan',type:'recommendation',date:model.today,recommended:true,snapshot_id:getJournal().plan.snapshot_id,priority:model.plan.find(p=>p.problem_key===slot.problem_key)?.priority??(slot.kind==='review'?'review':'practice')}));
    const next=todayPlan[0]??model.plan[0];actions.append(btn(next?'학습 이어가기':'문제 탐색',()=>{if(next){const editor=editorProblem(next);if(editor&&adapters.canOpenEditor?.())adapters.openEditor(editor);else details(next);}else{if(adapters.navigate)adapters.navigate('explorer');else render('explorer');}},'button primary'));
    head.append(actions);root.append(head);
    const metrics=el('div','dashboard-metrics');for(const [name,value,glyph,note]of [['오늘 해결',model.counts.solved,'solved','오늘 푼 서로 다른 문제 수'],['오늘 시도',model.counts.attempts,'attempted','푼 것과 못 푼 것을 합친 오늘 기록'],['기한 지난 항목',model.counts.overdue,'overdue','복습 기한을 넘겼거나 지난 계획에서 넘어온 문제'],['복습 대상',model.counts.reviews,'review','오늘까지 다시 풀 차례가 된 문제']]){const card=compactMetric(name,value,note),badge=el('span','metric-icon');badge.dataset.tone=glyph;badge.append(icon(glyph));card.prepend(badge);metrics.append(card);}root.append(metrics);
    const layout=el('div','dashboard-layout'),primary=el('div','dashboard-primary'),aside=el('aside','dashboard-secondary');
    function planRows(items){const table=el('div','plan-table');for(const item of items){const b=row(item);b.dataset.priority=item.priority;const priority=el('span','priority-label');priority.append(b.querySelector('.event-symbol'),el('span','',({overdue:'기한 지남',review:'복습',practice:'연습'})[item.priority]??'연습'));b.prepend(priority);if(item.policy_due)b.title='복습 정책이 계산한 기한 · 직접 지정한 일정과 구분됩니다';table.append(b);}return table;}
    const plan=el('section','dashboard-plan'),planHead=el('div','section-heading');planHead.append(el('h2','','오늘의 계획'),el('span','meta',`${todayPlan.length}개 남음`));plan.append(planHead);
    if(!todayPlan.length)plan.append(empty('남은 일일 계획이 없습니다. 아래 복습 대기나 문제 탐색에서 이어갈 수 있습니다.'));
    else{plan.append(planRows(todayPlan.slice(0,4)));if(todayPlan.length>4)plan.append(btn(`오늘 계획 ${todayPlan.length}개 전체`,()=>openInspector('오늘의 계획',planRows(todayPlan)),'text-button'));}
    plan.append(btn('날짜별 기록 보기',()=>{selected=cursor=model.today;adapters.navigate?adapters.navigate('calendar'):render('calendar');},'text-button'));primary.append(plan);
    const waiting=model.plan.filter(item=>!todayPlan.some(p=>p.problem_key===item.problem_key));
    const backlog=el('section','dashboard-backlog'),backlogHead=el('div','section-heading');backlogHead.append(el('h2','','복습 대기'),el('span','meta',`${waiting.length}개 · 기한 지난 항목 포함`));backlog.append(backlogHead);
    if(waiting.length){backlog.append(planRows(waiting.slice(0,3)),btn(`전체 대기 목록 ${waiting.length}개`,()=>openInspector('복습 대기 · 전체 목록',planRows(waiting)),'text-button'));}else backlog.append(empty('추가로 대기 중인 복습이 없습니다.'));primary.append(backlog);
    const recent=el('section','recent-activity');recent.append(el('div','section-heading'));recent.firstChild.append(el('h2','','최근 활동'),btn('전체 기록',()=>{explorerTab='records';adapters.navigate?adapters.navigate('explorer'):render('explorer');},'text-button'));
    if(!model.recent.length)recent.append(empty('아직 기록된 시도가 없습니다.'));for(const event of model.recent.slice(0,4)){const wrap=el('div','recent-row');wrap.append(el('time','meta',event.date),row(event));recent.append(wrap);}
    const trend=el('section','short-trend');trend.append(el('div','section-heading'));trend.firstChild.append(el('h2','','최근 14일'),el('span','meta','시도 / 해결'));const bars=el('div','mini-trend'),max=Math.max(1,...model.trend.map(d=>d.attempted));
    for(const day of model.trend){const b=btn('',()=>{selected=cursor=day.date;adapters.navigate?adapters.navigate('calendar'):render('calendar');},'mini-trend-column');b.title=`${day.date} · 시도 ${day.attempted} / 해결 ${day.solved}`;b.setAttribute('aria-label',b.title);const tracks=el('span','mini-trend-bars');for(const [cls,n]of [['attempted',day.attempted],['completed',day.solved]]){const fill=el('span',cls);fill.style.height=`${n/max*100}%`;tracks.append(fill);}b.append(tracks,el('time','meta',day.date.slice(-2)));bars.append(b);}trend.append(bars,el('p','meta',`최대 ${max===1&&!model.trend.some(d=>d.attempted)?0:max}회 · 빈 날짜는 기록 없음`));aside.append(trend);
    const contest=el('section','next-contest');contest.append(el('div','section-heading'));contest.firstChild.append(el('h2','','다음 대회'));if(model.upcoming){contest.append(el('p','meta',`${model.upcoming.platform} · ${fmt(model.upcoming.start_at)}`),btn(title(model.upcoming),()=>contestDetails(model.upcoming),'contest-compact'));}else contest.append(empty('불러온 예정 대회가 없습니다.'));contest.append(btn('대회 일정',()=>adapters.navigate?adapters.navigate('contests'):render('contests'),'text-button'));aside.append(contest);
    aside.append(recent);
    const focus=getJournal()?.focus;if(focus?.pattern){const panel=el('section','current-focus');panel.append(el('div','section-heading'));panel.firstChild.append(el('h2','','현재 학습 초점'));panel.append(el('strong','topic-label',topicLabel(focus.pattern)),el('p','meta',({step_up:'난이도 확장',step_down:'기초 점검',consolidate:'같은 난이도 연습',transfer:'다른 플랫폼 응용',stretch:'도전 문제'})[focus.stage]??focus.stage??'단계 미기록'));aside.append(panel);}
    layout.append(primary,aside);root.append(layout);
  }
  function calendarEvents(){
    const events=filterCalendarEvents(data(),layers).filter(e=>!calendarPlatform||e.platform===calendarPlatform);
    if(showQueue)for(const item of reviewQueue(getJournal()))if((!calendarPlatform||item.platform===calendarPlatform)&&!events.some(e=>e.problem_key===item.problem_key&&e.date===item.date&&e.kind==='review'))events.push(item);
    return events;
  }
  // Calendar cells show one fixed-size dot per category (icon + color), never a growing text list.
  const DOT_KINDS=[['solved','해결'],['attempted','시도'],['planned','예정'],['review','복습 기한'],['contest','대회']];
  const SCHEDULED=new Set(['planned','review','mock','contest']);
  const LAYER_MENU=[['solved','해결'],['attempted','시도'],['planned','예정'],['review','복습 기한'],['mock','모의 대회'],['contest','대회']];
  function dayDots(list) {
    const by=new Map(calendarMarks(list).groups.map(([k,,rows])=>[k,rows])),dots=[],parts={recorded:[],scheduled:[]};
    for(const [k,name] of DOT_KINDS){
      const rows=k==='contest'?[...(by.get('contest')??[]),...(by.get('mock')??[])]:by.get(k);if(!rows?.length)continue;
      const kind=k==='contest'&&!by.has('contest')?'mock':k,label=kind==='mock'?'모의 대회':name;
      const dot=el('span',`activity-dot calendar-event ${kind} ${SCHEDULED.has(kind)?'scheduled':'recorded'}`);
      dot.title=`${label} ${rows.length} · ${rows.slice(0,4).map(title).join('; ')}${rows.length>4?' 외':''}`;dot.append(icon(kind));dots.push(dot);
      parts[SCHEDULED.has(kind)?'scheduled':'recorded'].push(`${label} ${rows.length}`);
    }
    return {dots,parts};
  }
  let menuOpen=null,inspectorObserver=null;
  function dismissMenu({returnFocus=false}={}) {
    const key=menuOpen;menuOpen=null;root.querySelector('.cal-menu')?.remove();
    for(const b of root.querySelectorAll('[aria-haspopup]'))b.setAttribute('aria-expanded','false');
    if(returnFocus&&key)root.querySelector(`[data-focus="menu:${key}"]`)?.focus({preventScroll:true});
  }
  function openMenu(key) {menuOpen=key;render();queueMicrotask(()=>root.querySelector('.cal-menu [role^=menuitem]:not(:disabled)')?.focus({preventScroll:true}));}
  function menuItem(label,key,{glyph,kind='menuitem',checked=false,onSelect,hint,disabled=false}) {
    const b=el('button','menu-item');b.type='button';b.disabled=disabled;b.setAttribute('role',kind);b.dataset.focus=`mi:${key}`;
    if(kind!=='menuitem'){b.setAttribute('aria-checked',String(checked));const mark=el('span','menu-check');if(checked)mark.append(icon('check'));b.append(mark);}
    if(glyph){const g=el('span',`menu-glyph ${glyph}`);g.append(icon(glyph));b.append(g);}
    b.append(el('span','menu-label',label));if(hint)b.append(el('kbd','menu-hint',hint));
    b.addEventListener('click',()=>onSelect());return b;
  }
  const menuHeading=text=>{const h=el('div','menu-heading',text);h.setAttribute('role','presentation');return h;};
  const menuSeparator=()=>{const s=el('div','menu-separator');s.setAttribute('role','separator');return s;};
  function toolMenu(key,{text='',name,glyph,active=false,content}) {
    const wrap=el('div','cal-menu-wrap'),open=menuOpen===key;
    const trigger=btn(text,()=>{if(menuOpen===key)dismissMenu({returnFocus:true});else openMenu(key);},`tb-button${text?'':' icon'}${active?' active':''}`);
    trigger.dataset.focus=`menu:${key}`;trigger.prepend(icon(glyph));trigger.setAttribute('aria-label',active?`${name} (적용 중)`:name);trigger.title=name;
    trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded',String(open));
    if(active){const dot=el('i','filter-dot');dot.setAttribute('aria-hidden','true');trigger.append(dot);}
    wrap.append(trigger);
    if(open){
      const menu=el('div','cal-menu');menu.setAttribute('role','menu');menu.setAttribute('aria-label',name);content(menu);
      menu.addEventListener('keydown',event=>{
        const items=[...menu.querySelectorAll('[role^=menuitem]:not(:disabled)')],at=items.indexOf(document.activeElement);
        const next={ArrowDown:(at+1)%items.length,ArrowUp:(at-1+items.length)%items.length,Home:0,End:items.length-1}[event.key];
        if(next!==undefined){event.preventDefault();items[next]?.focus();}
      });
      wrap.append(menu);
    }
    return wrap;
  }
  function renderCalendar(){
    const events=calendarEvents(),today=localDate(new Date()),dates=calendarDates(cursor,mode),focusDate=dates.includes(selected)?selected:dates[0];
    root.append(heading('학습 캘린더'));
    const filtersActive=!showQueue||Object.values(layers).some(v=>!v)||Boolean(calendarPlatform);
    const tools=el('div','calendar-toolbar'),left=el('div','calendar-navigation');tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','캘린더 도구 모음');
    const iconButton=(glyph,name,action)=>{const b=btn('',action,'tb-button icon');b.append(icon(glyph));b.setAttribute('aria-label',name);b.title=name;b.dataset.focus=`tb:${glyph}`;return b;};
    const prev=iconButton('chevronLeft',mode==='week'?'이전 주':'이전 달',()=>{cursor=navigateDate(cursor,-1,mode);render();}),next=iconButton('chevron',mode==='week'?'다음 주':'다음 달',()=>{cursor=navigateDate(cursor,1,mode);render();});
    const pair=el('div','tb-group');pair.append(prev,next);
    left.append(el('h2','month-title',`${cursor.slice(0,4)}년 ${Number(cursor.slice(5,7))}월`),pair,btn('오늘',()=>{cursor=today;selectDay(today);},'tb-button'));
    const right=el('div','calendar-tools');
    const switcher=el('div','segmented');switcher.setAttribute('role','group');switcher.setAttribute('aria-label','보기 방식');for(const[v,t]of [['month','월'],['week','주']]){const b=btn(t,()=>{mode=v;cursor=selected;render();},'segment');b.setAttribute('aria-pressed',String(mode===v));switcher.append(b);}
    const filter=toolMenu('filter',{text:'필터',name:'캘린더 필터',glyph:'funnel',active:filtersActive,content:menu=>{
      menu.append(menuHeading('기록'));
      for(const [k,name] of LAYER_MENU){
        if(k==='planned')menu.append(menuSeparator(),menuHeading('일정'));
        const checked=k==='review'?showQueue:layers[k];
        menu.append(menuItem(name,`layer:${k}`,{glyph:k,kind:'menuitemcheckbox',checked,onSelect:()=>{if(k==='review')showQueue=!showQueue;else layers[k]=!layers[k];render();}}));
      }
      menu.append(menuSeparator(),menuHeading('플랫폼'));
      for(const[v,t]of [['','모든 플랫폼'],['leetcode','LeetCode'],['codeforces','Codeforces'],['atcoder','AtCoder']])menu.append(menuItem(t,`platform:${v||'all'}`,{kind:'menuitemradio',checked:calendarPlatform===v,onSelect:()=>{calendarPlatform=v;render();}}));
      menu.append(menuSeparator(),menuItem('필터 초기화','reset',{disabled:!filtersActive,onSelect:()=>{layers={solved:true,attempted:true,planned:true,mock:true,contest:true};showQueue=true;calendarPlatform='';render();}}));
    }});
    const inspectorToggle=iconButton('panel','상세 패널',()=>{if(inspectorOpen())closeInspector();else daily(selected);});
    inspectorToggle.setAttribute('aria-pressed',String(inspectorOpen()));
    inspectorObserver?.disconnect();inspectorObserver=new MutationObserver(()=>inspectorToggle.setAttribute('aria-pressed',String(inspectorOpen())));inspectorObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    const more=toolMenu('more',{name:'더 보기',glyph:'ellipsis',content:menu=>{
      menu.append(menuItem('오늘로 이동','today',{hint:'T',onSelect:()=>{dismissMenu();cursor=today;selectDay(today);}}),
        menuItem('풀이 기록 목록','records',{onSelect:()=>{explorerTab='records';dismissMenu();adapters.navigate?adapters.navigate('explorer'):render('explorer');}}),
        menuItem('대회 일정','contests',{onSelect:()=>{dismissMenu();adapters.navigate?adapters.navigate('contests'):render('contests');}}));
    }});

    right.append(switcher,filter,inspectorToggle,more);tools.append(left,right);root.append(tools);
    const layout=el('div','calendar-workspace'),calendar=el('section',`calendar-board ${mode}`);calendar.setAttribute('aria-label',mode==='month'?'월간 학습 캘린더':'주간 학습 캘린더');
    const headers=el('div','calendar-weekdays');for(const day of ['월','화','수','목','금','토','일'])headers.append(el('span','',day));calendar.append(headers);
    const grid=el('div','calendar-grid');grid.setAttribute('role','grid');
    for(const date of dates){
      const list=events.filter(e=>e.date===date),stats=daySummary(list),total=list.length,{dots,parts}=dayDots(list);
      const cell=el('div',`calendar-cell${[0,6].includes(new Date(date+'T12:00:00Z').getUTCDay())?' weekend':''}${date.slice(0,7)!==cursor.slice(0,7)?' outside':''}${date===selected?' selected':''}${date===today?' is-today':''}${date>today?' future':''}`);
      cell.dataset.date=date;cell.dataset.intensity=String(total?Math.min(4,Math.ceil(total/2)):0);cell.setAttribute('role','gridcell');
      const dateButton=btn(String(Number(date.slice(-2))),()=>{},'calendar-date');dateButton.dataset.focus=`date:${date}`;dateButton.tabIndex=date===focusDate?0:-1;
      dateButton.setAttribute('aria-label',[labelDate(date),parts.recorded.length?`기록 ${parts.recorded.join(', ')}`:null,parts.scheduled.length?`일정 ${parts.scheduled.join(', ')}`:null,parts.recorded.length||parts.scheduled.length?null:'활동 없음'].filter(Boolean).join(' · '));
      dateButton.setAttribute('aria-pressed',String(date===selected));if(date===today)dateButton.setAttribute('aria-current','date');
      dateButton.addEventListener('keydown',event=>{const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(delta){event.preventDefault();const target=shiftDate(date,delta);if(!calendarDates(cursor,mode).includes(target))cursor=target;selectDay(target);}});
      cell.addEventListener('click',()=>selectDay(date,{open:true}));
      const head=el('div','cell-head');head.append(dateButton);if(total){const count=el('span','day-count',total);count.title=`활동 ${total}개`;count.setAttribute('aria-hidden','true');head.append(count);}
      const strip=el('div','activity-dots');strip.setAttribute('aria-hidden','true');strip.append(...dots);cell.append(head,strip);grid.append(cell);
    }
    calendar.append(grid);layout.append(calendar,calendarSummary(today));root.append(layout);
  }
  // Side summary: recorded attempts only (plans, reviews and contests excluded), independent of calendar filters.
  function calendarSummary(today){
    const attempts=activeAttempts(data()),byDate=new Map();for(const e of attempts){if(!byDate.has(e.date))byDate.set(e.date,[]);byDate.get(e.date).push(e);}
    const aside=el('aside','calendar-summary');aside.setAttribute('aria-label','학습 요약');
    const month=cursor.slice(0,7),monthRows=attempts.filter(e=>e.date.startsWith(month));
    let streak=0;for(let d=byDate.has(today)?today:shiftDate(today,-1);byDate.has(d);d=shiftDate(d,-1))streak++;
    const todayRows=byDate.get(today)??[];
    const stats=(title,note,rows)=>{const box=el('section','summary-block');box.append(el('h3','',title));const list=el('dl','summary-stats');for(const [k,v]of rows){list.append(el('dt','',k),el('dd','',v));}box.append(list);if(note)box.append(el('p','summary-note',note));return box;};
    aside.append(stats('오늘',null,[['해결',new Set(todayRows.filter(completion).map(e=>e.problem_key)).size+'문제'],['시도',todayRows.length+'회'],['연속 기록',streak+'일']]));
    aside.append(stats(`${Number(month.slice(5))}월`,'풀이 기록만 셉니다. 계획·복습·대회는 제외돼요.',[['해결',new Set(monthRows.filter(completion).map(e=>e.problem_key)).size+'문제'],['시도',monthRows.length+'회'],['기록한 날',new Set(monthRows.map(e=>e.date)).size+'일']]));
    const heat=el('section','summary-block'),head=el('div','summary-heading');head.append(el('h3','','최근 8주'),el('span','meta','하루 시도 횟수'));heat.append(head);
    const offset=(new Date(today+'T12:00:00Z').getUTCDay()+6)%7,start=shiftDate(today,-(7*7+offset)),grid=el('div','summary-heatmap');grid.setAttribute('role','group');grid.setAttribute('aria-label','최근 8주 활동');
    for(let d=start;d<=shiftDate(start,55);d=shiftDate(d,1)){const rows=byDate.get(d)??[],count=rows.length,future=d>today;const cell=btn('',()=>{if(future)return;cursor=d;selectDay(d,{open:true});},'summary-cell');cell.dataset.level=String(future?-1:count===0?0:count===1?1:count<=3?2:count<=6?3:4);if(d===today)cell.classList.add('is-today');cell.disabled=future;cell.title=`${d} · 시도 ${count}회 · 해결 ${rows.filter(completion).length}회`;cell.setAttribute('aria-label',cell.title);grid.append(cell);}
    const legend=el('div','summary-legend');legend.append(el('span','','적음'));for(const level of [0,1,2,3,4]){const mark=el('i','summary-cell');mark.dataset.level=String(level);legend.append(mark);}legend.append(el('span','','많음'));
    heat.append(grid,legend);aside.append(heat);return aside;
  }
  function renderContestList() {
    root.append(heading('프로그래밍 대회','일정과 참가 링크를 시간순으로 확인하세요.'));
    const controls=el('div','contest-list-toolbar'),tabs=el('div','segmented contest-tabs');for(const[v,t]of [['upcoming','예정'],['ongoing','진행 중'],['past','종료'],['all','전체']]){const b=btn(t,()=>{contestScope=v;render();},'segment');b.setAttribute('aria-pressed',String(contestScope===v));tabs.append(b);}controls.append(tabs);
    const platform=el('select');platform.setAttribute('aria-label','대회 플랫폼');platform.dataset.focus='contest-platform-filter';for(const[v,t]of [['','모든 플랫폼'],['codeforces','Codeforces'],['atcoder','AtCoder'],['leetcode','LeetCode'],['other','기타']]){const o=el('option','',t);o.value=v;platform.append(o);}platform.value=contestPlatform;platform.addEventListener('change',()=>{contestPlatform=platform.value;render();});controls.append(platform,el('span','meta',TIME_ZONE));
    const sync=btn('일정 동기화',async()=>{sync.disabled=true;await adapters.syncContests?.();sync.disabled=false;},'button');sync.disabled=!getState()?.capabilities?.contest_discovery;controls.append(sync);root.append(controls);
    const all=data(),items=filterContestPhase(all,{platform:contestPlatform,phase:contestScope}),list=el('section','contest-agenda');list.setAttribute('aria-label','조회된 대회 목록');
    if(!items.length)list.append(empty('이 조건에 맞는 대회가 없습니다. 일정을 동기화하거나 직접 추가할 수 있습니다.'));
    for(const e of items){const b=btn('',()=>contestDetails(e),'contest-list-item');b.dataset.contestId=e.contest_id;const time=el('span','contest-time');time.append(el('time','',e.date.slice(5)),el('strong','',fmt(e.start_at,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'})));const name=el('span','contest-list-name');const full=el('strong','',title(e));full.title=title(e);name.append(full,el('span','meta',e.source==='manual'?'직접 추가':'공개 일정'));b.append(time,el('span',`platform-label ${e.platform}`,e.platform),name,el('span','contest-duration',e.duration_minutes==null?'시간 미확인':`${e.duration_minutes}분`),el('span','row-status',joined(e).length?'참여함':({upcoming:'예정',ongoing:'진행 중',past:'종료',unknown:'종료 시각 미상'})[contestPhase(e)]),el('span','list-chevron','›'));list.append(b);}
    root.append(list);const unknown=all.filter(e=>e.layer==='contest'&&contestPhase(e)==='unknown').length;if(unknown&&contestScope!=='all')root.append(el('p','meta',`종료 시각 미상 ${unknown}개는 전체 탭에서 확인할 수 있습니다.`));const sources=el('details','contest-source-settings');sources.append(el('summary','','출처 · 동기화 · 참여 기록'));root.append(sources);contestSources(sources);
  }
  function contestSources(target=root){
    const panel=card('일정 출처와 동기화','실패한 조회는 마지막 성공 캐시를 유지해요. 커뮤니티 일정은 공식 공지에서 확인해 주세요.');
    for(const platform of ['codeforces','atcoder','leetcode']){
      const source=(getState()?.contest_sources || []).filter(s=>String(s.source).includes(platform));
      const row=el('div','source-row');row.append(el('strong','',platform==='leetcode'?'LeetCode':platform==='atcoder'?'AtCoder':'Codeforces'));
      row.append(el('span','meta',source.length?source.map(s=>`${({fresh:'최신 일정',stale:'동기화 필요',unavailable:'일정 확인 불가'})[s.status] || s.status} · ${s.fetched_at?'마지막 성공 '+fmt(s.fetched_at):'성공한 조회 없음'}${s.status!=='fresh'&&s.error&&!['not_synced','stale'].includes(s.error)?' · 오류 기록 있음':''}`).join(' / '):'성공한 동기화 없음 · 공개 일정 동기화로 확인'));
      const a=link('공식 일정',platform==='leetcode'?'https://leetcode.com/contest/':platform==='atcoder'?'https://atcoder.jp/contests/':'https://codeforces.com/contests');if(a)row.append(a);if(source[0]?.source_updated_at)row.append(el('span','meta',`원본 갱신 ${fmt(source[0].source_updated_at)}`));panel.append(row);
    }
    const actions=el('div','actions');actions.append(btn('일정 동기화 / 제출 가져오기',()=>openDialog('대회 데이터 가져오기',adapters.providerSyncCard())),btn('＋ 대회 직접 추가',()=>openDialog('대회 직접 추가',adapters.manualContestForm())),btn('참여 기록',()=>{const c=el('div');c.append(adapters.participationCard(),adapters.participationHistory());openDialog('대회 참여 기록',c);}));panel.append(actions);target.append(panel);
  }
  function filterControl(label,name,choices,rerender){const wrap=el('label','filter-control',label),s=el('select');s.setAttribute('aria-label',label);for(const[v,t]of choices){const o=el('option','',t);o.value=v;s.append(o);}s.value=filters[name]||'';s.addEventListener('change',()=>{filters[name]=s.value;rerender();});wrap.append(s);return wrap;}
  function history(){
    const controls=el('div','history-filters'),search=el('input');search.type='search';search.placeholder='문제 이름, 키 또는 알고리즘 주제 검색';search.setAttribute('aria-label','풀이 이력 검색');search.value=filters.query;
    const results=el('section','history-results');const update=()=>{results.replaceChildren();const rows=filterAttempts(data(),filters).sort((a,b)=>b.date.localeCompare(a.date));results.append(el('p','meta',`${rows.length}회 시도 · 현재 기록 기준 · 수정 전 기록은 문제 상세에서 확인`));if(!rows.length)results.append(empty('조건에 맞는 풀이 기록이 없어요.'));else{const table=el('div','history-table');const header=el('div','history-table-head');for(const t of ['문제 / 주제','플랫폼 · 난이도','결과','풀이 날짜','시간'])header.append(el('span','',t));table.append(header);for(const e of rows){const b=btn('',()=>details(e),'history-table-row');const name=el('span','history-problem');name.append(el('strong','',title(e)),el('span','meta',e.pattern||'주제 미기록'));if(e.recommended)name.append(recommendationBadge(e));b.append(name,el('span','',`${e.platform || '미상'} · ${e.difficulty??'미기록'}`),el('span','',outcomeText(e)),el('time','',e.date),el('span','',recordedDuration(e)));table.append(b);}results.append(table);}};
    search.addEventListener('input',()=>{filters.query=search.value;update();});controls.append(search);
    const all=activeAttempts(data()),choices=key=>[...new Set(all.map(e=>e[key]).filter(v=>v!=null).map(String))].sort().map(v=>[v,v]);
    controls.append(filterControl('플랫폼','platform',[['','모든 플랫폼'],...choices('platform')],update),filterControl('결과','outcome',[['','모든 결과'],['independent','해결'],['failed','미해결']],update),filterControl('난이도 (플랫폼별)','difficulty',[['','모든 난이도'],...choices('difficulty')],update));
    for(const[k,t]of [['from','시작일'],['to','종료일']]){const l=el('label','filter-control',t),i=el('input');i.type='date';i.value=filters[k];i.setAttribute('aria-label',t);i.addEventListener('change',()=>{filters[k]=i.value;update();});l.append(i);controls.append(l);}
    controls.append(btn('초기화',()=>{filters={query:'',platform:'',outcome:'',difficulty:'',from:'',to:''};render();}),btn('＋ 기록',()=>edit(),'button'));root.append(controls,results);update();
  }
  function drill(name,rows){const c=el('div','drilldown');c.append(el('p','meta',`${rows.length}개 원본 항목 · 현재 선택 범위`));if(!rows.length)c.append(empty('기록된 항목이 없어요.'));rows.forEach(e=>{const wrap=el('div');wrap.append(el('span','meta',e.date),row(e));c.append(wrap);});openInspector(name,c);}
  function analytics(){renderAnalytics({root,events:data(),state:getState(),journal:getJournal(),onDrill:drill,onSelectDate:date=>{selected=cursor=date;adapters.navigate?adapters.navigate('calendar'):render('calendar');}});const usage=adapters.explanationUsageCard?.();if(usage){usage.open=false;root.append(usage);}}
  let libraryFolder='';
  const fileSize=n=>n==null?'크기 미확인':n>=1048576?`${(n/1048576).toFixed(1)}MB`:`${Math.max(1,Math.round(n/1024))}KB`;
  function library(){

    const shell=el('section','library'),status=el('p','meta','자료 목록을 불러오는 중이에요.');status.setAttribute('role','status');shell.append(status);root.append(shell);
    (adapters.request?adapters.request('/local/library'):fetch('/api/local/library',{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('unavailable');return response.json();})).then(data=>{
      if(!shell.isConnected)return;if(!data.available)throw Error('unavailable');status.remove();drawLibrary(shell,data);
    }).catch(()=>{if(!shell.isConnected)return;status.textContent='지금은 연구 자료를 불러올 수 없어요. 로컬 서버를 다시 시작한 뒤 확인해 주세요.';});
  }
  function drawLibrary(shell,data){
    if(!data.folders.some(f=>f.id===libraryFolder))libraryFolder=data.folders[0]?.id ?? '';
    const tree=el('nav','library-folders'),pane=el('div','library-pane');tree.setAttribute('aria-label','자료 폴더');
    const paint=()=>{
      tree.replaceChildren(el('p','library-tree-title','폴더'));
      for(const f of data.folders){const b=btn('',()=>{libraryFolder=f.id;paint();pane.querySelector('h2')?.focus({preventScroll:true});},'library-folder');b.dataset.focus=`folder:${f.id}`;b.setAttribute('aria-current',String(f.id===libraryFolder));b.append(el('span','library-folder-icon','▤'),el('span','library-folder-name',f.title),el('span','library-count',f.items.length));tree.append(b);}
      const folder=data.folders.find(f=>f.id===libraryFolder);pane.replaceChildren();if(!folder)return pane.append(empty('표시할 자료가 없어요.'));
      const crumb=el('p','library-crumb');crumb.append(el('span','','연구 자료'),el('span','library-crumb-sep','/'),el('strong','',folder.title));
      const title=el('h2','',folder.title);title.tabIndex=-1;pane.append(crumb,title);if(folder.description)pane.append(el('p','meta library-description',folder.description));
      const grid=el('div','library-grid');for(const item of folder.items)grid.append(libraryCard(item));pane.append(grid);
    };
    paint();shell.append(tree,pane);if(data.notice)shell.append(el('p','meta library-notice',data.notice));
  }
  function libraryCard(item){
    const b=btn('',()=>libraryPreview(item),`library-card ${item.kind}`);b.dataset.focus=`file:${item.id}`;
    const thumb=el('span','library-thumb');
    if(!item.available)thumb.append(el('span','library-thumb-label','파일 없음'));
    else if(item.kind==='image'){const img=el('img');img.src=item.url;img.alt='';img.loading='lazy';img.decoding='async';thumb.append(img);}
    else thumb.append(el('span','library-thumb-label',item.format.toUpperCase()),el('span','library-thumb-sub','페이지'));
    const meta=el('span','library-meta');meta.append(el('span','library-format',item.format.toUpperCase()),el('span','',fileSize(item.size)));if(item.private)meta.append(el('span','library-private','private'));
    b.append(thumb,el('strong','library-card-title',item.title));if(item.note)b.append(el('span','library-note',item.note));b.append(meta);
    if(!item.available)b.disabled=true;b.setAttribute('aria-label',`${item.title} · ${item.format.toUpperCase()} · ${fileSize(item.size)}${item.available?'':' · 파일 없음'}`);return b;
  }
  function libraryPreview(item){
    const c=el('div','library-preview');
    if(item.kind==='image'){const img=el('img','library-image');img.src=item.url;img.alt=item.title;c.append(img);}
    else{
      if(item.size>5*1048576)c.append(el('p','notice',`큰 파일(${fileSize(item.size)})이라 여는 데 시간이 걸릴 수 있어요.`));
      const frame=el('iframe','library-frame');frame.title=item.title;frame.src=item.url;frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';c.append(frame);
      c.append(el('p','meta','외부 네트워크 없이 격리된 화면에서 열어요. 노트북의 수식은 표시되지 않을 수 있어요.'));
    }
    if(item.note)c.append(el('p','reason',item.note));
    const info=el('dl','detail-grid');for(const[k,v]of [['파일',item.path],['형식 · 크기',`${item.format.toUpperCase()} · ${fileSize(item.size)}`],['관련 문서',item.source || '미기록'],['공개 범위',item.private?'로컬 전용 (커밋하지 않음)':'저장소에 포함된 자료']])info.append(el('dt','',k),el('dd','',v));
    const open=el('a','button secondary','새 탭에서 열기 ↗');open.href=item.url;open.target='_blank';open.rel='noopener noreferrer';
    c.append(info,open);openInspector(item.title,c);
  }
  let comparisonObserver=null;
  function similarity(){renderResearchComparison({root,openDialog:openInspector,canOpenEditor:()=>adapters.canOpenEditor?.(),onOpenEditor:problem=>adapters.openEditor?.(problem)});}
  function research(){root.append(heading('연구 · 유사도','저장된 자료와 비교 근거를 탐색합니다. 연구 결과는 학습 성과와 구분합니다.'));const tabs=el('div','segmented research-tabs');for(const[value,label]of [['similarity','유사도 비교'],['library','연구 라이브러리']]){const b=btn(label,()=>{researchTab=value;render('research');},'segment');b.setAttribute('aria-pressed',String(researchTab===value));tabs.append(b);}root.append(tabs);if(researchTab==='library')library();else similarity();}
  function explorer(){
    root.append(heading('문제 탐색','카탈로그와 내 풀이 기록을 한곳에서 검색하세요.'));
    const tabs=el('div','segmented explorer-tabs');for(const[value,label]of [['catalog','전체 카탈로그'],['records','내 풀이 기록']]){const b=btn(label,()=>{explorerTab=value;render('explorer');},'segment');b.setAttribute('aria-pressed',String(explorerTab===value));tabs.append(b);}root.append(tabs);
    if(explorerTab==='records'){history();return;}
    const controls=el('form','explorer-toolbar'),query=el('input'),platform=el('select'),difficulty=el('select');query.type='search';query.placeholder='문제 이름 · 식별자 · 태그 검색';query.setAttribute('aria-label','문제 검색');query.value=filters.query;platform.setAttribute('aria-label','문제 플랫폼');difficulty.setAttribute('aria-label','문제 난이도');for(const[value,label]of [['','모든 플랫폼'],['leetcode','LeetCode'],['codeforces','Codeforces'],['atcoder','AtCoder']]){const o=el('option','',label);o.value=value;platform.append(o);}platform.value=filters.platform;
    for(const[value,label]of [['','모든 난이도'],['1','LeetCode Easy'],['2','LeetCode Medium'],['3','LeetCode Hard']]){const o=el('option','',label);o.value=value;difficulty.append(o);}difficulty.value=filters.difficulty;
    const submit=el('button','button','검색');submit.type='submit';controls.append(query,platform,difficulty,submit);const results=el('section','explorer-results');root.append(controls,results);
    async function load(){const serial=++explorerRequest;results.setAttribute('aria-busy','true');results.replaceChildren(el('p','loading','문제를 불러오는 중…'));try{const params=new URLSearchParams({query:query.value,platform:platform.value,difficulty:difficulty.value,offset:String(explorerOffset),limit:'30'});const response=adapters.request?await adapters.request('/problems?'+params):await fetch('/api/problems?'+params).then(r=>{if(!r.ok)throw Error('catalog unavailable');return r.json();});if(serial!==explorerRequest||!results.isConnected)return;results.replaceChildren();if(response.available===false){results.append(empty(response.reason??'이 실행 환경에서는 카탈로그를 사용할 수 없습니다.'),btn('내 풀이 기록 보기',()=>{explorerTab='records';render('explorer');}));return;}
      const attempts=activeAttempts(data()),table=el('div','explorer-table'),header=el('div','explorer-row explorer-table-head');for(const name of ['문제','플랫폼 · 난이도','주제','내 기록'])header.append(el('span','',name));table.append(header);
      for(const p of response.items??[]){const records=attempts.filter(a=>a.problem_key===p.key),b=btn('',()=>catalogDetails(p,records),'explorer-row');const name=el('span','problem-name');name.append(el('strong','',p.title),el('small','meta',p.key));b.append(name,el('span','',`${p.platform} · ${p.platform==='leetcode'?LEVELS[p.difficulty_value]??'미기록':p.difficulty_value??'미기록'}`),el('span','topic-label',(p.tags??[]).slice(0,3).join(' · ')||'주제 미기록'),el('span','row-status',records.some(completion)?'해결':records.length?`${records.length}회 시도`:'미시도'));table.append(b);}if(!(response.items??[]).length)table.append(empty('검색에 맞는 문제가 없습니다.'));results.append(el('p','meta',`${Number(response.total??0).toLocaleString()}개 문제 · 플랫폼 고유 난이도`),table);
      const pager=el('div','explorer-pager'),previous=btn('이전',()=>{explorerOffset=Math.max(0,explorerOffset-30);void load();}),next=btn('다음',()=>{explorerOffset+=30;void load();});previous.disabled=explorerOffset===0;next.disabled=explorerOffset+30>=(response.total??0);pager.append(previous,el('span','meta',`${Math.floor(explorerOffset/30)+1}페이지`),next);results.append(pager);
    }catch{if(serial===explorerRequest&&results.isConnected){results.replaceChildren(empty('카탈로그를 불러오지 못했습니다.'),btn('다시 시도',()=>load()),btn('내 풀이 기록',()=>{explorerTab='records';render('explorer');}));}}finally{if(serial===explorerRequest)results.setAttribute('aria-busy','false');}}
    controls.addEventListener('submit',event=>{event.preventDefault();filters.query=query.value;filters.platform=platform.value;filters.difficulty=difficulty.value;explorerOffset=0;void load();});void load();
  }
  function catalogDetails(problem,attempts){
    const c=el('div','problem-details'),event={...problem,problem_key:problem.key},actions=problemActions(event);c.append(section('학습',facts([['기록',attempts.length?`${attempts.length}회 시도`:'미시도'],['주제',(problem.tags??[]).map(topicLabel).join(' · ')||'미기록'],['문제 키',problem.key]])));const records=section('풀이 이력');if(!attempts.length)records.append(empty('아직 풀이 기록이 없습니다.'));for(const attempt of attempts)records.append(row(attempt));c.append(records);openInspector(problem.title,c,{sourceUrl:problem.url,metadata:[problem.platform,problem.difficulty].filter(Boolean).join(' · '),actions});
  }
  function render(nextView=view){if(nextView!==view){closeInspector({returnFocus:false});menuOpen=null;}inspectorObserver?.disconnect();inspectorObserver=null;const focusKey=document.activeElement?.dataset?.focus;comparisonObserver?.disconnect();comparisonObserver=null;if(nextView==='library'||nextView==='similarity'){researchTab=nextView;nextView='research';}if(nextView==='history'){explorerTab='records';nextView='explorer';}view=nextView;root.replaceChildren();if(view==='dashboard')dashboard();else if(view==='explorer')explorer();else if(view==='analytics')analytics();else if(view==='contests')renderContestList();else if(view==='research')research();else renderCalendar();if(focusKey)[...root.querySelectorAll('[data-focus]')].find(n=>n.dataset.focus===focusKey)?.focus({preventScroll:true});}
  document.addEventListener('pointerdown',event=>{if(menuOpen&&!event.target.closest?.('.cal-menu-wrap'))dismissMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menuOpen){event.preventDefault();event.stopPropagation();dismissMenu({returnFocus:true});}},true);
  document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]')||event.target.matches('input,textarea,select,[contenteditable=true]')||event.ctrlKey||event.altKey||event.metaKey)return;if(view!=='calendar')return;if(['j','k','t'].includes(event.key.toLowerCase())){event.preventDefault();if(event.key.toLowerCase()==='t'){cursor=localDate(new Date());selectDay(cursor);return;}cursor=navigateDate(cursor,event.key.toLowerCase()==='j'?1:-1,mode);render();}});
  return {render,openDay:daily,openRecord:previous=>{if(previous)edit(previous);}};
}
