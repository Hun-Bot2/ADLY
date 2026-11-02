import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLayout,normalizeRoute,validatedProblem} from '../ui/layout-state.mjs';
test('desktop layout restores bounded dimensions and rejects stale or invalid controls',()=>{
 assert.deepEqual(normalizeLayout({explorerWidth:900,panelHeight:-20,panel:'old-panel',explorerCollapsed:'true',panelCollapsed:true}),{explorerWidth:440,panelHeight:160,explorerCollapsed:false,panelCollapsed:true,panel:'output'});
 assert.equal(normalizeLayout({explorerWidth:NaN,panelHeight:Infinity}).panelHeight,240);
 assert.deepEqual(normalizeLayout(JSON.parse(JSON.stringify({explorerWidth:240,panelHeight:180,panel:'tests',explorerCollapsed:true,panelCollapsed:false}))),{explorerWidth:240,panelHeight:180,panel:'tests',explorerCollapsed:true,panelCollapsed:false});
});
test('removed history navigation preserves explorer access and legacy research routes',()=>{
 assert.equal(normalizeRoute('history'),'explorer');assert.equal(normalizeRoute('similarity'),'research');assert.equal(normalizeRoute('library'),'research');assert.equal(normalizeRoute('today'),'settings');assert.equal(normalizeRoute('unknown'),'dashboard');assert.equal(normalizeRoute('workspace'),'workspace');
});
test('editor messages reject foreign platform hosts and unsafe identities',()=>{
 const problem={platform:'leetcode',id:'two-sum',url:'https://leetcode.com/problems/two-sum/'};assert.deepEqual(validatedProblem(problem),problem);
 for(const change of [{url:'https://evil.invalid/problems/two-sum/'},{url:'javascript:alert(1)'},{url:'https://user@leetcode.com/problems/two-sum/'},{id:'../escape'},{platform:'unknown'},{url:'https://leetcode.com:8443/problems/two-sum/'}])assert.equal(validatedProblem({...problem,...change}),null);
});
