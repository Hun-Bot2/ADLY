import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAskpassBroker,promptKind} from '../runtime/askpass.mjs';
const helper=fileURLToPath(new URL('../runtime/askpass-helper.mjs',import.meta.url));
async function ask(prompt,environment){return new Promise((resolve,reject)=>{let output='';const child=spawn(process.execPath,[helper,prompt],{env:{...process.env,...environment},stdio:['ignore','pipe','ignore']});child.stdout.on('data',chunk=>output+=chunk);child.once('error',reject);child.once('exit',code=>resolve({code,output}));});}
test('credential pipe authenticates the session, restricts HTTPS GitHub prompts and erases launcher',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'askpass 한 # % '));t.after(()=>rm(directory,{recursive:true,force:true}));let token='authored-private-token';
 const broker=await createAskpassBroker({store:{get:async()=>token},node:process.execPath,helper,directory});t.after(()=>broker.close());
 assert.equal(promptKind("Password for 'https://github.com.evil.invalid': "),null);assert.equal(promptKind("Password for 'http://github.com': "),null);
 assert.deepEqual(await ask("Username for 'https://github.com': ",broker.environment),{code:0,output:'x-access-token\n'});
 assert.deepEqual(await ask("Password for 'https://x-access-token@github.com': ",broker.environment),{code:0,output:token+'\n'});
 assert.equal((await ask("Password for 'https://evil.invalid': ",broker.environment)).code,1);
 assert.equal((await ask("Password for 'https://github.com': ",{...broker.environment,ALGORITHM_ASKPASS_SECRET:'wrong'})).code,1);
 const script=await readFile(broker.environment.GIT_ASKPASS,'utf8');assert.ok(!script.includes(token));assert.ok(!script.includes(broker.environment.ALGORITHM_ASKPASS_SECRET));
 token=null;assert.equal((await ask("Password for 'https://github.com': ",broker.environment)).code,1);
});
