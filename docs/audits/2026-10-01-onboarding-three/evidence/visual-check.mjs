import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage({ viewport:{width:390,height:844} });
 await page.goto('http://127.0.0.1:5173/');
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await page.getByRole('button',{name:'Try on this device first',exact:true}).click();
 if (!await page.getByRole('radio',{name:'A little of all three',exact:true}).isChecked()) throw Error('Combined default is not selected');
 await page.screenshot({path:'docs/audits/2026-10-01-onboarding-three/evidence/setup.png',fullPage:true});
 await page.getByRole('button',{name:'That’s me. Let’s go.',exact:true}).click();
 const guidance=await page.locator('.welcome-ready').innerText();
 if (!guidance.includes('meal, a workout, or a grocery receipt')) throw Error('Combined guidance omitted an activity');
 await page.screenshot({path:'docs/audits/2026-10-01-onboarding-three/evidence/ready.png',fullPage:true});
 console.log(JSON.stringify({selected:'A little of all three',guidance}));
} finally { await browser.close(); }
