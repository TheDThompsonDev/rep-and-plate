import { test, expect } from "./app-fixture";

test("story collection supports choosing, copying and downloading a complete scene", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/spot-studio/stories/index.html");
  await expect(page.locator(".story:visible")).toHaveCount(6);
  await page.getByRole("button", { name: "Training", exact: true }).click();
  await expect(page.locator(".story:visible")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "My legs have left the chat." })).toBeVisible();
  await page.getByRole("button", { name: "Copy exchange: My legs have left the chat.", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Exchange copied.");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe("“Leg day went great.”\nAnd then we met the stairs.\nMy legs have left the chat.");
  for (const label of ["Share card: My legs have left the chat.", "Scene only: My legs have left the chat.", "Download all six stories"]) {
    const pending=page.waitForEvent("download");
    await page.getByRole("link", { name: label }).click();
    const download=await pending;
    expect(await download.failure()).toBeNull();
  }
  await page.getByRole("button", { name: "All", exact: true }).click();
  expect(await page.locator(".scene").evaluateAll(async nodes=>{
    const images=nodes as HTMLImageElement[];
    for(const image of images){image.loading="eager";await image.decode();}
    return images.every(image=>image.naturalWidth===1254&&image.naturalHeight===1254);
  })).toBe(true);
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
