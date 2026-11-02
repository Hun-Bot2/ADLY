/** Actual frontend, disposable authored fixtures; no provider requests or real learner writes. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {startLocal} from '../hosted/local.mjs';
import {startDesktop} from './dev.mjs';
import {catalogFromData} from '../hosted/mastery/catalog.mjs';
import {createJournalService} from '../hosted/mastery/journal.mjs';
import {createExplanationService} from '../hosted/mastery/explanations.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'/private/tmp/mastery-playwright/node_modules/playwright/index.mjs'));
const before=process.argv.includes('--before'),temp=await mkdtemp(join(tmpdir(),'mastery-inspector-')),output=resolve(process.env.SMOKE_OUTPUT_DIR??'specs/inspector-ux/screenshots');await mkdir(output,{recursive:true});
const learner='inspector-authored',token='inspector-fixture-00000000000000000000000000',env={GEMINI_API_KEY:'fixture',NVIDIA_API_KEY:'fixture',NVIDIA_EXPLANATION_MODEL:'fixture/model'};
const long='경계 조건을 보존하는 긴 문제 제목 — Binary Search with Duplicate Values and Korean Metadata '.repeat(2);
const catalog=catalogFromData({version:'fixture-inspector',problems:Array.from({length:6},(_,i)=>({key:`leetcode:inspector-${i}`,title:i===0?long:`Inspector Authored Problem ${i}`,platform:'leetcode',url:`https://leetcode.com/problems/inspector-${i}/`,difficulty_value:1,difficulty_kind:'lc_level',variation_group:`v${i}`,concepts:[{id:'arrays-hashing',status:'approved'}]})),concepts:[{id:'arrays-hashing',label:'Arrays'}]});
let desktop,engine,browser;const connection={url:'http://127.0.0.1:1',token};const errors=[],checks=[];
try{
 desktop=await startDesktop({appData:join(temp,'app'),catalogRoot:join(temp,'catalogs'),engineConnection:connection});
 engine=await startLocal({port:0,database:join(temp,'learner.sqlite3'),learnerId:learner,curriculum:{schema_version:1,curriculum_version:'fixture',problems:[],relationships:[]},catalogProvider:()=>catalog,autoGitSync:false,appToken:token,allowedOrigin:desktop.url,explanationEnv:env});connection.url=engine.url;
 const journal=createJournalService({db:engine.db,catalogProvider:()=>catalog});
 const explanations=createExplanationService({cacheRoot:join(temp,'explanations'),env,fetcher:async(url,options)=>{const body=JSON.parse(options.body),gemini=Boolean(body.contents);if(!gemini)return new Response('',{status:503});const packet=JSON.parse(body.contents[0].parts[0].text);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({text:'합성 검증용 저장 설명. 경계 조건을 먼저 확인하고 배열의 상태 변화를 추적합니다.',evidence_id:packet.evidence_id})}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:20,totalTokenCount:30}});}});
 await journal.attempt(learner,{event_id:'historical-manual-fixture',problem_key:'leetcode:inspector-0',outcome:'failed',hints:null,occurred_at:new Date(Date.now()-86400000).toISOString(),activity_type:'practice'});
 await explanations.decorate(learner,await journal.view(learner),{generate:true});
 browser=await chromium.launch({executablePath:process.env.CHROME_BINARY??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 let explanationUnavailable=false;
 await page.route('**/api/journal**',async route=>{const response=await route.fetch();const body=await response.json();function visit(value){if(!value||typeof value!=='object')return;if(value.problem_key&&value.reason){value.reason+='\n합성 긴 복습 메모: '+('경계 조건과 이전 시도에서 놓친 항목을 확인합니다. '.repeat(25));value.title=long;}if(explanationUnavailable&&value.explanation){value.explanation={results:[{provider:'gemini',status:'not_generated'},{provider:'nvidia',status:'not_configured'}],fallback:{text:'합성 기본 설명 · 기록된 학습 단계에 따른 연습입니다.'},evidence:value.explanation.evidence};}for(const v of Object.values(value))visit(v);}visit(body);await route.fulfill({response,json:body});});
 await page.goto(desktop.url);const frame=page.frameLocator('#learning-frame');await frame.locator('.dashboard-layout').waitFor();await page.locator('#connection').filter({hasText:'엔진 연결됨'}).waitFor();
 const shot=async name=>{await page.screenshot({path:join(output,name+'.png')});};
 if(!before){await page.locator('#desktop-navigation [data-view=calendar]').click();await frame.locator('.calendar-grid').waitFor();assert.equal(await frame.getByRole('button',{name:/^(풀이 기록|이 날짜에 기록|기록 추가|새 시도 기록)$/}).count(),0);await shot('calendar-without-manual-entry');await page.locator('#desktop-navigation [data-view=dashboard]').click();await frame.locator('.dashboard-layout').waitFor();checks.push('calendar and day panel have no manual entry actions');}
 if(before){for(const [w,h]of [[1280,800],[1440,900],[1024,720]]){await page.setViewportSize({width:w,height:h});await frame.locator('.dashboard-plan .workspace-row, .dashboard-plan .plan-row, .workspace-row.plan').first().click();await frame.locator('dialog[open]').waitFor();await shot(`before-modal-${w}x${h}`);await frame.locator('.dialog-close').click();}console.log(JSON.stringify({before:true,output,errors}));}
 else {
  // Assertions are extended alongside the implementation; all screenshots are actual DOM renders.
  for(const [w,h]of [[1280,800],[1440,900],[1024,720]]){
   await page.setViewportSize({width:w,height:h});await shot(`inspector-closed-${w}x${h}`);
   await frame.locator('.workspace-row.plan').first().click();await frame.locator('.problem-inspector').waitFor();await shot(`inspector-open-${w}x${h}`);
   assert.equal(await frame.locator('html').evaluate(n=>n.scrollWidth>n.clientWidth+1),false);assert.equal(await frame.locator('.problem-inspector').evaluate(n=>n.scrollWidth>n.clientWidth+1),false);
   assert.equal(await frame.locator('dialog[open]').count(),0);assert.equal(await frame.locator('[aria-modal=true]').count(),0);
   assert.ok(await frame.locator('.inspector-section').count()>=3);
   assert.equal(await frame.locator('.original-evidence[open]').count(),0);
   await frame.locator('.inspector-close').focus();await page.keyboard.press('Shift+Tab');assert.equal(await frame.locator('.problem-inspector').evaluate(n=>n.contains(n.ownerDocument.activeElement)),false);
   await frame.locator('.inspector-close').click();
  }
  checks.push('three sizes, nonmodal inspector, collapsed evidence');
  await page.setViewportSize({width:1440,height:900});
  await frame.locator('.workspace-row.plan').first().click();
  await frame.locator('.explanation-provider[data-provider=gemini] summary').click();
  await frame.locator('.explanation-provider[data-provider=nvidia] summary').click();
  assert.ok((await frame.locator('.explanation-provider[data-provider=gemini]').innerText()).includes('합성 검증용 저장 설명'));
  assert.ok((await frame.locator('.explanation-provider[data-provider=nvidia]').innerText()).includes('503'));
  await shot('ai-available');
  await frame.getByText('복습 이유 · 원문',{exact:true}).click();
  const review=frame.locator('.recommendation-detail .inspector-note').filter({hasText:'합성 긴 복습 메모'}).first();await review.waitFor();await review.scrollIntoViewIfNeeded();await shot('long-review-note');
  await frame.locator('.original-evidence summary').first().click();assert.ok((await frame.locator('.original-evidence').innerText()).includes('선정'));
  await shot('recommendation-evidence');
  const source=frame.locator('.inspector-header a');assert.ok((await source.getAttribute('href')).startsWith('https://leetcode.com/problems/'));assert.equal(await source.getAttribute('rel'),'noopener noreferrer');
  await page.context().route('https://leetcode.com/**',route=>route.fulfill({body:'Authored external navigation fixture'}));const popupPromise=page.waitForEvent('popup');await source.click();const popup=await popupPromise;assert.ok(popup.url().startsWith('https://leetcode.com/problems/'));await popup.close();await frame.locator('.inspector-close').focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await shot('keyboard-focused');await page.keyboard.press('Escape');await frame.locator('.problem-inspector').waitFor({state:'detached'});
  assert.ok(await frame.locator('.workspace-row.plan').first().evaluate(n=>n===n.ownerDocument.activeElement));
  checks.push('saved explanation, provider error, long note, evidence, HTTPS source and focus return');
  // Background remains usable, and source navigation closes stale inspector.
  await frame.locator('.workspace-row.plan').first().click();await page.locator('#desktop-navigation [data-view=explorer]').click();await frame.locator('button.explorer-row').filter({hasText:'leetcode:inspector-0'}).first().waitFor();await frame.locator('.problem-inspector').waitFor({state:'detached'});await frame.locator('button.explorer-row').filter({hasText:'leetcode:inspector-0'}).first().click();await frame.locator('.problem-inspector').waitFor();
  assert.ok((await frame.locator('.inspector-header h2').innerText()).length>80);await shot('long-problem-title');
  assert.equal(await frame.getByRole('button',{name:'풀이 기록',exact:true}).count(),0);await frame.locator('.problem-inspector .workspace-row.actual').first().click();await frame.getByRole('button',{name:'기록 수정',exact:true}).click();const dialog=frame.locator('dialog[open]');await dialog.waitFor();
  for(const [width,height]of [[1280,800],[1440,900],[1024,720]]){await page.setViewportSize({width,height});await shot(`after-modal-${width}x${height}`);assert.equal(await dialog.evaluate(n=>n.scrollWidth>n.clientWidth+1),false);}await page.setViewportSize({width:1440,height:900});
  const field=dialog.locator('#record-minutes');await field.focus();await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(d=>d.contains(d.ownerDocument.activeElement)));
  for(let i=0;i<14;i++){await page.keyboard.press(i%2?'Shift+Tab':'Tab');assert.ok(await dialog.evaluate(d=>d.contains(d.ownerDocument.activeElement)));}
  await frame.locator('#record-minutes').fill('12m');await page.keyboard.press('Escape');await dialog.locator('.discard-confirmation').waitFor();assert.equal(await frame.locator('dialog[open]').count(),1);await shot('modal-dirty-guard');
  await dialog.getByRole('button',{name:'계속 작성'}).click();assert.equal(await frame.locator('#record-minutes').inputValue(),'12m');
  await dialog.locator('.dialog-close').click();await dialog.getByRole('button',{name:'변경 사항 버리기'}).click();await dialog.waitFor({state:'detached'});
  assert.ok(await frame.getByRole('button',{name:'기록 수정',exact:true}).evaluate(n=>n===n.ownerDocument.activeElement));
  checks.push('modal focus entry/trap, safe Escape, dirty close, discard, logical return');
  await frame.locator('.inspector-close').click();await frame.locator('button.explorer-row').filter({hasText:'leetcode:inspector-0'}).first().click();await frame.locator('.inspector-actions .primary').click();await page.locator('#settings-drawer[open]').waitFor();assert.equal(await frame.locator('.problem-inspector').count(),0);await page.locator('#close-settings').click();
  checks.push('validated editor handoff opens repository setup');
  await page.locator('#keyboard-help').click();await page.locator('#shortcut-dialog:popover-open').waitFor();assert.equal(await page.locator('dialog[open]').count(),0);await shot('shortcut-popover');await page.keyboard.press('Escape');
  await page.locator('#open-problem').click();await page.locator('#problem-dialog[open]').waitFor();await page.locator('#problem-id').fill('draft-problem');await page.keyboard.press('Escape');await page.locator('#problem-dialog .discard-confirmation').waitFor();await page.locator('#problem-dialog').getByRole('button',{name:'변경 사항 버리기'}).click();
  checks.push('nonmodal contextual help and shell unsaved problem input');
  explanationUnavailable=true;await page.reload();await page.locator('#desktop-navigation [data-view=dashboard]').click();await frame.locator('.dashboard-layout').waitFor();await frame.locator('.workspace-row.plan').first().click();await frame.locator('.explanation-provider').first().waitFor();assert.ok((await frame.locator('.comparison-content').innerText()).includes('저장된 AI 설명 없음'));await frame.getByText('기본 설명',{exact:true}).click();await shot('ai-unavailable');
  checks.push('no generated explanation, not configured, accessible basic fallback');

 }
 assert.deepEqual(errors,[]);await writeFile(join(output,before?'before.receipt.json':'playwright.receipt.json'),JSON.stringify({synthetic:true,tool:'Playwright',before,checks,errors,output},null,2));
}finally{await browser?.close();await desktop?.close();await engine?.close();}
