// Git invokes this helper; it prints only the requested credential to stdout.
import {connect} from 'node:net';
const pipe=process.env.ALGORITHM_ASKPASS_PIPE,secret=process.env.ALGORITHM_ASKPASS_SECRET,prompt=process.argv[2];
if(!pipe||!secret||!prompt)process.exit(1);
const socket=connect(pipe);let buffer='';
const fail=()=>{socket.destroy();process.exitCode=1;};
socket.setTimeout(5000,fail);socket.once('error',fail);
socket.once('connect',()=>socket.write(JSON.stringify({secret,prompt})+'\n'));
socket.on('data',chunk=>{buffer+=chunk;if(buffer.length>16384){fail();return;}if(!buffer.includes('\n'))return;try{const response=JSON.parse(buffer.slice(0,buffer.indexOf('\n')));if(typeof response.value!=='string'||/[\r\n]/.test(response.value))throw Error();process.stdout.write(response.value+'\n');socket.end();}catch{fail();}});
