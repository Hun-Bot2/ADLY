/** Stage an allowlisted DA-0 prototype; never a repository-root archive. */
import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,lstatSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {join,resolve,relative,basename,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const ROOT=fileURLToPath(new URL('..',import.meta.url));
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const DIRECTORIES=['hosted/core','hosted/mastery','hosted/runtime','hosted/migrations','hosted/generated','hosted/public','desktop/backend'];
const FILES=['hosted/package.json','hosted/local.mjs','hosted/local-problems.mjs','hosted/local-desktop.mjs','hosted/local-contest-sync.mjs','hosted/local-library.mjs','hosted/local-comparison.mjs','hosted/backup.mjs','hosted/contest-discovery.mjs','hosted/contest-history.mjs','hosted/dispatcher.mjs','hosted/notifications.mjs','hosted/operations.mjs','hosted/provider-service.mjs','hosted/providers.mjs','hosted/scheduler.mjs','desktop/dev.mjs','desktop/import.mjs','desktop/runtime/askpass.mjs','desktop/ui/index.html','desktop/ui/style.css','desktop/ui/editor-bundle.js'];
function files(root){return readdirSync(root,{withFileTypes:true}).flatMap(e=>{const p=join(root,e.name);if(e.isSymbolicLink())throw Error('symlink in staged resources');return e.isDirectory()?files(p):[p];});}
export function stagePrototype({output,root=ROOT,nodeBinary=process.env.DESKTOP_NODE_BINARY??process.execPath,datasets=[]}={}){
 if(!output)throw Error('output required');output=resolve(output);if(existsSync(output))throw Error('staging output already exists');
 const runtime=JSON.parse(execFileSync(nodeBinary,['-p',"JSON.stringify({version:process.versions.node,platform:process.platform,arch:process.arch})"],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));if(runtime.version!=='26.8.1'||runtime.platform!==process.platform||runtime.arch!==process.arch)throw Error('DA-0 needs matching-platform Node 26.8.1');
 if(process.platform==='darwin'){const dependencies=execFileSync('otool',['-L',nodeBinary],{encoding:'utf8'});if(/@rpath\/libnode|\/opt\/homebrew\/|\/usr\/local\//.test(dependencies))throw Error('Node runtime has external non-system libraries; use --node-binary with a verified official standalone Node release');}
 const copied=[];
 const copy=(source,dest)=>{if(lstatSync(source).isSymbolicLink())throw Error('symlink source');mkdirSync(resolve(dest,'..'),{recursive:true});cpSync(source,dest,{recursive:false,errorOnExist:true,force:false});copied.push(dest);};
 mkdirSync(output,{recursive:true});mkdirSync(join(output,'datasets'));
 try{
  const prototype=join(output,'prototype');
  for(const file of FILES)copy(join(root,file),join(prototype,file));
  for(const dir of DIRECTORIES)for(const file of files(join(root,dir))){if(basename(file)==='README.md')continue;if(!/\.(mjs|json|sql|html|css|woff2|txt)$/.test(file))throw Error('unexpected source extension: '+file);copy(file,join(prototype,relative(root,file)));}
  copy(nodeBinary,join(output,'runtime',process.platform==='win32'?'node.exe':'node'));const license=[join(dirname(nodeBinary),'LICENSE'),join(dirname(nodeBinary),'../LICENSE')].find(existsSync);if(!license)throw Error('Node runtime license is required');copy(license,join(output,'runtime/NODE-LICENSE.txt'));if(process.platform!=='win32')chmodSync(join(output,'runtime/node'),0o755);
  const nativeHelper=join(root,'desktop/native-runner/target/release',process.platform==='win32'?'mastery-native-runner.exe':'mastery-native-runner');if(existsSync(nativeHelper))copy(nativeHelper,join(output,'runtime',basename(nativeHelper)));if(process.platform==='win32'&&!existsSync(nativeHelper))throw Error('Windows package needs built native Job Object runner');
  for(const dataset of datasets){
   const receipt=JSON.parse(readFileSync(join(dataset,'receipt.json'),'utf8')),version=receipt.version;
   if(!/^(catalog|company)-v[1-9]\d*$/.test(version))throw Error('invalid dataset version');
   const database=join(dataset,version+'.sqlite3');if(digest(database)!==receipt.output_sha256)throw Error('dataset hash mismatch');
   for(const name of [version+'.sqlite3','receipt.json'])copy(join(dataset,name),join(output,'datasets',version,name));
  }
  const manifest={kind:'da-0-prototype',node_version:runtime.version,node_platform:runtime.platform,node_arch:runtime.arch,datasets:datasets.length,files:copied.map(p=>({path:relative(output,p).split('\\').join('/'),sha256:digest(p)}))};
  writeFileSync(join(output,'bundle-manifest.json'),JSON.stringify(manifest,null,2)+'\n');verifyStage(output);return manifest;
 }catch(e){rmSync(output,{recursive:true,force:true});throw e;}
}
export function verifyStage(output){const manifest=JSON.parse(readFileSync(join(output,'bundle-manifest.json'),'utf8'));for(const row of manifest.files)if(typeof row.path!=='string'||row.path.startsWith('/')||row.path.includes('\\')||row.path.split('/').includes('..'))throw Error('invalid manifest path');const listed=new Set(manifest.files.map(f=>f.path));for(const file of files(output)){const path=relative(output,file).split('\\').join('/');if(path==='bundle-manifest.json')continue;if(!listed.has(path))throw Error('unlisted bundle file: '+path);if(/(^|\/)(private-learning|research|\.git|node_modules)(\/|$)|\.env|\.csv$|hosted\.sqlite/i.test(path))throw Error('forbidden bundle content');const row=manifest.files.find(f=>f.path===path);if(digest(file)!==row.sha256)throw Error('bundle file hash mismatch');}for(const row of manifest.files)if(!existsSync(join(output,row.path)))throw Error('missing bundle file');return {verified:true,files:listed.size};}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2),index=args.indexOf('--output');if(index<0)throw Error('usage: node desktop/package-stage.mjs --output <new directory> [--dataset <private version directory>]');const datasets=args.flatMap((a,i)=>a==='--dataset'?[args[i+1]]:[]);const runtimeIndex=args.indexOf('--node-binary');console.log(JSON.stringify(stagePrototype({output:args[index+1],datasets,...(runtimeIndex>=0?{nodeBinary:args[runtimeIndex+1]}:{})}),null,2));}
