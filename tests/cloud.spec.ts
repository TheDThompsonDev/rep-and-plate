import { test, expect } from "./app-fixture";
import { mockCloud, openAccount, signIn, stored } from "./cloud-fixture";
test("Account sign-out returns to welcome and preserves records even if the server fails", async ({page})=>{
  const cloud=await mockCloud(page);
  await openAccount(page);
  await signIn(page);
  const before=await stored(page);
  const signout=page.getByRole('button',{name:'Sign out on this device'});
  await expect(signout).toBeInViewport();
  cloud.failedSignOut=true;
  await signout.click();
  await expect(page.getByRole('heading',{name:/Track your food/})).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
});

test("Cloud uploads, restores, and deletes only after explicit review", async ({
  page,
}) => {
  const cloud = await mockCloud(page);
  await openAccount(page);
  const before = await stored(page);
  await signIn(page);
  expect(cloud.saveCalls).toBe(0);
  await page.getByRole("button", { name: /Upload this device/ }).click();
  await expect(
    page.getByRole("button", { name: "Upload reviewed records" }),
  ).toBeDisabled();
  expect(cloud.saveCalls).toBe(0);
  await page
    .getByRole("checkbox", {
      name: "I want these records saved to this account.",
    })
    .check();
  await page.getByRole("button", { name: "Upload reviewed records" }).click();
  await expect(page.getByRole("status")).toContainText("records are saved");
  expect(cloud.saveCalls).toBe(1);
  expect(cloud.remote.state).toEqual(before);
  expect(await stored(page)).toEqual(before);

  cloud.remote.state = {
    ...before,
    profile: { ...before.profile, name: "Restored fixture" },
  };
  await page.getByRole("button", { name: /Load my saved records/ }).click();
  await expect(
    page.getByRole("button", { name: "Replace this device", exact: true }),
  ).toBeDisabled();
  expect((await stored(page)).profile.name).toBe(before.profile.name);
  await page
    .getByRole("checkbox", {
      name: "I understand this replaces this device's records.",
    })
    .check();
  await page
    .getByRole("button", { name: "Replace this device", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page)).profile.name)
    .toBe("Restored fixture");

  await page.getByRole("button", { name: /Delete my cloud copy/ }).click();
  await expect(
    page.getByRole("button", { name: "Delete cloud copy", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Type DELETE to confirm" })
    .fill("DELETE");
  await page
    .getByRole("button", { name: "Delete cloud copy", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "cloud copy was deleted",
  );
  expect(cloud.deleteCalls).toBe(1);
  expect((await stored(page)).profile.name).toBe("Restored fixture");
});

test("A conflicting upload stops without changing local records or retrying", async ({
  page,
}) => {
  const cloud = await mockCloud(page);
  await openAccount(page);
  const before = await stored(page);
  await signIn(page);
  cloud.conflict = true;
  await page.getByRole("button", { name: /Upload this device/ }).click();
  await page
    .getByRole("checkbox", {
      name: "I want these records saved to this account.",
    })
    .check();
  await page.getByRole("button", { name: "Upload reviewed records" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "changed on another device",
  );
  await expect(page.getByRole("button", { name: "Upload reviewed records" })).toBeDisabled();
  expect(cloud.saveCalls).toBe(1);
  expect(await stored(page)).toEqual(before);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Upload this device/ }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export this device's records" })
    .click();
  expect((await download).suggestedFilename()).toMatch(
    /^rep-and-plate-records-.*\.json$/,
  );
});

test("Cloud setup and authentication never automatically upload device records", async ({
  page,
}) => {
  const cloud = await mockCloud(page);
  await openAccount(page);
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("dialog", { name: "Your account & saved records" })
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect(cloud.signups).toBe(1);
  expect(cloud.saveCalls).toBe(0);
  await page
    .getByRole("button", { name: "Already have an account? Sign in" })
    .click();
  await signIn(page);
  const before = await stored(page);
  cloud.failedSave = true;
  await page.getByRole("button", { name: /Upload this device/ }).click();
  await page
    .getByRole("checkbox", {
      name: "I want these records saved to this account.",
    })
    .check();
  await page.getByRole("button", { name: "Upload reviewed records" }).click();
  await expect(page.getByRole("alert")).toContainText("did not complete");
  await expect(page.getByRole("alert")).not.toContainText("Private upstream");
  expect(await stored(page)).toEqual(before);
  expect(cloud.saveCalls).toBe(1);
});
