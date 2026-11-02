import {installAppearance,normalizeAppearance} from '../../hosted/public/appearance.mjs';
import {EditorState,Compartment} from '@codemirror/state';
import {EditorView,keymap,lineNumbers,highlightActiveLine} from '@codemirror/view';
import {defaultKeymap,history,historyKeymap} from '@codemirror/commands';
import {python} from '@codemirror/lang-python';
import {cpp} from '@codemirror/lang-cpp';
import {configureDialog,requestDialogClose} from '../../hosted/public/overlays.mjs';
import {createNavigation,NAVIGATION} from '../../hosted/public/ui.mjs';
import {workspaceEvents,activeAttempts,outcomeText} from '../../hosted/public/workspace-data.mjs';
import {normalizeLayout,normalizeRoute,validatedProblem} from './layout-state.mjs';

const $=id=>document.getElementById(id);
document.querySelectorAll('dialog').forEach(configureDialog);
const token=document.querySelector('meta[name=desktop-token]').content;
const frame=$('learning-frame');
let appearanceHydrated=false;
const appearance=installAppearance({onChange:(mode,effective)=>{
 $('appearance').value=mode;$('appearance-status').textContent=effective==='dark'?'다크 모드 적용됨':'라이트 모드 적용됨';
 window.algorithmNativeAuth?.appearance?.(mode).catch(report);
}});
$('appearance').addEventListener('change',async()=>{const previous=appearance.get();const mode=appearance.set($('appearance').value);try{await command('appearance-setting',{appearance:mode});}catch(error){appearance.set(previous);report(error);}});
const LAYOUT_KEY='algorithm-mastery.desktop-layout.v2';
let layout;
try{layout=normalizeLayout(JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}'));}catch{layout=normalizeLayout();}
let repo=null,path=null,repos=[],files=[],loading=false,draftTimer=null,saveQueue=Promise.resolve(),running=false,route='dashboard',layoutSupported=false,layoutHydrated=false,historyRequest=0;
const buffers=new Map();
const language=new Compartment();
const editor=new EditorView({state:EditorState.create({doc:'',extensions:[
 lineNumbers(),highlightActiveLine(),history(),keymap.of([...defaultKeymap,...historyKeymap]),language.of(python()),
 EditorView.updateListener.of(update=>{
  if(update.selectionSet||update.docChanged){const position=update.state.selection.main.head,line=update.state.doc.lineAt(position);$('cursor-position').textContent=`Ln ${line.number}, Col ${position-line.from+1}`;}
  if(update.docChanged&&!loading&&repo&&path){
   const content=update.state.doc.toString(),target={repoId:repo.id,path,content};buffers.set(bufferKey(repo.id,path),{repoId:repo.id,path,content});
   $('draft-state').textContent='초안 저장 중…';clearTimeout(draftTimer);
   draftTimer=setTimeout(()=>{saveQueue=saveQueue.catch(()=>{}).then(()=>command('draft',target)).then(()=>{if(repo?.id===target.repoId&&path===target.path)$('draft-state').textContent='초안 저장됨';}).catch(report);},250);
  }
 })
]}),parent:$('editor')});

function notify(message,error=false){$('notice').hidden=false;$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function report(error){notify(error.message||String(error),true);}
async function request(url,options={}){const r=await fetch(url,{...options,headers:{'Content-Type':'application/json','X-Desktop-Token':token,...options.headers}});const data=await r.json();if(!r.ok)throw Error(data.error||'요청을 처리하지 못했습니다.');return data;}
function command(command,input={}){return request('/desktop/api/command',{method:'POST',body:JSON.stringify({command,...input})});}
function selected(){if(!repo)throw Error('저장소를 먼저 연결하세요.');return repo.id;}
function current(){selected();if(!path)throw Error('파일을 먼저 선택하세요.');return {repoId:repo.id,path};}
// Daily logs are dated in the policy time zone (Asia/Seoul), like the learning engine.
const todayKst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let dailyFolder='leetcode';try{dailyFolder=['leetcode','codeforces','atcoder'].includes(localStorage.getItem('aldy.daily-folder'))?localStorage.getItem('aldy.daily-folder'):'leetcode';}catch{}
const action=(id,fn)=>$(id).addEventListener('click',async event=>{event.preventDefault();try{await fn();}catch(error){report(error);}});
const bufferKey=(repoId,file)=>repoId+'\0'+file;
function persistLayout(){localStorage.setItem(LAYOUT_KEY,JSON.stringify(layout));if(layoutSupported)void command('layout-setting',{layout:{...layout}}).catch(report);}
function applyLayout(){
 $('code-layout').style.setProperty('--explorer-width',layout.explorerWidth+'px');const available=$('code-layout').clientHeight,panelHeight=available?Math.min(layout.panelHeight,Math.max(160,available-220)):layout.panelHeight;$('code-layout').style.setProperty('--panel-height',panelHeight+'px');
 $('code-layout').classList.toggle('explorer-collapsed',layout.explorerCollapsed);$('code-layout').classList.toggle('panel-collapsed',layout.panelCollapsed);
 $('toggle-explorer').setAttribute('aria-pressed',String(layout.explorerCollapsed));$('toggle-panel').setAttribute('aria-expanded',String(!layout.panelCollapsed));$('toggle-panel').textContent=layout.panelCollapsed?'펼치기':'접기';
 $('explorer-resizer').setAttribute('aria-valuenow',String(layout.explorerWidth));$('panel-resizer').setAttribute('aria-valuenow',String(layout.panelHeight));
 for(const button of document.querySelectorAll('[data-panel]')){const selected=button.dataset.panel===layout.panel;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
 for(const id of ['output','input','tests','record','git'])$('panel-'+id).hidden=id!==layout.panel;
 editor.requestMeasure();
}
function setPanel(panel){layout=normalizeLayout({...layout,panel,panelCollapsed:false});applyLayout();persistLayout();}
for(const button of document.querySelectorAll('[data-panel]')){
 button.addEventListener('click',()=>setPanel(button.dataset.panel));
 button.addEventListener('keydown',event=>{const items=[...document.querySelectorAll('[data-panel]')],index=items.indexOf(button),delta=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;if(delta){event.preventDefault();const next=items[(index+delta+items.length)%items.length];setPanel(next.dataset.panel);next.focus();}});
}
action('toggle-explorer',()=>{layout.explorerCollapsed=!layout.explorerCollapsed;applyLayout();persistLayout();});
action('toggle-panel',()=>{layout.panelCollapsed=!layout.panelCollapsed;applyLayout();persistLayout();});
function bindResizer(id,axis){
 const divider=$(id);divider.setAttribute('aria-valuemin',axis==='x'?'160':'160');divider.setAttribute('aria-valuemax',axis==='x'?'440':'520');divider.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();divider.setPointerCapture(event.pointerId);divider.classList.add('resizing');const start=axis==='x'?event.clientX:event.clientY,initial=axis==='x'?layout.explorerWidth:layout.panelHeight;
  const move=event=>{const delta=(axis==='x'?event.clientX:event.clientY)-start;layout=normalizeLayout({...layout,[axis==='x'?'explorerWidth':'panelHeight']:initial+(axis==='x'?delta:-delta)});applyLayout();};
  const finish=()=>{divider.classList.remove('resizing');divider.removeEventListener('pointermove',move);divider.removeEventListener('pointerup',finish);divider.removeEventListener('pointercancel',finish);persistLayout();};
  divider.addEventListener('pointermove',move);divider.addEventListener('pointerup',finish);divider.addEventListener('pointercancel',finish);
 });
 divider.addEventListener('keydown',event=>{const delta=axis==='x'?{ArrowLeft:-16,ArrowRight:16}[event.key]:{ArrowUp:16,ArrowDown:-16}[event.key];if(delta){event.preventDefault();const key=axis==='x'?'explorerWidth':'panelHeight';layout=normalizeLayout({...layout,[key]:layout[key]+delta});applyLayout();persistLayout();}});
}
bindResizer('explorer-resizer','x');bindResizer('panel-resizer','y');

const nav=createNavigation({active:'dashboard',onNavigate:view=>navigate(view)});
if(nav?.nodeType)$('desktop-navigation').append(nav);
else if(nav?.element)$('desktop-navigation').append(nav.element);
function updateNavigation(view){
 for(const button of $('desktop-navigation').querySelectorAll('[data-view],[data-route]')){const id=button.dataset.view??button.dataset.route;button.title=NAVIGATION.find(item=>item.id===id)?.label??id;button.setAttribute('aria-current',id===view?'page':'false');button.classList.toggle('active',id===view);}
 const item=NAVIGATION.find(item=>item.id===view);$('route-label').textContent=item?.label??'학습 설정';
}
function navigate(value,{notifyFrame=true,legacy=false}={}){
 const view=normalizeRoute(value);
 if(view==='settings'){if(legacy){route='settings';$('workspace').hidden=false;$('tools').hidden=true;updateNavigation('settings');if(notifyFrame)frame.contentWindow?.postMessage({type:'algorithm-navigate',view:'today'},location.origin);}else $('settings-drawer').showModal();return;}
 route=view;$('workspace').hidden=view==='workspace';$('tools').hidden=view!=='workspace';updateNavigation(view);
 window.history.replaceState(null,'','#'+view);
 if(view==='workspace'){applyLayout();editor.requestMeasure();return;}
 if(notifyFrame)frame.contentWindow?.postMessage({type:'algorithm-navigate',view:legacy?value:view},location.origin);
}
frame.addEventListener('load',()=>{if(route!=='workspace')frame.contentWindow.postMessage({type:'algorithm-navigate',view:route},location.origin);});
action('tools-tab',()=>navigate('workspace'));action('workspace-tab',()=>navigate('calendar'));
action('open-settings',()=>$('settings-drawer').showModal());action('connect-repository',()=>{$('settings-drawer').close();navigate('workspace');$('workspace-start').querySelector('input')?.focus();});action('repository-settings',()=>$('settings-drawer').showModal());
action('close-settings',()=>requestDialogClose($('settings-drawer')));action('open-problem',()=>{$('problem-form').reset();$('platform').value=dailyFolder;$('problem-dialog').showModal();});action('close-problem',()=>requestDialogClose($('problem-dialog')));
action('keyboard-help',()=>{if(!document.querySelector('dialog[open]'))$('shortcut-dialog').togglePopover();});action('close-shortcuts',()=>$('shortcut-dialog').hidePopover());
action('learning-settings',()=>{if(!requestDialogClose($('settings-drawer')))return;navigate('today',{legacy:true});});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
$('repo-operation').addEventListener('change',()=>{$('clone-url-field').hidden=$('repo-operation').value!=='clone';$('clone-url').required=$('repo-operation').value==='clone';});

function setText(text,file){loading=true;editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:text},effects:language.reconfigure(file.endsWith('.cpp')?cpp():file.endsWith('.py')?python():[])});loading=false;$('filename').textContent=file;$('file-language').textContent=file.endsWith('.cpp')?'C++17':file.endsWith('.py')?'Python 3':'일반 텍스트';$('draft-state').textContent='';if($('code-history').open)void loadProblemHistory();renderBufferTabs();highlightFile();}
async function flushDraft(){clearTimeout(draftTimer);if(repo&&path){const target={...current(),content:editor.state.doc.toString()};saveQueue=saveQueue.catch(()=>{}).then(()=>command('draft',target));}await saveQueue;}
function renderBufferTabs(){
 const entries=[...buffers.values()].filter(item=>item.repoId===repo?.id);$('buffer-tabs').replaceChildren(...entries.map(item=>{const button=document.createElement('button');button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(item.path===path));button.textContent=item.path.split('/').slice(-2).join('/');button.title=item.path;button.addEventListener('click',()=>loadFile(item.path).catch(report));return button;}));
}
function highlightFile(){for(const button of $('files').querySelectorAll('button'))button.setAttribute('aria-selected',String(button.dataset.path===path));}
async function loadFile(file){
 await flushDraft();const r=await command('read',{repoId:selected(),path:file});path=file;const content=r.draft?.content??r.content;
 buffers.set(bufferKey(repo.id,file),{repoId:repo.id,path:file,content});setText(content,file);if(r.draft)$('draft-state').textContent='저장된 초안 복원됨';$('commit-paths').value=file;
 const parts=file.split('/');if(parts.length>=3&&['leetcode','atcoder','codeforces'].includes(parts[0])){$('platform').value=parts[0];$('problem-id').value=parts[1];const match=r.content.match(/https:\/\/[^\s]+/);if(match)$('problem-url').value=match[0];}if($('code-history').open)void loadProblemHistory();
}
function renderFiles(){
 const query=$('file-search').value.toLowerCase(),visible=files.filter(file=>file.toLowerCase().includes(query));let previous='';const nodes=[];
 for(const file of visible){const directory=file.includes('/')?file.slice(0,file.lastIndexOf('/')):'루트';if(directory!==previous){const item=document.createElement('li');item.className='file-directory';item.textContent=directory;item.setAttribute('role','presentation');nodes.push(item);previous=directory;}
  const li=document.createElement('li'),button=document.createElement('button');li.setAttribute('role','none');button.type='button';button.setAttribute('role','treeitem');button.dataset.path=file;button.textContent=file.split('/').at(-1);button.title=file;button.setAttribute('aria-label',file);button.addEventListener('click',()=>loadFile(file).catch(report));button.addEventListener('keydown',event=>{const buttons=[...$('files').querySelectorAll('button')],index=buttons.indexOf(button);const target=event.key==='ArrowDown'?Math.min(buttons.length-1,index+1):event.key==='ArrowUp'?Math.max(0,index-1):event.key==='Home'?0:event.key==='End'?buttons.length-1:null;if(target!==null){event.preventDefault();buttons[target].focus();}});li.append(button);nodes.push(li);
 }
 $('files').replaceChildren(...nodes);$('explorer-empty').hidden=Boolean(repo);$('workspace-start').hidden=Boolean(repo);$('code-layout').classList.toggle('no-repository',!repo);$('tools').classList.toggle('no-repository',!repo);if(repo&&!files.length){const text=document.createElement('li');text.className='compact-empty';text.textContent='아직 파일이 없습니다. 문제 열기로 첫 파일을 만드세요.';$('files').append(text);}highlightFile();
}
async function refreshFiles(){if(!repo){files=[];renderFiles();return;}files=(await command('files',{repoId:repo.id})).files.sort((a,b)=>a.localeCompare(b));renderFiles();}
$('file-search').addEventListener('input',renderFiles);
function connectionText(state){$('connection').textContent=state.engine==='running'?'엔진 연결됨':'엔진 재연결 중 · '+state.engine;}
async function refreshState({selectRepoId}={}){
 const state=await request('/desktop/api/state');if(!appearanceHydrated){appearanceHydrated=true;appearance.set(normalizeAppearance(state.appearance));}repos=state.repositories;if(state.layout&&typeof state.layout==='object'){layoutSupported=true;if(!layoutHydrated){layout=normalizeLayout(state.layout);layoutHydrated=true;applyLayout();}}
 $('update-check').disabled=!state.updates?.configured;$('update-status').textContent=state.updates?.configured?'업데이트 채널 설정됨':'서명된 업데이트 채널이 아직 설정되지 않았습니다.';
 const selectedCatalog=$('catalogs').value;$('catalogs').replaceChildren(...(state.catalogs??[]).map(version=>{const option=document.createElement('option');option.value=version;option.textContent=version;return option;}));if([...$('catalogs').options].some(o=>o.value===selectedCatalog))$('catalogs').value=selectedCatalog;
 const previous=selectRepoId??repo?.id;$('repositories').replaceChildren(...repos.map(r=>{const option=document.createElement('option');option.value=r.id;option.textContent=r.path.split(/[\\/]/).filter(Boolean).at(-1);option.title=r.path;return option;}));
 repo=repos.find(r=>r.id===previous)??repos[0]??null;if(repo){$('repositories').value=repo.id;$('sync-enabled').checked=Boolean(repo.sync);$('repo-branch').textContent=repo.path.split(/[\\/]/).at(-1);}
 connectionText(state);await refreshFiles();
}
$('repositories').addEventListener('change',async()=>{try{await flushDraft();repo=repos.find(r=>r.id===$('repositories').value);path=null;setText('','왼쪽에서 파일을 고르거나 문제 열기(⌘P)로 새 풀이를 시작하세요');$('sync-enabled').checked=Boolean(repo.sync);$('repo-branch').textContent=repo.path.split(/[\\/]/).at(-1);await refreshFiles();}catch(error){report(error);}});
$('repository-form').addEventListener('submit',async event=>{event.preventDefault();try{const result=await command($('repo-operation').value,{path:$('repo-path').value,url:$('clone-url').value});await refreshState({selectRepoId:result.id});$('settings-drawer').close();navigate('workspace');notify('저장소를 연결했습니다.');}catch(error){report(error);}});
function showDaily(result,line){path=result.relative;buffers.set(bufferKey(repo.id,path),{repoId:repo.id,path,content:result.content});setText(result.content,path);$('commit-paths').value=path;if(line){const target=editor.state.doc.line(Math.min(line,editor.state.doc.lines));editor.dispatch({selection:{anchor:target.from},scrollIntoView:true});editor.focus();}}
async function openToday(folder=dailyFolder){await flushDraft();const result=await command('daily-open',{repoId:selected(),date:todayKst(),folder});showDaily(result,result.content.split(/\r?\n/).length);navigate('workspace');await refreshFiles();if(result.created)notify(result.relative+' 파일을 만들었습니다.');}
action('open-today',()=>openToday());
$('problem-form').addEventListener('submit',async event=>{event.preventDefault();try{await flushDraft();const folder=$('platform').value;dailyFolder=folder;try{localStorage.setItem('aldy.daily-folder',folder);}catch{}const result=await command('daily-add',{repoId:selected(),date:todayKst(),folder,url:$('problem-url').value.trim(),title:$('problem-title').value.trim()||$('problem-id').value.trim(),language:$('language').value});showDaily(result,result.line);$('problem-dialog').close();navigate('workspace');await refreshFiles();notify(result.added?'오늘 기록에 문제를 추가했습니다.':'이미 오늘 기록에 있는 문제입니다.');}catch(error){report(error);}});
action('refresh-files',refreshFiles);
async function saveCurrent(){const target=current();await flushDraft();await command('save',{...target,content:editor.state.doc.toString()});$('draft-state').textContent='파일 저장됨';notify('파일을 저장했습니다.');}
action('save',saveCurrent);
function executionState(value,label){$('execution-state').dataset.state=value;$('execution-state').textContent=label;}
async function run(tests){
 if(running)throw Error('실행 중입니다. 먼저 중지하거나 결과를 기다리세요.');current();
 let cases;if(tests){cases=JSON.parse($('tests').value||'[]');if(!Array.isArray(cases)||!cases.length)throw Error('테스트를 먼저 추가하세요.');}
 await flushDraft();running=true;$('run').disabled=true;$('run-tests').disabled=true;$('cancel-run').disabled=false;setPanel('output');executionState('running',tests?'테스트 실행 중':'실행 중');$('run-result').textContent='실행 중…';
 try{const result=await command('run',{...current(),line:editor.state.doc.lineAt(editor.state.selection.main.head).number,input:$('stdin').value,...(tests?{tests:cases}:{})});renderRun(result);const rows=result.tests??[result],passed=rows.every(row=>['pass','completed'].includes(row.verdict));executionState(passed?'complete':'failed',passed?'실행 완료':'결과 확인');}
 catch(error){executionState('failed','실행 오류');$('run-result').textContent=error.message;throw error;}
 finally{running=false;$('run').disabled=false;$('run-tests').disabled=false;$('cancel-run').disabled=true;}
}
action('run',()=>run(false));action('run-tests',()=>run(true));
action('cancel-run',async()=>{await command('cancel-run',{repoId:selected()});notify('실행 취소를 요청했습니다.');});
const testPath=()=>{current();return path.slice(0,path.lastIndexOf('/')+1)+'tests.json';};
function renderTests(){
 let tests;try{tests=JSON.parse($('tests').value||'[]');if(!Array.isArray(tests))throw Error();}catch{$('test-count').textContent='?';return;}
 $('test-count').textContent=tests.length;$('test-cases').replaceChildren();
 if(!tests.length){const empty=document.createElement('p');empty.className='compact-empty';empty.textContent='입력과 예상 출력을 직접 추가하세요.';$('test-cases').append(empty);}
 tests.forEach((test,index)=>{const row=document.createElement('div');row.className='test-case';const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');row.append(number);
  const change=()=>{$('tests').value=JSON.stringify(tests,null,2);};
  for(const [key,label]of [['input','입력'],['expected','예상 출력']]){const text=document.createElement('textarea');text.value=test[key]??'';text.placeholder=label;text.setAttribute('aria-label',`테스트 ${index+1} ${label}`);text.spellcheck=false;text.addEventListener('input',()=>{test[key]=text.value;change();});row.append(text);}
  const comparison=document.createElement('label');comparison.textContent='비교';const select=document.createElement('select');for(const [value,label]of [['exact','정확히 일치'],['whitespace','공백 무시'],['float','실수 허용 오차']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=test.comparison??'exact';select.setAttribute('aria-label',`테스트 ${index+1} 비교 방식`);select.addEventListener('change',()=>{test.comparison=select.value;change();renderTests();});comparison.append(select);
  if(select.value==='float'){const tolerance=document.createElement('input');tolerance.type='number';tolerance.min='0';tolerance.step='any';tolerance.value=test.tolerance??1e-6;tolerance.setAttribute('aria-label',`테스트 ${index+1} 허용 오차`);tolerance.addEventListener('input',()=>{test.tolerance=Number(tolerance.value);change();});comparison.append(tolerance);}row.append(comparison);
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`테스트 ${index+1} 삭제`);remove.addEventListener('click',()=>{tests.splice(index,1);change();renderTests();});row.append(remove);$('test-cases').append(row);
 });
}
action('add-test',()=>{const tests=JSON.parse($('tests').value||'[]');if(!Array.isArray(tests))throw Error('테스트는 배열이어야 합니다.');tests.push({input:'',expected:'',comparison:'exact'});$('tests').value=JSON.stringify(tests,null,2);renderTests();});
action('apply-test-json',()=>{const tests=JSON.parse($('tests').value||'[]');if(!Array.isArray(tests))throw Error('테스트는 배열이어야 합니다.');renderTests();});
action('load-tests',async()=>{$('tests').value=(await command('read',{repoId:selected(),path:testPath()})).content;renderTests();setPanel('tests');});
action('save-tests',async()=>{const tests=JSON.parse($('tests').value||'[]');if(!Array.isArray(tests))throw Error('테스트는 배열이어야 합니다.');await command('save',{repoId:selected(),path:testPath(),content:JSON.stringify(tests,null,2)+'\n'});notify('tests.json을 저장했습니다.');renderTests();});
async function loadProblemHistory(){
 const requestId=++historyRequest,key=$('platform').value+':'+$('problem-id').value;
 if(!$('problem-id').value){$('code-history-content').textContent='먼저 문제를 열어주세요.';return;}
 $('code-history-content').textContent='기록을 확인하는 중…';
 try{const [journal,state]=await Promise.all([request('/api/journal'),request('/api/state')]);if(requestId!==historyRequest)return;
  if(!journal.available){$('code-history-content').textContent='이 실행 환경에서는 카탈로그 학습 이력을 조회할 수 없습니다.';return;}
  const attempts=activeAttempts(workspaceEvents(journal,state)).filter(event=>event.problem_key?.toLowerCase()===key.toLowerCase()).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at)));
  $('code-history-content').replaceChildren();
  if(!attempts.length){$('code-history-content').textContent='아직 이 문제에 기록된 시도가 없습니다.';return;}
  for(const attempt of attempts){const row=document.createElement('div');row.className='code-history-row';const date=document.createElement('time');date.textContent=attempt.date;const outcome=document.createElement('span');outcome.textContent=outcomeText(attempt);const duration=document.createElement('span');duration.textContent=attempt.self_seconds!=null?attempt.self_seconds+'초':attempt.self_minutes!=null?attempt.self_minutes+'분':'시간 미기록';row.append(date,outcome,duration);$('code-history-content').append(row);}
 }catch{if(requestId===historyRequest)$('code-history-content').textContent='기록을 불러오지 못했습니다. 문제 탐색에서 다시 확인하세요.';}
}
$('code-history').addEventListener('toggle',()=>{if($('code-history').open)void loadProblemHistory();});
action('open-all-records',()=>navigate('explorer'));
function commitInput(){return {repoId:selected(),paths:$('commit-paths').value.split('\n').map(value=>value.trim()).filter(Boolean),message:$('commit-message').value};}
action('preview',async()=>{const result=await command('preview',commitInput());$('diff').textContent=[result.tracked,...result.untracked.map(file=>'--- /dev/null\n+++ '+file.path+'\n'+file.content.split('\n').map(line=>'+'+line).join('\n'))].filter(Boolean).join('\n');setPanel('git');});
action('commit',async()=>{const result=await command('commit',commitInput());$('diff').textContent='커밋: '+result.commit+(result.ingestion?.status==='error'?'\n학습 기록 수집 실패: '+result.ingestion.error:'\n학습 기록 수집 요청 완료');notify(result.ingestion?.status==='error'?'커밋 완료 · 학습 기록 수집 실패: '+result.ingestion.error:'선택한 파일을 커밋했습니다.',result.ingestion?.status==='error');frame.contentWindow.location.reload();await refreshFiles();});
$('sync-enabled').addEventListener('change',()=>{if(repo)command('sync-setting',{repoId:selected(),enabled:$('sync-enabled').checked}).catch(report);else{$('sync-enabled').checked=false;notify('저장소를 먼저 연결하세요.',true);}});
action('sync',async()=>{notify('동기화: '+(await command('sync',{repoId:selected()})).state);});
action('push',async()=>{notify('Push: '+(await command('push',{repoId:selected()})).state);});
action('use-catalog',async()=>{if(!$('catalogs').value)throw Error('사용 가능한 카탈로그가 없습니다.');await command('catalog',{version:$('catalogs').value});frame.contentWindow.location.reload();notify('카탈로그를 선택했습니다.');});

const nativeAuth=globalThis.algorithmNativeAuth;
// GitHub sign-in (NW-2..NW-6): device flow in the native shell; the renderer only sees codes, the login and repository metadata.
const builtInClient=nativeAuth?.githubClientId??null;let githubAccount=null;
$('github-sign-in').disabled=!nativeAuth;$('github-sign-out').disabled=!nativeAuth;$('github-status').textContent=nativeAuth?'로그인 상태 확인 중…':'브라우저 미리보기에서는 시스템 Git 인증을 사용합니다.';
$('github-client-advanced').open=Boolean(nativeAuth&&!builtInClient);
function renderAccount(){
 const signedIn=Boolean(githubAccount),canSignIn=Boolean(nativeAuth&&builtInClient);
 $('start-github-sign-in').hidden=signedIn||!canSignIn;$('start-github-sign-out').hidden=!signedIn;
 $('start-github-status').textContent=signedIn?`@${githubAccount.login} 계정으로 로그인됨 · 저장소 ${githubAccount.repositories.length}개`:canSignIn?'로그인하면 내 저장소 목록에서 고르거나 GitHub에 새 비공개 저장소를 만들 수 있어요. 컴퓨터에 이미 Git 인증(GitHub Desktop, gh, 키체인)이 있으면 로그인 없이도 가져오기와 Push가 됩니다.':'이 빌드에는 GitHub 로그인이 설정되어 있지 않습니다. 컴퓨터의 Git 인증(GitHub Desktop, gh, 키체인)으로 가져오기와 Push가 됩니다.';
 const clone=document.querySelector('[data-start=clone]'),select=clone.elements.repository;select.closest('label').hidden=!signedIn;
 if(signedIn){select.replaceChildren(new Option('저장소 선택…',''),...githubAccount.repositories.map(r=>new Option(`${r.fullName}${r.private?' · 비공개':''}`,r.cloneUrl)));}
 document.querySelector('[data-start=create] .start-check').hidden=!signedIn;
}
async function refreshAuth(){if(!nativeAuth)return renderAccount();const signedIn=(await nativeAuth.status()).signedIn;$('github-status').textContent=signedIn?'GitHub 로그인됨':'로그아웃 상태';githubAccount=null;if(signedIn&&nativeAuth.githubRepositories){try{githubAccount=await nativeAuth.githubRepositories();}catch(error){$('start-github-status').textContent=error.message||String(error);}}renderAccount();}
async function signIn(device,status){
 const clientId=$('github-client-id').value.trim()||builtInClient;if(!clientId)throw Error('이 빌드에는 GitHub 로그인 앱이 설정되지 않았습니다. 시스템 Git 인증을 쓰거나 고급에서 Client ID를 입력하세요.');
 const flow=await nativeAuth.begin({clientId}),url=new URL(flow.verification_uri);if(url.protocol!=='https:'||url.hostname!=='github.com')throw Error('잘못된 인증 주소');
 const code=document.createElement('strong'),link=document.createElement('a'),hint=document.createElement('span');code.textContent=flow.user_code;link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='GitHub에서 코드 입력 ↗';hint.className='panel-note';hint.textContent='브라우저에서 이 코드를 입력하고 승인하세요.';
 device.replaceChildren(code,link,hint);status.textContent='GitHub에서 승인을 기다리는 중…';
 for(const id of ['start-github-sign-in','github-sign-in'])$(id).disabled=true;
 try{await nativeAuth.complete({flowId:flow.flowId});}finally{device.replaceChildren();for(const id of ['start-github-sign-in','github-sign-in'])$(id).disabled=false;}
 await refreshAuth();notify('GitHub 로그인이 완료됐습니다.');
}
action('start-github-sign-in',()=>signIn($('start-github-device'),$('start-github-status')));
action('github-sign-in',()=>signIn($('github-device'),$('github-status')));
action('start-github-sign-out',()=>$('github-sign-out').click());
// Start panel: the same register/create/clone commands as settings, with native folder pickers when the shell has them.
const picker=nativeAuth?.pickFolder;
const cloneTarget=form=>{const parent=form.elements.parent.value.trim().replace(/[\\/]+$/,''),name=form.elements.url.value.trim().match(/github\.com\/[^/]+\/([^/?#]+?)(?:\.git)?\/?$/)?.[1];return parent&&name?parent+(parent.includes('\\')?'\\':'/')+name:'';};
const folderName=value=>value.trim().replace(/[\\/]+$/,'').split(/[\\/]/).at(-1)??'';
for(const form of document.querySelectorAll('[data-start]')){
 for(const button of form.querySelectorAll('[data-pick]')){button.hidden=!picker;button.addEventListener('click',async()=>{try{const folder=await picker();if(folder){form.elements[button.dataset.pick].value=folder;form.dispatchEvent(new Event('input'));}}catch(error){report(error);}});}
 if(form.dataset.start==='clone'){form.elements.repository.addEventListener('change',()=>{if(form.elements.repository.value){form.elements.url.value=form.elements.repository.value;form.dispatchEvent(new Event('input'));}});form.addEventListener('input',()=>{const target=cloneTarget(form);form.querySelector('[data-target]').textContent=target?'저장 위치: '+target:'';});}
 form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{
  const operation=form.dataset.start,target=operation==='clone'?cloneTarget(form):form.elements.path.value.trim();if(!target)throw Error('GitHub 주소와 저장할 위치를 확인하세요.');
  let remote=null;if(operation==='create'&&githubAccount&&form.elements.github.checked){const created=await nativeAuth.githubCreateRepository({name:folderName(target),private:true});remote=created.cloneUrl;notify(`GitHub에 ${created.fullName} 저장소를 만들었습니다.`);}
  const result=await command(operation,{path:target,url:form.elements.url?.value.trim(),...(remote?{remote}:{})});await refreshState({selectRepoId:result.id});
  notify(operation==='clone'?'저장소를 복제해 연결했습니다.':remote?'새 저장소를 만들고 GitHub 원격을 연결했습니다. 첫 커밋 후 Git 패널에서 Push하세요.':'저장소를 연결했습니다.');
 }catch(error){report(error);}finally{button.disabled=false;}});
}
action('github-sign-out',async()=>{await nativeAuth.signOut();$('github-device').replaceChildren();await refreshAuth();notify('저장된 GitHub 인증을 삭제했습니다.');});
action('update-check',async()=>{const result=await command('update-check');$('update-status').textContent=result.status+' · '+result.version;$('update-stage').disabled=result.status!=='update_available';});
action('update-stage',async()=>{const result=await command('update-stage',{confirmed:true});$('update-status').textContent='다운로드 검증 완료 · '+result.version+' · 설치 전';$('update-stage').disabled=true;notify('서명과 해시를 검증한 업데이트 파일을 저장했습니다. 설치는 실행하지 않았습니다.');});

function renderRun(result){
 const labels={pass:'통과',wrong_answer:'출력이 다릅니다',completed:'실행 완료',runtime_error:'실행 오류',timeout:'시간 초과',output_limit:'출력 제한 초과',compile_error:'컴파일 오류',cancelled:'실행 취소'};
 $('run-result').replaceChildren(...(result.tests??[result]).map((row,index)=>{const card=document.createElement('article');card.className='run-card';card.dataset.verdict=row.verdict;const title=document.createElement('strong');title.textContent=(result.tests?'테스트 '+(index+1)+' · ':'')+(labels[row.verdict]??row.verdict)+(Number.isFinite(row.elapsed_ms)?' · '+row.elapsed_ms+' ms':'');card.append(title);
  for(const [label,text]of [['출력',row.stdout],['오류',row.stderr]])if(text){const heading=document.createElement('p'),output=document.createElement('pre');heading.textContent=label;output.textContent=text;card.append(heading,output);}
  const details=document.createElement('details'),summary=document.createElement('summary'),debug=document.createElement('pre');summary.textContent='실행 세부정보';debug.textContent=JSON.stringify(row,null,2);details.append(summary,debug);card.append(details);return card;
 }));
}

window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
 if(event.data?.type==='algorithm-route-changed'){const value=normalizeRoute(event.data.view);if(value==='settings'&&route!=='workspace')navigate('today',{notifyFrame:false,legacy:true});else if(value!=='workspace'&&route!=='workspace')navigate(value,{notifyFrame:false});return;}
 if(event.data?.type==='algorithm-open-settings'){$('settings-drawer').showModal();return;}
 if(event.data?.type!=='algorithm-open-problem')return;const problem=validatedProblem(event.data.problem);if(!problem)return;
 navigate('workspace');$('platform').value=problem.platform;$('problem-id').value=problem.id;$('problem-url').value=problem.url;$('problem-title').value=problem.title??'';if(repo)$('problem-form').requestSubmit();else notify('풀이 저장소를 먼저 연결한 뒤 문제를 열어주세요.');
});
window.addEventListener('keydown',event=>{
 const modifier=event.metaKey||event.ctrlKey;if(document.querySelector('dialog[open]'))return;
 if(modifier&&event.key.toLowerCase()==='p'){event.preventDefault();navigate('workspace');$('problem-dialog').showModal();return;}
 if(route!=='workspace')return;
 if(modifier&&event.key.toLowerCase()==='s'){event.preventDefault();void saveCurrent().catch(report);}
 else if(modifier&&event.key==='Enter'){event.preventDefault();void run(event.shiftKey).catch(report);}
 else if(modifier&&event.key.toLowerCase()==='b'){event.preventDefault();$('toggle-explorer').click();}
 else if(modifier&&event.key.toLowerCase()==='j'){event.preventDefault();$('toggle-panel').click();}
});
window.addEventListener('resize',applyLayout);
window.addEventListener('pagehide',()=>{if(repo&&path)fetch('/desktop/api/command',{method:'POST',headers:{'Content-Type':'application/json','X-Desktop-Token':token},body:JSON.stringify({command:'draft',repoId:repo.id,path,content:editor.state.doc.toString()}),keepalive:true}).catch(()=>{});});
setInterval(()=>request('/desktop/api/state').then(connectionText).catch(()=>{$('connection').textContent='연결 끊김';}),3000);
if(!/Mac/.test(navigator.platform))for(const key of document.querySelectorAll('kbd'))key.textContent=key.textContent.replaceAll('⌘','Ctrl');
renderTests();applyLayout();navigate(location.hash.slice(1)||'dashboard');refreshState().catch(report);refreshAuth().catch(report);
