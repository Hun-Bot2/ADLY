import {realpathSync, existsSync, lstatSync, mkdirSync, writeFileSync, renameSync, readFileSync, unlinkSync} from 'node:fs';
import {resolve, relative, isAbsolute, dirname, join, sep} from 'node:path';
import {randomUUID} from 'node:crypto';
export function safePath(root, input, {allowMissing=true}={}) {
  if (typeof input !== 'string' || !input || /[\x00-\x1f\x7f]/.test(input) || input.includes('\\') || isAbsolute(input) || input.split('/').some(s=>s==='..'||s.toLowerCase()==='.git'||/[<>:"|?*]/.test(s)||/[. ]$/.test(s)||/~[0-9]/.test(s)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)) || /^[a-z]:/i.test(input)) throw new Error('invalid relative path');
  const base=realpathSync(root), target=resolve(base,input), rel=relative(base,target);
  if (!rel || rel==='..' || rel.startsWith('..'+sep) || isAbsolute(rel)) throw new Error('path escapes repository');
  let current=base;
  for (const segment of rel.split(sep)) {current=join(current,segment); let info; try {info=lstatSync(current);} catch(e) {if(e.code!=='ENOENT')throw e;} if(info?.isSymbolicLink())throw new Error('symlink paths are not allowed');if(!info&&!allowMissing)throw new Error('path does not exist');}
  return target;
}
export function atomicWrite(path, content) { mkdirSync(dirname(path),{recursive:true}); const tmp=path+'.'+randomUUID()+'.tmp'; try{writeFileSync(tmp,content,{flag:'wx',mode:0o600});renameSync(tmp,path);}finally{if(existsSync(tmp))unlinkSync(tmp);} }
export function readJson(path, fallback=null) {return existsSync(path)?JSON.parse(readFileSync(path,'utf8')):fallback;}
export function appDataRoot({platform=process.platform,env=process.env,home=env.HOME}={}) {
 if(platform==='darwin' && home) return join(home,'Library','Application Support','AlgorithmMastery');
 if(platform==='win32' && env.APPDATA) return join(env.APPDATA,'AlgorithmMastery');
 throw new Error('unsupported app-data platform or missing home directory');
}
