/** Offline publisher tool: writes a signed manifest, never uploads an artifact or a key. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,createPrivateKey,sign,createPublicKey} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonicalManifest,createUpdater} from './backend/updates.mjs';
export function signUpdate({artifact,version,platform,arch,url,privateKey,output}){
 const key=createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 publisher key required');
 const bytes=readFileSync(artifact),manifest={schema:1,version,platform,arch,url,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
 const envelope={manifest,signature:sign(null,Buffer.from(canonicalManifest(manifest)),key).toString('base64')};
 createUpdater({publicKey:createPublicKey(key).export({type:'spki',format:'pem'}),allowedOrigins:[new URL(url).origin],currentVersion:'0.0.0',appData:'.',platform,arch}).verify(envelope);
 writeFileSync(output,JSON.stringify(envelope,null,2)+'\n',{flag:'wx',mode:0o644});return envelope;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2),input={};for(let i=0;i<args.length;i+=2){const name=args[i];if(!['--artifact','--version','--platform','--arch','--url','--private-key','--output'].includes(name)||!args[i+1])throw Error('expected artifact, version, platform, arch, url, private-key and output flags');input[name.slice(2).replace('-key','Key')]=args[i+1];}if(Object.keys(input).length!==7)throw Error('all publisher flags required');input.privateKey=readFileSync(input.privateKey,'utf8');const result=signUpdate(input);console.log(JSON.stringify({version:result.manifest.version,sha256:result.manifest.sha256,size:result.manifest.size,output:input.output}));}
