import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {atomicWrite,readJson} from './paths.mjs';
const key=(repo,path)=>createHash('sha256').update(repo+'\0'+path).digest('hex');
export function saveDraft(appData,repo,path,content){const draft={repo,path,content,updated_at:new Date().toISOString()};atomicWrite(join(appData,'drafts',key(repo,path)+'.json'),JSON.stringify(draft));return draft;}
export function loadDraft(appData,repo,path){return readJson(join(appData,'drafts',key(repo,path)+'.json'));}
