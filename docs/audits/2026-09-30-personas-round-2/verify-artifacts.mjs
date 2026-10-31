import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const before=await read('source-before.json'),after=await read('source-after.json');
if(JSON.stringify(before.artifacts)!==JSON.stringify(after.artifacts))throw Error('App source changed during audit');
const log=await read('friction-log.json');
if(log.records.length!==19)throw Error('Unexpected canonical findings count');
for(const r of log.records){
 if(!r.observed||!r.evidence.length)throw Error(`Missing observation/evidence for ${r.id}`);
 for(const p of r.evidence)await fs.access(path.join(root,p));
}
const common=await read('evidence/persona-walkthroughs.json');
if(common.length!==5||common.some(r=>!r.completed||r.pageErrors.length||r.consoleErrors.length))throw Error('Common persona journey incomplete/errors');
if(common.reduce((n,r)=>n+r.steps.length,0)!==177)throw Error('Unexpected checkpoint count');
const fixtures=await read('evidence/capture-fixtures.json');
if(fixtures.stats.expected!==16||fixtures.stats.unexpected||fixtures.stats.skipped||fixtures.stats.flaky)throw Error('Focused fixtures not fully passing');
const brokenLinks=[];
for(const rel of ['report.md','friction-log.md','verification.md','shared/report.md','kitchen/report.md','native/report.md']){
 const file=path.join(root,rel),content=await fs.readFile(file,'utf8');
 for(const match of content.matchAll(/\]\(([^)]+)\)/g)){
  let target=match[1];if(/^(https?:|mailto:|#)/.test(target))continue;
  target=target.replace(/#.*$/,'').replace(/:\d+$/,'');
  try{await fs.access(path.isAbsolute(target)?target:path.resolve(path.dirname(file),target));}catch{brokenLinks.push({file:rel,target});}
 }
}
if(brokenLinks.length)throw Error(JSON.stringify(brokenLinks));
const artifacts=[];
async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isDirectory())await walk(full);else if(!['artifact-manifest.json','verification-summary.json'].includes(item.name)){const bytes=await fs.readFile(full);artifacts.push({path:path.relative(root,full).replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}}}
await walk(root);artifacts.sort((a,b)=>a.path.localeCompare(b.path));
await fs.writeFile(path.join(root,'artifact-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),artifacts},null,2));
const summary={checkedAt:new Date().toISOString(),sourceUnchanged:true,sourceFiles:before.artifacts.length,simulatedPersonas:5,commonCheckpoints:177,commonPageErrors:0,commonConsoleErrors:0,focusedFixturePasses:16,counts:log.counts,linkedEvidenceExists:true,reportLinksValid:true,artifactFiles:artifacts.length,limitations:'Simulated personas; physical devices/live auth/hosted release/human wishes unverified. This script validates evidence consistency, not product correctness.'};
await fs.writeFile(path.join(root,'verification-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
