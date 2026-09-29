import { test, expect } from "@playwright/test";
test.setTimeout(60000);

test("native introduction shows Spot scenes before logging and can finish or skip", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Hey. I’m Spot." }),
  ).toBeVisible();
  await expect(page.getByTestId("spot-scene-press-conference")).toBeVisible();
  const sceneBox = await page.getByTestId("spot-scene-press-conference").boundingBox();
  expect(sceneBox!.height).toBeLessThanOrEqual(220);
  expect(sceneBox!.height).toBeCloseTo(sceneBox!.width, 0);
  await expect(
    page.getByText("You opened the app. I called a press conference.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByTestId("spot-scene-dinner-conspiracy")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hey. I’m Spot." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByTestId("spot-scene-leg-funeral")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByTestId("spot-scene-recovery-department"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Try it. What happened today?" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeFocused();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Always here.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip intro" })).toHaveCount(0);
  const draft=page.getByRole("textbox", { name: "Message Rep & Plate" });
  await draft.fill("Keep my lunch story");
  const beforeReplay=await page.evaluate(()=>localStorage.getItem("dannys-health.native.v1"));
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page.getByRole("button", { name: "Meet Spot", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hey. I’m Spot." })).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(draft).toHaveValue("Keep my lunch story");
  expect(await page.evaluate(()=>localStorage.getItem("dannys-health.native.v1"))).toBe(beforeReplay);
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Hide Spot illustrations", exact: true })
    .click();
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(page.getByTestId("spot-scene-dinner-conspiracy")).toHaveCount(0);
  await expect(
    page.getByText("No logs. Just vibes.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
