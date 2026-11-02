/** Explicit first-run copy; never opens the source with migrations or modifies it. */
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,realpathSync,unlinkSync,linkSync,chmodSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function copyLearnerData({source,appData,confirmed=false}){
 if(confirmed!==true)throw Error('explicit copy confirmation required');
 const target=join(resolve(appData),'learner.sqlite3');
 if(existsSync(target))throw Error('destination learner database already exists');
 const input=realpathSync(source);mkdirSync(appData,{recursive:true,mode:0o700});
 const temporary=join(resolve(appData),'.learner-import-'+randomUUID()+'.sqlite3');const db=new DatabaseSync(input,{readOnly:true});
 try{
  const names=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
  if(!names.has('learners')||!names.has('events'))throw Error('not a learner database');
  db.prepare('VACUUM INTO ?').run(temporary);chmodSync(temporary,0o600);linkSync(temporary,target);
 }finally{db.close();if(existsSync(temporary))unlinkSync(temporary);}
 return {copied:true,destination:target,source_unchanged:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];if(!args.includes('--source')||!args.includes('--app-data'))throw Error('usage: node desktop/import.mjs --source <db> --app-data <new folder> --confirm');console.log(JSON.stringify(copyLearnerData({source:arg('--source'),appData:arg('--app-data'),confirmed:args.includes('--confirm')})));}
