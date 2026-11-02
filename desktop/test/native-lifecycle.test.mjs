import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {launchPrototype} from '../runtime/launcher.mjs';
const bootstrap=fileURLToPath(new URL('../runtime/bootstrap.mjs',import.meta.url));
const launcher=new URL('../runtime/launcher.mjs',import.meta.url).href;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'DA0 한 # % '));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'desktop'));mkdirSync(join(root,'data'));
 writeFileSync(join(root,'desktop/dev.mjs'),`import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';import {join} from 'node:path';import {once} from 'node:events';export async function startDesktop({appData}){const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});writeFileSync(join(appData,'descendant.pid'),String(child.pid));return {url:'http://127.0.0.1:12345',async close(){const done=once(child,'exit');child.kill();await done;}};}`);
 return {root,appData:join(root,'data')};
}
function alive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
async function gone(pid){for(let i=0;i<100&&alive(pid);i++)await delay(30);assert.equal(alive(pid),false,'owned process survives shutdown: '+pid);}
test('shared Node bootstrap cleans its descendants on orderly quit and restart',async t=>{
 const paths=fixture(t);
 for(let attempt=0;attempt<2;attempt++){
  const running=launchPrototype({node:process.execPath,bootstrap,...paths});t.after(()=>running.stop());
  const ready=await running.connection;assert.equal(ready.node,'26.8.1');assert.equal(ready.sqlite,true);
  const descendant=Number(readFileSync(join(paths.appData,'descendant.pid'),'utf8'));assert.ok(alive(descendant));
  await running.stop();await gone(descendant);await gone(ready.pid);
 }
});
test('native parent abrupt termination closes stdin and cleans the workload',async t=>{
 const paths=fixture(t),script=join(paths.root,'native-parent.mjs');
 writeFileSync(script,`import {launchPrototype} from ${JSON.stringify(launcher)};const running=launchPrototype(${JSON.stringify({node:process.execPath,bootstrap,...paths})});console.log(JSON.stringify(await running.connection));process.stdin.resume();`);
 const parent=spawn(process.execPath,[script],{stdio:['pipe','pipe','pipe']});parent.stderr.resume();
 t.after(()=>{if(parent.exitCode===null)parent.kill();});
 let text='';const ready=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('native fixture timeout')),10000);parent.stdout.on('data',chunk=>{text+=chunk;if(text.includes('\n')){clearTimeout(timeout);resolve(JSON.parse(text.trim()));}});parent.once('error',reject);});
 const descendant=Number(readFileSync(join(paths.appData,'descendant.pid'),'utf8'));
 const stopped=once(parent,'exit');parent.kill('SIGKILL');await stopped;await gone(ready.pid);await gone(descendant);
});
test('launcher rejects missing paths and startup errors without an orphan',async()=>{
 assert.throws(()=>launchPrototype({}),/paths/);
 const running=launchPrototype({node:process.execPath,bootstrap:'/does-not-exist.mjs',root:tmpdir(),appData:tmpdir()});
 await assert.rejects(running.connection,/before ready/);await running.stop();
});

test('startup diagnostics classify missing runtime libraries without echoing arbitrary stderr',async t=>{
 const paths=fixture(t),script=join(paths.root,'failure.mjs');
 writeFileSync(script,"console.error('private-authored-secret');console.error('Library not loaded: @rpath/libnode.147.dylib');process.exit(1);");
 const running=launchPrototype({node:process.execPath,bootstrap:script,...paths});
 await assert.rejects(running.connection,error=>error.message.includes('native runtime missing library libnode.147.dylib')&&!error.message.includes('private-authored-secret'));await running.stop();
});
