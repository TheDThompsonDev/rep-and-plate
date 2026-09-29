import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const base = process.env.SPOT_STUDIO_URL || "http://127.0.0.1:5173";
const items = JSON.parse(
  await readFile("public/spot-studio/manifest.json", "utf8"),
);
await mkdir("public/spot-studio/memes", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 1,
  });
  const dimensions = {};
  for (const item of items) {
    await page.goto(`${base}/spot-studio/index.html?card=${item.id}`);
    await page.locator(".poster img").evaluate((image) => image.decode());
    await page
      .locator(".poster")
      .screenshot({ path: `public/spot-studio/memes/${item.id}.png` });
    const raw = await readFile(`public/images/spot/expansion/${item.id}.png`);
    dimensions[item.id] = {
      width: raw.readUInt32BE(16),
      height: raw.readUInt32BE(20),
    };
  }
  await writeFile(
    "public/images/spot/expansion/dimensions.json",
    JSON.stringify(dimensions, null, 2) + "\n",
  );
  await page.setViewportSize({ width: 1240, height: 1000 });
  await page.goto(`${base}/spot-studio/index.html`);
  await page.locator(".card").last().waitFor();
  await page.evaluate(async () => {
    for (const image of document.images) image.loading = "eager";
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  await page.screenshot({
    path: "docs/design/spot-studio.png",
    fullPage: true,
  });
  console.log(
    `Exported ${items.length} caption cards at 1080 × 1080; source sizes recorded.`,
  );
} finally {
  await browser.close();
}
