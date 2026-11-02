import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateAnalytics,confirmedTimerSummary,recordedSeconds,difficultyLabel} from '../public/analytics-data.mjs';
const attempt=(id,extra={})=>({id,layer:'actual',date:'2026-10-29',problem_key:'leetcode:authored',platform:'leetcode',difficulty:'Easy',outcome:'independent',...extra});
test('analytics excludes plans/corrections and distinguishes unique problems, attempts and unknown outcomes',()=>{
 const data=aggregateAnalytics([attempt('a',{self_seconds:40,pattern:'arrays-hashing,two-pointers'}),attempt('b',{outcome:'failed',self_minutes:2,pattern:'arrays-hashing'}),attempt('old',{status:'superseded',self_minutes:100}),attempt('u',{problem_key:'atcoder:authored',platform:'atcoder',difficulty:400,outcome:'unknown'}),attempt('p',{layer:'plan'})]);
 assert.equal(data.rows.length,3);assert.equal(data.solvedProblems,1);assert.equal(data.attemptedProblems,2);assert.equal(data.successRate,.5);assert.equal(data.successDenominator,2);assert.equal(data.unknown,1);assert.equal(data.recordedSeconds,160);assert.equal(data.durationMissing,1);assert.equal(data.repeated[0].count,2);assert.equal(data.topics[0].count,2);assert.equal(data.missingTopics,1);
});
test('period/platform and native difficulty remain distinct; absent time is not zero',()=>{
 const data=aggregateAnalytics([attempt('a'),attempt('b',{date:'2026-09-01'}),attempt('c',{platform:'atcoder',difficulty:1})],{period:'2026-10',platform:'leetcode'});
 assert.equal(data.rows.length,1);assert.equal(data.recordedSeconds,null);assert.equal(recordedSeconds({self_minutes:0}),0);assert.equal(recordedSeconds({confirmed_seconds:500}),null);assert.equal(difficultyLabel({platform:'atcoder',difficulty:1}),'AtCoder · 1');assert.equal(difficultyLabel({platform:'leetcode',difficulty:1}),'LeetCode · Easy');
});
test('confirmed timer durations are unioned and clipped, without manual time or open interval inference',()=>{
 const result=confirmedTimerSummary([{status:'confirmed',problem_key:'leetcode:a',confirmed_start:'2026-10-28T15:00:00Z',confirmed_end:'2026-10-28T15:10:00Z'},{status:'confirmed',problem_key:'leetcode:b',confirmed_start:'2026-10-28T15:05:00Z',confirmed_end:'2026-10-28T15:15:00Z'},{status:'open',problem_key:'leetcode:c',started_at:'2026-10-28T15:00:00Z'},{status:'confirmed',problem_key:'atcoder:a',confirmed_start:'2026-10-28T15:00:00Z',confirmed_end:'2026-10-28T16:00:00Z'}],{period:'2026-10',platform:'leetcode'});
 assert.deepEqual(result,{seconds:900,intervals:2,unavailable:1});assert.equal(confirmedTimerSummary([]).seconds,null);
});
test('unknown-only outcomes have no success-rate denominator and repeated identical topic labels count once',()=>{
 const data=aggregateAnalytics([attempt('u',{outcome:'unknown',pattern:'tree,tree'})]);assert.equal(data.successRate,null);assert.equal(data.topics[0].count,1);
});
test('timer month range uses Korean civil month boundaries rather than UTC day rollover',()=>{
 const result=confirmedTimerSummary([{status:'confirmed',problem_key:'leetcode:a',confirmed_start:'2026-10-31T14:50:00Z',confirmed_end:'2026-10-31T15:10:00Z'}],{period:'2026-10'});
 assert.equal(result.seconds,600);
});
