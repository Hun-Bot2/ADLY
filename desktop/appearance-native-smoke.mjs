/** Native appearance command round-trip, disposable app data, no pixel/contrast claim. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const args=process.argv.slice(2),binary=resolve(args[args.indexOf('--binary')+1]),temp=await mkdtemp(join(tmpdir(),'mastery-native-appearance-')),cases=[];
for(const mode of ['light','dark','system']){
 const appData=join(temp,mode);await mkdir(appData);await writeFile(join(appData,'state.json'),JSON.stringify({repositories:[],appearance:mode}));
 const child=spawn(binary,[],{env:{...process.env,DESKTOP_APP_DATA:appData,DESKTOP_SPIKE_SMOKE:'1',DESKTOP_SPIKE_HOLD_MS:'2500'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);
 const code=await new Promise((yes,no)=>{const timer=setTimeout(()=>{child.kill();no(Error('native appearance timeout'));},20000);child.once('error',e=>{clearTimeout(timer);no(e);});child.once('exit',code=>{clearTimeout(timer);yes(code);});});assert.equal(code,0,stderr.slice(-600));
 const events=stdout.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});assert.ok(events.some(e=>e.type==='shell-ready'));assert.ok(events.some(e=>e.type==='ui-smoke'&&e.title==='ALDY — Algorithm Daily'),'native WebView did not report ALDY title');const result=events.find(e=>e.type==='appearance-applied'&&e.mode===mode);assert.ok(result,'no native appearance round-trip for '+mode);if(mode!=='system')assert.equal(result.dark,mode==='dark');cases.push({mode,exit_code:code,native_applied:true,dark:result.dark});
}
console.log(JSON.stringify({synthetic:true,cases,limitations:['Native API round-trip, not screenshot or contrast verification','macOS only']},null,2));
