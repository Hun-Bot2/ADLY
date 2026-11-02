/** Bounded, read-only catalog projection. Statements, tests, vectors and learner rows are never returned. */
const PLATFORMS=new Set(['leetcode','codeforces','atcoder']);
const integer=(value,fallback,max)=>{const n=value===null?fallback:Number(value);if(!Number.isInteger(n)||n<0||n>max)throw Error('invalid catalog pagination');return n;};
const normalized=value=>String(value??'').normalize('NFC').toLowerCase();
export function searchProblems(catalog,params=new URLSearchParams()){
 const query=params.get('query')??'',platform=params.get('platform')??'',difficulty=params.get('difficulty')??'';
 if(query.length>200||platform&&!PLATFORMS.has(platform)||difficulty&&!['1','2','3'].includes(difficulty))throw Error('invalid catalog filters');
 const offset=integer(params.get('offset'),0,1_000_000),limit=integer(params.get('limit'),30,100);if(limit<1)throw Error('invalid catalog limit');
 const terms=normalized(query).split(/\s+/).filter(Boolean);
 const matches=[...catalog.problems.values()].filter(p=>{
  if(platform&&p.platform!==platform)return false;
  if(difficulty&&(p.platform!=='leetcode'||Number(p.difficulty_value)!==Number(difficulty)))return false;
  const text=normalized([p.title,p.key,...p.tags??[],...(p.concepts??[]).map(c=>c.id)].join(' '));return terms.every(t=>text.includes(t));
 }).sort((a,b)=>String(a.title).localeCompare(String(b.title),'en')||String(a.key).localeCompare(String(b.key),'en'));
 const items=matches.slice(offset,offset+limit).map(p=>({key:p.key,title:p.title,platform:p.platform,url:p.url,difficulty_value:p.difficulty_value??null,difficulty_kind:p.difficulty_kind??null,tags:[...(p.tags??[])],concepts:(p.concepts??[]).map(c=>({id:c.id,status:c.status})),eligible:p.eligible===true,access:p.access??'unknown',status:p.status??'unknown'}));
 return {available:true,catalog_version:catalog.version,items,total:matches.length,offset,limit};
}
