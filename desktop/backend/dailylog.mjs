import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {safePath,atomicWrite} from './paths.mjs';
export function prepareDailyLog(repo,{date,folder='leetcode',url,solved,minutes='',review=false,memo=''}) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('invalid date');
 if(!['leetcode','codeforces','atcoder','daily'].includes(folder)||typeof solved!=='boolean'||typeof review!=='boolean')throw new Error('invalid record');
 const link=new URL(url);if(link.protocol!=='https:'||!['leetcode.com','codeforces.com','atcoder.jp'].includes(link.hostname)||/[|\r\n]/.test(url))throw new Error('invalid problem URL');
 if(minutes!==''&&(!Number.isInteger(Number(minutes))||Number(minutes)<0||Number(minutes)>1440))throw new Error('invalid minutes');
 if(/[|\r\n]/.test(memo))throw new Error('memo must be a single table cell');
 const relative=`${folder}/${date.slice(2)}.md`,path=safePath(repo,relative);const prior=existsSync(path)?readFileSync(path,'utf8'):null;
 const newline=prior?.includes('\r\n')?'\r\n':'\n';let content=prior??`# ${date}${newline}${newline}| 문제 | 결과 | 시간 | 복습 | 메모 |${newline}| --- | --- | --- | --- | --- |${newline}`;
 const row=`| ${url} | ${solved?1:0} | ${minutes===''?'':Number(minutes)+'m'} | ${review?1:0} | ${memo} |`;
 const lines=content.match(/[^\n]*(?:\n|$)/g).filter(Boolean);let header=-1;
 for(let i=0;i<lines.length;i++)if(/^\|\s*문제\s*\|\s*결과\s*\|\s*시간\s*\|\s*복습\s*\|\s*메모\s*\|/.test(lines[i])){if(header>=0)throw new Error('multiple daily tables');header=i;}
 if(header<0||!/^\|\s*:?-/.test(lines[header+1]??''))throw new Error('daily table not found');
 let end=header+2;while(end<lines.length&&/^\|/.test(lines[end]))end++;
 const offset=lines.slice(0,end).join('').length; const before=content.slice(0,offset),after=content.slice(offset);content=before+(before.endsWith('\n')?'':newline)+row+newline+after;
 return {relative,content,row};
}

export function appendDailyLog(repo,input){const result=prepareDailyLog(repo,input);atomicWrite(safePath(repo,result.relative),result.content);return result;}
