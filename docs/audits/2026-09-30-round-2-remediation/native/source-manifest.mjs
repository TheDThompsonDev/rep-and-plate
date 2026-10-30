import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const out=path.resolve('docs/audits/2026-09-30-round-2-remediation/native');
const exportTime=fs.statSync('mobile/dist/index.html').mtimeMs;
const seen=new Set();
function visit(file){file=path.resolve(file);if(seen.has(file)||!fs.existsSync(file))return;seen.add(file);const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(/(?:from\s*|import\s*|require\s*\()\s*["'](\.[^"']+)["']/g)){const base=path.resolve(path.dirname(file),match[1]);const candidate=[base,...['.ts','.tsx','.js','.jsx','/index.ts','/index.tsx'].map(s=>base+s)].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());if(candidate&&/\.[jt]sx?$/.test(candidate))visit(candidate);}}
visit('mobile/index.ts');
const sources=[...seen].sort().map(p=>({path:path.relative(process.cwd(),p).replaceAll('\\','/'),mtime:new Date(fs.statSync(p).mtimeMs).toISOString(),newerThanExport:fs.statSync(p).mtimeMs>exportTime,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
const bundles=fs.readdirSync('mobile/dist/_expo/static/js/web').map(name=>{const p=path.join('mobile/dist/_expo/static/js/web',name);return{name,bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')};});
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),exportTimestamp:new Date(exportTime).toISOString(),method:'Relative static import graph from mobile/index.ts. Timestamp comparison is corroboration, not a reproducible build attestation. Captured after fresh all-platform Expo export.',sources,bundles,newerSources:sources.filter(s=>s.newerThanExport)},null,2));
console.log({export:new Date(exportTime).toISOString(),sourceCount:sources.length,newer:sources.filter(s=>s.newerThanExport).map(s=>s.path),bundles});
