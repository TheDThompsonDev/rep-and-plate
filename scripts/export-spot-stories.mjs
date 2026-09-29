import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const base=process.env.SPOT_STUDIO_URL || 'http://127.0.0.1:5173';
const collection=process.argv[2] || 'stories';
if (!['stories','chaos'].includes(collection)) throw Error('Choose stories or chaos.');
const folder=`public/spot-studio/${collection}`;
const items=JSON.parse(await readFile(`${folder}/manifest.json`,'utf8'));
await mkdir(`${folder}/cards`,{recursive:true});
const browser=await chromium.launch();
const evidence=[];
try {
 const page=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
 for(const item of items){
  await page.goto(`${base}/spot-studio/${collection}/index.html?card=${item.id}`);
  await page.locator('.story-poster').waitFor();
  await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));});
  await page.locator('.story-poster').screenshot({path:`${folder}/${item.card}`});
  const raw=await readFile(`${folder}/${item.card}`);
  evidence.push({id:item.id,scene:[item.width,item.height],card:[raw.readUInt32BE(16),raw.readUInt32BE(20)]});
 }
 await page.setViewportSize({width:1240,height:1000});
 await page.goto(`${base}/spot-studio/${collection}/index.html`);
 await page.locator('.story').last().waitFor();
 await page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode()));});
 await page.screenshot({path:`docs/design/spot-${collection}.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:`docs/design/spot-${collection}-mobile.png`,fullPage:true});
 await writeFile(`${folder}/dimensions.json`,JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence));
}finally{await browser.close();}
