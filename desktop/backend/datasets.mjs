/** Copy only reviewed database+receipt pairs, never an entire private directory. */
import {existsSync,readdirSync,readFileSync,mkdirSync,copyFileSync,renameSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export function availableCatalogs(root){return existsSync(root)?readdirSync(root).filter(n=>/^catalog-v[1-9]\d*$/.test(n)).sort((a,b)=>Number(b.slice(9))-Number(a.slice(9))):[];}
export function installDatasets(source,target){
 mkdirSync(target,{recursive:true,mode:0o700});
 const installed=[];
 for(const version of readdirSync(source).filter(n=>/^(catalog|company)-v[1-9]\d*$/.test(n)).sort()){
  const directory=join(source,version),receipt=JSON.parse(readFileSync(join(directory,'receipt.json'),'utf8')),name=version+'.sqlite3',file=join(directory,name);
  if(receipt.version!==version||hash(file)!==receipt.output_sha256)throw Error('dataset receipt mismatch');
  const destination=join(target,version);
  if(existsSync(destination)){if(hash(join(destination,name))!==receipt.output_sha256)throw Error('installed dataset differs; refusing overwrite');installed.push(version);continue;}
  const temp=join(target,'.dataset-'+randomUUID());mkdirSync(temp,{mode:0o700});
  try{copyFileSync(file,join(temp,name));copyFileSync(join(directory,'receipt.json'),join(temp,'receipt.json'));if(hash(join(temp,name))!==receipt.output_sha256)throw Error('dataset changed during copy');renameSync(temp,destination);}catch(e){rmSync(temp,{recursive:true,force:true});throw e;}installed.push(version);
 }
 return installed;
}
