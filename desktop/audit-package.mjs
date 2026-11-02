/** Verify installed candidate resources, including the staged data hash receipts. */
import {readFileSync,readdirSync,lstatSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const ROOT=fileURLToPath(new URL('..',import.meta.url));
function auditTree(path){let files=0,bytes=0;for(const entry of readdirSync(path,{withFileTypes:true})){if(/^(private-learning|research|\.git|node_modules)$|\.env|\.csv$|hosted\.sqlite|learner\.sqlite/i.test(entry.name))throw Error('forbidden resource content');const target=join(path,entry.name),info=lstatSync(target);if(info.isSymbolicLink())throw Error('unexpected resource symlink');if(info.isDirectory()){const child=auditTree(target);files+=child.files;bytes+=child.bytes;}else{files++;bytes+=info.size;}}return {files,bytes};}
export function auditPackage({resources,stage,root=ROOT}){
 const manifest=JSON.parse(readFileSync(join(stage,'bundle-manifest.json'),'utf8'));
 if(existsSync(join(resources,'app.asar')))throw Error('unexpected legacy shell archive in Tauri resources');
 for(const row of manifest.files){if(row.path.startsWith('/')||row.path.split('/').includes('..')||row.path.includes('\\'))throw Error('invalid manifest path');const target=join(resources,row.path.replace(/^runtime\//,'runtime-node/'));if(hash(target)!==row.sha256)throw Error('packaged resource hash mismatch: '+row.path);}
 for(const name of ['bootstrap.mjs','askpass-helper.mjs','native-store-reader.mjs']){const target=join(resources,'runtime',name);if(hash(target)!==hash(join(root,'desktop/runtime',name)))throw Error('packaged bootstrap differs from source');}
 let files=0,bytes=0;for(const directory of ['prototype','datasets','runtime-node','runtime']){if(!existsSync(join(resources,directory)))throw Error('missing resource directory');const audited=auditTree(join(resources,directory));files+=audited.files;bytes+=audited.bytes;}
 return {verified:true,resource_files:files,resource_bytes:bytes,forbidden_data_present:false,scope:'candidate resource directories; native framework binaries are outside this content audit'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];if(!args.includes('--resources')||!args.includes('--stage'))throw Error('usage: --resources <app resources> --stage <staged source>');console.log(JSON.stringify(auditPackage({resources:arg('--resources'),stage:arg('--stage')}),null,2));}
