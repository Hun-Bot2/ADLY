import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {nativeCredentialReader} from '../runtime/native-store-reader.mjs';
function spawnFixture(text,code=0){return (executable,args,options)=>{assert.equal(executable,'native-fixture');assert.deepEqual(args,['--credential-read']);assert.deepEqual(options.stdio,['ignore','pipe','ignore']);const child=new EventEmitter();child.stdout=new PassThrough();child.kill=()=>{};queueMicrotask(()=>{child.stdout.write(text);child.emit('exit',code);});return child;};}
test('read-only native store bridge keeps credentials in a bounded pipe and handles absence',async()=>{
 assert.equal(await nativeCredentialReader('native-fixture',{spawnFn:spawnFixture('authored-token\n')}).get('github'),'authored-token');
 assert.equal(await nativeCredentialReader('native-fixture',{spawnFn:spawnFixture('',1)}).get('github'),null);
 await assert.rejects(nativeCredentialReader('native-fixture',{spawnFn:spawnFixture('line\nextra\n')}).get('github'),/invalid/);
 await assert.rejects(nativeCredentialReader('native-fixture',{spawnFn:spawnFixture('a'.repeat(20000))}).get('github'),/unavailable/);
 await assert.rejects(nativeCredentialReader('native-fixture',{spawnFn:spawnFixture('token')}).get('other'),/unsupported/);
});
