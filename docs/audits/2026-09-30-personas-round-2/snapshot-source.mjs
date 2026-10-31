import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{maxBuffer:20*1024*1024}).toString().split('\0').filter(p=>/^(src\/|server\/|mobile\/(src\/|App\.|package|app\.|tsconfig)|package|vite\.config|scripts\/)/.test(p)).sort();
const artifacts=[];
for(const path of files){try{artifacts.push({path,sha256:crypto.createHash('sha256').update(await fs.readFile(path)).digest('hex')});}catch{}}
const file=new URL(process.argv[2]==='after'?'source-after.json':'source-before.json',import.meta.url);
await fs.writeFile(file,JSON.stringify({at:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD']).toString().trim(),scope:'Tracked and nonignored app source and scripts, including pre-existing dirty work; excludes audit artifacts and generated builds',artifacts},null,2));
if(process.argv[2]==='after'){
 const before=JSON.parse(await fs.readFile(new URL('source-before.json',import.meta.url)));
 const unchanged=JSON.stringify(before.artifacts)===JSON.stringify(artifacts);
 console.log(JSON.stringify({unchanged,files:artifacts.length}));
 if(!unchanged)process.exitCode=1;
}else console.log(`${artifacts.length} app-source files fingerprinted`);
