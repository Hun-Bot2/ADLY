export const DEFAULT_LAYOUT=Object.freeze({explorerWidth:218,panelHeight:240,explorerCollapsed:false,panelCollapsed:false,panel:'output'});
const PANELS=new Set(['output','input','tests','record','git']);
export function normalizeLayout(value={}){
 const n=(v,f,min,max)=>Number.isFinite(v)?Math.min(max,Math.max(min,Math.round(v))):f;
 return {explorerWidth:n(value.explorerWidth,218,160,440),panelHeight:n(value.panelHeight,240,160,520),explorerCollapsed:value.explorerCollapsed===true,panelCollapsed:value.panelCollapsed===true,panel:PANELS.has(value.panel)?value.panel:'output'};
}
export function normalizeRoute(route){const aliases={history:'explorer',similarity:'research',library:'research',journal:'dashboard',today:'settings',progress:'analytics'};const id=aliases[route]??route;return ['dashboard','calendar','explorer','analytics','contests','company','research','workspace','settings'].includes(id)?id:'dashboard';}
export function validatedProblem(value){if(!value||!['leetcode','codeforces','atcoder'].includes(value.platform)||typeof value.id!=='string'||!/^[A-Za-z0-9_-]+$/.test(value.id)||typeof value.url!=='string')return null;try{const url=new URL(value.url),hosts={leetcode:'leetcode.com',codeforces:'codeforces.com',atcoder:'atcoder.jp'};if(url.protocol!=='https:'||url.hostname!==hosts[value.platform]||url.username||url.password||url.port)return null;return {platform:value.platform,id:value.id,url:url.href};}catch{return null;}}
