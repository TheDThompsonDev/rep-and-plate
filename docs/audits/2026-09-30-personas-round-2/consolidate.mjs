import fs from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const shared=await read('shared/findings.json'),native=await read('native/findings.json'),kitchen=await read('kitchen/findings.json'),own=await read('root-findings.json');
const records=[];
function add(origin,row,kind,extra={}){
 const evidence=(Array.isArray(row.evidence)?row.evidence:row.evidence?[row.evidence]:[]).map(p=>`${origin?origin+'/':''}${p}`);
 records.push({id:'',originId:row.id||row.localId,originReport:origin?`${origin}/report.md`:'root-findings.json',kind,priority:row.priority||(row.severity==='medium'?'P2':'P3'),title:row.title,personas:row.personas||['developer'],classification:row.classification||row.status||kind,trigger:row.trigger||row.reproduction||row.stage||'',observed:row.observed||row.actual||row.observation||'',expectationHypothesis:row.expectationHypothesis||row.expectation||row.expected||row.suggestedRemedy||'',wishHypothesis:row.wishHypothesis||row.suggestedRemedy||row.expected||'',availabilityCheck:row.availabilityCheck||row.missingFeatureCheck||'',workaround:row.workaround||'',recurringUseHypothesis:row.recurringUse||row.recurringImportance||row.impact||'',confidence:row.confidence||row.limitation||row.status||'Observed behavior as described; hypothetical wishes unvalidated with humans',oldFindings:row.previousFriction||row.oldIds||row.oldFindings||row.oldFrictionIds||[],evidence,source:row.source||[],suggestedAcceptance:row.suggestedAcceptance||'',...extra});
}
for(const row of shared.findings)add('shared',row,row.id==='SH-R2-04'?'opportunity':'friction',{priority:row.priority.match(/^P[123]/)?.[0]||row.priority});
records.find(r=>r.originId==='SH-R2-01').evidence.push('native/06-calories-only-rejected.txt');
for(const row of native.findings)add('native',row,'friction',{platform:'Expo-web native preview; physical device behavior unverified'});
add('native',native.wishes.find(r=>r.id==='DEV-W03'),'opportunity',{priority:'P3',wishHypothesis:'Use the same account-data tool name in navigation and help so the existing recovery tool is easier to find.'});
const performance=native.wishes.find(r=>r.id==='DEV-W02');
add('native',performance,'investigation',{priority:'Research',evidence:['native/baseline.json','native/journey.json'],wishHypothesis:'Check production transfer size and slow-network startup before choosing an optimization.',availabilityCheck:'Loopback transfer was uncompressed; the observed interface remained usable. No production latency defect established.'});
for(const row of own.findings)add('',row,'friction');
// Kitchen records are normalized after review; original lane fields remain in its JSON.
for(const row of kitchen.findings||[]){
 if(row.id==='K06'){
  const repeated=records.find(r=>r.originId==='SH-R2-04');
  repeated.evidence.push(...row.evidence.map(p=>'kitchen/'+p));
  repeated.personas.push('expert','six-months');repeated.corroboratingOrigin='K06';
  continue;
 }
 const kind=['K01','K02','K03'].includes(row.id)?'friction':'opportunity';
 add('kitchen',row,kind,{priority:row.id==='K08'?'P3':'P2'});
}
for(const row of kitchen.wishes||[])add('kitchen',row,'opportunity');
records.sort((a,b)=>{const weight=r=>r.kind==='friction'?Number(r.priority.slice(1,2)):r.kind==='opportunity'?3+Number(r.priority.slice(1,2)):9;return weight(a)-weight(b)});
records.forEach((r,i)=>r.id=`R2-${String(i+1).padStart(2,'0')}`);
const counts=Object.fromEntries(['friction','opportunity','investigation'].map(k=>[k,records.filter(r=>r.kind===k).length]));
for(const r of records)for(const p of r.evidence)await fs.access(new URL(p,root));
await fs.writeFile(new URL('friction-log.json',root),JSON.stringify({date:'2026-09-30',method:'Five simulated personas, actual local UI inspection; wishes/expectations/reuse are hypotheses, not human testimony',status:'Open recommendations; no product edits',priorityDefinitions:{P1:'Correct before public reliance on affected records',P2:'Next correction/usability batch',P3:'Lower urgency polish or convenience, validate demand',Research:'Gather production evidence; not a demonstrated defect'},counts,records,mergedNotes:['Native calories-only wish DEV-W01 is discussed with the web unknown-macro defect, not counted again.','Kitchen K06 portion-scaling opportunity corroborates SH-R2-04; evidence/personas merged into one record.','Kitchen opportunity priority descriptions normalized to P2/P3; opportunities are not declared release blockers.'],humanAvoidance:'Not measured; directed exhaustive walkthroughs cannot establish natural avoidance'},null,2));
const link=(p,label=p)=>`[${label}](${p})`;
let md='# Round-two friction and opportunity log\n\n'+
'Every observed statement below is supported by retained local evidence. Expectations, wishes and recurring-use value are analyst hypotheses. “Friction” includes defects and cumbersome existing paths; an “opportunity” is not a launch requirement. No product fixes were made in this pass.\n\n'+
'P1: correct before relying publicly on affected records. P2: next correction/usability batch. P3: lower urgency polish/convenience. Research: obtain production evidence before claiming a defect. Priority is audit triage, not a measured user vote.\n\n'+
'| ID | Type | Priority | Finding |\n|---|---|---|---|\n'+records.map(r=>`| ${r.id} | ${r.kind} | ${r.priority} | [${r.title}](#${r.id.toLowerCase()}) |`).join('\n')+'\n\n';
for(const r of records){
 md+=`<a id="${r.id.toLowerCase()}"></a>\n\n## ${r.id}: ${r.title}\n\n**${r.kind} · ${r.priority}** · ${r.classification}. Origin: ${link(r.originReport,r.originId)}.\n\n`;
 if(r.personas.length)md+=`**Personas:** ${r.personas.join(', ')}.\n\n`;
 if(r.trigger)md+=`**Task / reproduction:** ${r.trigger}\n\n`;
 if(r.observed)md+=`**Observed:** ${r.observed}\n\n`;
 if(r.expectationHypothesis)md+=`**Expected / hypothetical need:** ${r.expectationHypothesis}\n\n`;
 if(r.wishHypothesis)md+=`**Possible wish / proposed response:** ${r.wishHypothesis}\n\n`;
 if(r.availabilityCheck)md+=`**Already available / scope check:** ${r.availabilityCheck}\n\n`;
 if(r.workaround)md+=`**Current workaround:** ${r.workaround}\n\n`;
 if(r.recurringUseHypothesis)md+=`**Potential recurring value:** ${r.recurringUseHypothesis}\n\n`;
 if(r.suggestedAcceptance)md+=`**Suggested acceptance:** ${r.suggestedAcceptance}\n\n`;
 md+=`**Confidence / boundary:** ${r.confidence}${r.platform?'. '+r.platform:''}.\n\n`;
 if(r.oldFindings.length)md+=`**Related original findings:** ${r.oldFindings.join(', ')}. This is a residual or extension, not proof that every original remedy failed.\n\n`;
 const source=Array.isArray(r.source)?r.source:r.source?[r.source]:[];
 if(source.length)md+=`**Source:** ${source.map(p=>link('C:/Users/danny/Documents/coding/fitness/'+p,p)).join(' · ')}\n\n`;
 md+=`**Evidence:** ${r.evidence.map(p=>link(p)).join(' · ')}\n\n`;
}
md+='## Rejected or bounded candidate wishes\n\n- Applying one load across an exercise already works through Adjust exercise; it is not an absent feature.\n- Unknown portions can receive an explicit estimate-or-note choice. The estimate branch succeeded; the note-only branch was offered but not exercised.\n- Product matching, barcode serving amounts and recipe portions already exist. The generic repeated-meal path is the narrower portion-scaling opportunity.\n- Native unknown-macro rejection is honest about requiring all values; it is distinct from web defaults being silently accepted as confirmed zeros. Its optional calories-only wish is consolidated with the first finding.\n- No natural user avoidance, actual emotional reaction or retention was measured. Physical-device, hosted-service and human-study boundaries remain open.\n';
await fs.writeFile(new URL('friction-log.md',root),md);console.log(JSON.stringify({counts,total:records.length}));
