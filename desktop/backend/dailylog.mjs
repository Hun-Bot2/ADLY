import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {safePath,atomicWrite} from './paths.mjs';
import {dailyHeader} from '../../hosted/mastery/daily-log.mjs';
export function prepareDailyLog(repo,{date,folder='leetcode',url,solved,minutes='',review=false,memo=''}) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('invalid date');
 if(!['leetcode','codeforces','atcoder','daily'].includes(folder)||typeof solved!=='boolean'||typeof review!=='boolean')throw new Error('invalid record');
 const link=new URL(url);if(link.protocol!=='https:'||!['leetcode.com','codeforces.com','atcoder.jp'].includes(link.hostname)||/[|\r\n]/.test(url))throw new Error('invalid problem URL');
 if(minutes!==''&&(!Number.isInteger(Number(minutes))||Number(minutes)<0||Number(minutes)>1440))throw new Error('invalid minutes');
 if(/[|\r\n]/.test(memo))throw new Error('memo must be a single table cell');
 const relative=`${folder}/${date.slice(2)}.md`,path=safePath(repo,relative);const prior=existsSync(path)?readFileSync(path,'utf8'):null;
 const newline=prior?.includes('\r\n')?'\r\n':'\n';let content=prior??`# ${date}${newline}${newline}| Problem | Result | Time | Review | Memo |${newline}| --- | --- | --- | --- | --- |${newline}`;
 const row=`| ${url} | ${solved?1:0} | ${minutes===''?'':Number(minutes)+'m'} | ${review?1:0} | ${memo} |`;
 const lines=content.match(/[^\n]*(?:\n|$)/g).filter(Boolean);let header=-1;
 for(let i=0;i<lines.length;i++)if(dailyHeader(lines[i].replace(/\r?\n$/,''))?.length===5){if(header>=0)throw new Error('multiple daily tables');header=i;}
 if(header<0||!/^\|\s*:?-/.test(lines[header+1]??''))throw new Error('daily table not found');
 let end=header+2;while(end<lines.length&&/^\|/.test(lines[end]))end++;
 const offset=lines.slice(0,end).join('').length; const before=content.slice(0,offset),after=content.slice(offset);content=before+(before.endsWith('\n')?'':newline)+row+newline+after;
 return {relative,content,row};
}

export function appendDailyLog(repo,input){const result=prepareDailyLog(repo,input);atomicWrite(safePath(repo,result.relative),result.content);return result;}

// Code Workspace helpers for the user's own daily logs (specs/desktop-app/new-user-workspace.md NW-7..NW-8).
// They only edit text the user would type; an empty result cell creates no attempt.
const FOLDERS=['leetcode','codeforces','atcoder','daily'];
function dailyTarget(repo,{date,folder}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('invalid date');
 if(!FOLDERS.includes(folder))throw new Error('invalid folder');
 const relative=`${folder}/${date.slice(2)}.md`;return {relative,path:safePath(repo,relative)};
}
function dailyTemplate(repo,date){
 const fallback=`# ${date}\n\n| Problem | Result | Time | Review | Memo |\n| --- | --- | --- | --- | --- |\n`;
 try{const template=readFileSync(safePath(repo,'templates/daily.md',{allowMissing:false}),'utf8');if(template.split(/\r?\n/).some(dailyHeader))return template.replaceAll('YYYY-MM-DD',date);}catch{}
 return fallback;
}
export function openDailyLog(repo,input){
 const {relative,path}=dailyTarget(repo,input);
 if(existsSync(path))return {relative,content:readFileSync(path,'utf8'),created:false};
 const content=dailyTemplate(repo,input.date);mkdirSync(dirname(path),{recursive:true});
 try{writeFileSync(path,content,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;return {relative,content:readFileSync(path,'utf8'),created:false};}
 return {relative,content,created:true};
}
const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim());
export function addProblemToDaily(repo,{date,folder,url,title,language='python'}){
 const link=new URL(url);if(link.protocol!=='https:'||!['leetcode.com','codeforces.com','atcoder.jp'].includes(link.hostname)||link.username||link.password||/[|\r\n\s]/.test(url))throw new Error('invalid problem URL');
 if(!['python','cpp'].includes(language))throw new Error('invalid language');
 const heading=String(title??'').replace(/[\r\n|]/g,' ').trim().slice(0,200)||link.pathname.split('/').filter(Boolean).at(-1)||url;
 const opened=openDailyLog(repo,{date,folder}),{path}=dailyTarget(repo,{date,folder});
 const newline=opened.content.includes('\r\n')?'\r\n':'\n';let lines=opened.content.split(/\r?\n/);
 const header=lines.findIndex(line=>dailyHeader(line));
 if(header<0||!/^\|\s*:?-/.test(lines[header+1]??''))throw new Error('daily table not found');
 let end=header+2;while(end<lines.length&&/^\|/.test(lines[end]))end++;
 const inTable=lines.slice(header+2,end).some(line=>cells(line)[0]?.includes(url));
 if(!inTable){const names=dailyHeader(lines[header]),row='| '+names.map(name=>name==='문제'?url:name==='복습'?'0':'').join(' | ')+' |';lines.splice(end,0,row.replace(/ {2,}\|/g,' |'));}
 const fence=language==='python'?'python':'cpp';
 let start=lines.findIndex((line,i)=>/^##\s+/.test(line)&&lines.slice(i,i+4).some(next=>next.includes(url)));
 if(start<0){while(lines.length&&lines.at(-1)==='')lines.pop();lines.push('',`## ${heading}`,'',url,'','```'+fence,'','```','');start=lines.length-8;}
 const block=lines.findIndex((line,i)=>i>start&&/^```\w/.test(line));
 const content=lines.join(newline);atomicWrite(path,content);
 return {relative:opened.relative,content,line:block>=0?block+2:start+1,added:!inTable};
}
