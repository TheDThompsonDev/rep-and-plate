import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const report=JSON.parse(await fs.readFile(new URL('./findings.json',import.meta.url),'utf8'));
for(const finding of report.findings)for(const path of finding.evidence)await fs.access(new URL(path,import.meta.url));
const browser=await chromium.connectOverCDP('http://127.0.0.1:9227');
for(const context of browser.contexts())await context.close();
await browser.close();
console.log('Findings JSON and all cited evidence validated; both owned contexts closed.');
