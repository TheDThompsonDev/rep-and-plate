import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const directory=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(directory,'../../..');
const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8').replace(/^\uFEFF/,''));
const checks=[];
function check(criterion,passed,evidence){checks.push({criterion,result:passed?'passed':'failed',evidence});}
const report=fs.readFileSync(path.join(directory,'README.md'),'utf8');
const findings=JSON.parse(fs.readFileSync(path.join(directory,'../2026-09-30-personas/friction-log.json'),'utf8')).records;
const mapped=[...report.matchAll(/^\| (F\d+) \|/gm)].map(match=>match[1]);
check('Every original finding has exactly one acceptance-map row',findings.length===31&&mapped.length===31&&findings.every(f=>mapped.filter(id=>id===f.id).length===1),`${findings.length} original findings; ${mapped.length} implementation rows`);
for(const [name,count] of [['evidence/web-final.json',266],['native-suite.json',23]]){
 const {stats}=read(name);
 check(`${name} completed without failure, skip or flake`,stats.expected===count&&stats.unexpected===0&&stats.skipped===0&&stats.flaky===0,stats);
}
const personas=read('evidence/persona-walkthroughs.json');
check('Five persona walkthroughs completed without page errors',personas.length===5&&personas.every(p=>p.completed&&p.pageErrors.length===0),`${personas.reduce((sum,p)=>sum+p.steps.length,0)} retained checkpoints`);
const serverLog=fs.readFileSync(path.join(directory,'evidence/vite-final.log'),'utf8');
check('Final server output has no React render-loop diagnostic',!/(Maximum update depth|Too many re-renders)/i.test(serverLog),'Server output drained after source freeze, then collected after the final complete browser run; legacy planner regression additionally asserts no console/page errors.');
let broken=[];
for(const name of ['README.md','verification.md','shared.md','kitchen.md','native.md']){
 const source=fs.readFileSync(path.join(directory,name),'utf8');
 for(const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
  const target=match[1].replace(/#.*$/,'');
  if(!target||/^(https?:|mailto:)/.test(target))continue;
  if(!fs.existsSync(path.resolve(directory,target)))broken.push({name,target});
 }
}
check('All report links resolve locally',broken.length===0,broken.length?broken:'README, verification and all three agent notes checked');
const changed=execFileSync('git',['diff','--name-only','--diff-filter=ACMRT'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
const prefix='docs/audits/2026-09-30-remediation/';
const omitted=new Set([`${prefix}source-manifest.json`,`${prefix}evidence/artifact-checks.json`]);
function listFiles(folder){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(item=>item.isDirectory()?listFiles(path.join(folder,item.name)):[path.relative(root,path.join(folder,item.name)).replaceAll('\\','/')]);}
const evidence=listFiles(directory);
const files=[...new Set([...changed,...untracked,...evidence])].filter(name=>name&&!omitted.has(name)&&!name.endsWith('.tsbuildinfo')&&(changed.includes(name)||/^(src|server|scripts|mobile|supabase)\//.test(name)||name.startsWith(prefix))).sort();
const artifacts=files.filter(name=>fs.statSync(path.join(root,name)).isFile()).map(name=>({path:name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')}));
fs.writeFileSync(path.join(directory,'source-manifest.json'),JSON.stringify({at:new Date().toISOString(),scope:'Changed tracked files and relevant untracked implementation/evidence. Includes preserved pre-existing work; does not imply sole authorship.',artifacts},null,2)+'\n');
fs.writeFileSync(path.join(directory,'evidence/artifact-checks.json'),JSON.stringify({at:new Date().toISOString(),checks,hashedFiles:artifacts.length},null,2)+'\n');
console.log(JSON.stringify({checks,hashedFiles:artifacts.length},null,2));
if(checks.some(c=>c.result!=='passed'))process.exitCode=1;

