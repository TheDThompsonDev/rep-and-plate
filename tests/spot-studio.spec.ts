import { test, expect } from "@playwright/test";

test("Spot Studio filters, copies captions and downloads reusable art", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/spot-studio/index.html");
  await expect(page.locator(".card:visible")).toHaveCount(12);
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await expect(page.locator(".card:visible")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Food", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Everyday", exact: true }).click();
  await expect(page.locator(".card:visible")).toHaveCount(3);
  await page.getByRole("button", { name: "Copy caption: Booting up.", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Caption copied.");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe("Booting up.\nPlease allow one coffee.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Meme PNG: Booting up.", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("coffee.png");
  expect(await download.failure()).toBeNull();
  const bundlePromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download the full pack" }).click();
  const bundle = await bundlePromise;
  expect(bundle.suggestedFilename()).toBe("spot-meme-pack.zip");
  expect(await bundle.failure()).toBeNull();
  await page.getByRole("button", { name: "All", exact: true }).click();
  expect(await page.locator(".poster img").evaluateAll(async images => {
    for (const image of images as HTMLImageElement[]) { image.loading = "eager"; await image.decode(); }
    return (images as HTMLImageElement[]).every(image => image.naturalWidth === 1254 && image.naturalHeight === 1254);
  })).toBe(true);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
