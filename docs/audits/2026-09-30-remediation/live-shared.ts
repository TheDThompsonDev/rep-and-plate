import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { runAI } from '../../../server/ai.ts';
import { readConfig } from '../../../server/http.ts';
import { buildAIRequest } from '../../../src/ai-client.ts';
import { initialState, type Message } from '../../../src/domain.ts';

const config=readConfig(process.env);
const cases=[
 {name:'walk',text:'I walked for 20 minutes.',captureDay:'2026-09-20'},
 {name:'decimal-and-diary-day',text:'I ate one yogurt for breakfast. The label for the exact portion I ate says 215 kcal, 18.3 g protein, 33 g carbs and 0.4 g fat. Use these label values.',captureDay:'2026-09-20'},
 {name:'focused-portion',text:'I ate peanut butter for breakfast.',captureDay:undefined},
];
const records:unknown[]=[];
for(const entry of cases){
 const message:Message={id:crypto.randomUUID(),role:'user',text:entry.text,time:'now',captureDay:entry.captureDay};
 const request=buildAIRequest(initialState(),message);
 const started=Date.now();
 try{
  const result=await runAI(request,config,()=>{},AbortSignal.timeout(160000));
  const passed=entry.name==='walk' ? result.activity?.minutes===20 && result.activity.day==='2026-09-20' && !result.meal && !result.workout : entry.name==='decimal-and-diary-day' ? result.meal?.protein===18.3 && result.meal.fat===0.4 && result.meal.day==='2026-09-20' && result.reply.includes('18.3 g protein') && result.reply.includes('0.4 g fat') : !result.meal && /(?:how much|portion|tablespoon|amount)/i.test(result.reply) && !/meal or grocer|grocer.*or.*meal/i.test(result.reply);
  records.push({name:entry.name,request:{text:request.text,day:request.day,captureDay:request.captureDay},elapsedMs:Date.now()-started,passed,result});
  console.log(JSON.stringify({name:entry.name,passed,decision:result.decision}));
 }catch(error){records.push({name:entry.name,passed:false,error:error instanceof Error?error.message:'Unknown error'});console.log(JSON.stringify({name:entry.name,passed:false}));}
 writeFileSync('docs/audits/2026-09-30-remediation/evidence/shared-live.json',JSON.stringify({at:new Date().toISOString(),records},null,2));
}
if(records.some(record=>(record as {passed:boolean}).passed===false))process.exitCode=1;
