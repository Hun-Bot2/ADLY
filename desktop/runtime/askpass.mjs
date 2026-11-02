// Main-process credential pipe; the adapter inherits only a random session capability.
import {createServer} from 'node:net';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,chmod,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export function promptKind(prompt){
 if(typeof prompt!=='string'||prompt.length>4096)return null;
 const match=/^(Username|Password) for '(https:\/\/[^']+)':\s*$/i.exec(prompt);if(!match)return null;
 try{const url=new URL(match[2]);if(url.protocol!=='https:'||url.host!=='github.com'||url.password)return null;}catch{return null;}
 return match[1].toLowerCase();
}
const shellQuote=value=>"'"+value.replaceAll("'","'\\''")+"'";
export async function createAskpassBroker({store,node,helper,directory}){
 if(!store?.get||!node||!helper||!directory)throw Error('credential broker configuration required');
 const id=randomBytes(16).toString('hex'),secret=randomBytes(32).toString('hex');
 const pipe=process.platform==='win32'?`\\\\.\\pipe\\algorithm-mastery-${id}`:join(tmpdir(),'algorithm-askpass-'+id+'.sock');
 const sockets=new Set();
 const server=createServer(socket=>{
  sockets.add(socket);socket.setTimeout(5000,()=>socket.destroy());socket.once('close',()=>sockets.delete(socket));let data='',handled=false;
  socket.on('data',async chunk=>{
   if(handled)return;data+=chunk;if(data.length>8192){socket.destroy();return;}if(!data.includes('\n'))return;handled=true;
   try{const request=JSON.parse(data.slice(0,data.indexOf('\n'))),received=Buffer.from(String(request.secret??'')),expected=Buffer.from(secret);
    if(received.length!==expected.length||!timingSafeEqual(received,expected))throw Error('denied');
    const kind=promptKind(request.prompt);if(!kind)throw Error('denied');const token=await store.get('github');if(!token)throw Error('signed out');
    socket.end(JSON.stringify({value:kind==='username'?'x-access-token':token})+'\n');
   }catch{socket.end(JSON.stringify({error:'credential unavailable'})+'\n');}
  });
 });
 await new Promise((resolve,reject)=>server.once('error',reject).listen(pipe,resolve));
 if(process.platform!=='win32')await chmod(pipe,0o600);
 await mkdir(directory,{recursive:true,mode:0o700});const launcher=join(directory,'git-askpass'+(process.platform==='win32'?'.cmd':'.sh'));
 const escaped=value=>value.replaceAll('%','%%');
 const script=process.platform==='win32'?`@echo off\r\nsetlocal DisableDelayedExpansion\r\n"${escaped(node)}" "${escaped(helper)}" %*\r\n`:`#!/bin/sh\nexec ${shellQuote(node)} ${shellQuote(helper)} "$@"\n`;
 await writeFile(launcher,script,{mode:0o700});
 return {environment:{GIT_ASKPASS:launcher,GIT_ASKPASS_REQUIRE:'force',ALGORITHM_ASKPASS_PIPE:pipe,ALGORITHM_ASKPASS_SECRET:secret},async close(){for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));if(process.platform!=='win32')await rm(pipe,{force:true});await rm(launcher,{force:true});}};
}
