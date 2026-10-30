import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 835, height: 1564 } });
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Try on this device first', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Your name', exact: true });
  const next = page.getByRole('button', { name: 'That’s me. Let’s go.', exact: true });
  const observed = { choices: await page.locator('.welcome-choice').allTextContents(), required: await name.getAttribute('required'), blankDisabled: await next.isDisabled() };
  await name.fill('   ');
  observed.whitespaceDisabled = await next.isDisabled();
  await name.fill('Alex');
  observed.namedEnabled = await next.isEnabled();
  await page.screenshot({ path: new URL('setup.png', import.meta.url).pathname.slice(1), fullPage: true, animations: 'disabled' });
  writeFileSync(new URL('visual-observation.json', import.meta.url), JSON.stringify(observed, null, 2));
} finally {
  await browser.close();
}
