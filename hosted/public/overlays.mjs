/** Shared DOM overlay lifecycle. Native dialog supplies inertness and modal Tab containment. */
let serial=0;
const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
const snapshot=d=>JSON.stringify([...d.querySelectorAll('input:not([data-autosave]),textarea:not([data-autosave]),select:not([data-autosave])')].map(n=>[n.name||n.id,n.type==='checkbox'||n.type==='radio'?n.checked:n.value]));
function restore(origin){const target=origin?.isConnected?origin:document.querySelector('.page-heading h1, #main, #open-problem');if(target){if(!target.matches('button,a,input,select,textarea,[tabindex]'))target.tabIndex=-1;target.focus({preventScroll:true});}}
export function requestDialogClose(d){
 if(!d?.open)return true;
 if(d.querySelector('[aria-busy="true"]')||d.querySelector('button[type="submit"]:disabled')){d.querySelector('[role=alert]')?.focus();return false;}
 if(d._dirty&&d._baseline!==snapshot(d)){
  let guard=d.querySelector('.discard-confirmation');
  if(!guard){guard=node('section','discard-confirmation');guard.setAttribute('role','alert');guard.append(node('strong','','입력한 내용을 버릴까요?'),node('p','','저장하지 않은 변경 사항이 있습니다.'));const actions=node('div','actions');for(const [label,discard]of [['계속 작성',false],['변경 사항 버리기',true]]){const b=node('button','button secondary',label);b.type='button';b.onclick=()=>{if(discard)d.close();else{guard.remove();d.querySelector('input,textarea,select')?.focus();}};actions.append(b);}guard.append(actions);d.append(guard);}
  guard.querySelector('button').focus();return false;
 }
 d.close();return true;
}
export function configureDialog(d){
 if(d._configured)return d;d._configured=true;const show=d.showModal.bind(d);
 d.showModal=()=>{for(const old of document.querySelectorAll('dialog[open]'))if(old!==d&&!requestDialogClose(old))return false;d._origin=document.activeElement;d._suppressReturn=false;d._baseline=snapshot(d);d._dirty=false;show();return true;};
 for(const type of ['input','change'])d.addEventListener(type,()=>{d._dirty=true;});
 d.addEventListener('cancel',e=>{e.preventDefault();requestDialogClose(d);});
 d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)requestDialogClose(d);}});
 d.addEventListener('close',()=>{d.querySelector('.discard-confirmation')?.remove();if(!d._suppressReturn&&!document.querySelector('dialog[open]'))restore(d._origin);});
 d.addEventListener('submit',()=>{ // Successful callers still explicitly close; input remains guarded on errors.
  d.querySelector('.discard-confirmation')?.remove();
 });
 return d;
}
function closeForReplacement(d){d._suppressReturn=true;const closed=requestDialogClose(d);if(!closed)d._suppressReturn=false;return closed;}
export function openDialog(title,content,{wide=false,sourceUrl=null,titleIcon=null}={}){
 for(const old of document.querySelectorAll('dialog[open]'))if(!closeForReplacement(old))return null;
 const d=configureDialog(node('dialog',`workspace-dialog${wide?' wide':''}`)),head=node('header','dialog-head'),group=node('div','dialog-title'),heading=node('h2','',title);heading.id=`dialog-title-${++serial}`;heading.tabIndex=-1;group.append(heading);if(titleIcon)group.prepend(titleIcon);
 if(sourceUrl){try{const u=new URL(sourceUrl);if(u.protocol==='https:'&&!u.username&&!u.password){const a=node('a','problem-source-link','↗');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','문제 원문 열기 (새 탭)');group.append(a);}}catch{}}
 const close=node('button','dialog-close','×');close.type='button';close.setAttribute('aria-label','대화상자 닫기');close.onclick=()=>requestDialogClose(d);head.append(group,close);const body=node('div','dialog-body');body.append(content);d.append(head,body);d.setAttribute('aria-labelledby',heading.id);d.setAttribute('aria-modal','true');document.body.append(d);d.addEventListener('close',()=>{d.remove();if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');},{once:true});
 d.showModal();document.body.classList.add('dialog-open');(content.querySelector('input:not([readonly]):not([disabled]),select,textarea')||heading).focus();return d;
}
export function closeInspector({returnFocus=true}={}){const old=document.querySelector('.problem-inspector');if(!old)return;const origin=old._origin;old.remove();document.body.classList.remove('inspector-open');if(returnFocus)restore(origin);}
export function openInspector(title,content,{sourceUrl=null,metadata='',actions=null}={}){
 for(const d of document.querySelectorAll('dialog[open]'))if(!closeForReplacement(d))return null;
 const old=document.querySelector('.problem-inspector'),origin=old?.contains(document.activeElement)?old._origin:document.activeElement;closeInspector({returnFocus:false});
 const pane=node('aside','problem-inspector');pane._origin=origin;pane.setAttribute('aria-label','문제 및 활동 상세');const head=node('header','inspector-header'),bar=node('div','inspector-caption');bar.append(node('span','','상세 정보'));const close=node('button','inspector-close','×');close.type='button';close.setAttribute('aria-label','상세 닫기');close.onclick=()=>closeInspector();bar.append(close);const h=node('h2','',title);h.id=`inspector-title-${++serial}`;h.tabIndex=-1;pane.setAttribute('aria-labelledby',h.id);head.append(bar,h);if(metadata)head.append(node('p','meta',metadata));
 if(sourceUrl){try{const u=new URL(sourceUrl);if(u.protocol==='https:'&&!u.username&&!u.password){const a=node('a','external-link','문제 원문 ↗');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';head.append(a);}}catch{}}
 if(actions)head.append(actions);const body=node('div','inspector-body');body.append(content);pane.append(head,body);document.body.append(pane);document.body.classList.add('inspector-open');h.focus({preventScroll:true});return pane;
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')&&document.querySelector('.problem-inspector')){e.preventDefault();closeInspector();}});
