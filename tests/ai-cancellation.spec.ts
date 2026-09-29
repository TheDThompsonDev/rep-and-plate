import { test, expect, type Route } from "@playwright/test";
import { resultFixture } from "./ai-fixtures";

test("reset cancels an old reply and a new chat request works immediately", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: true, jev: true } }),
  );
  const pending: Route[] = [];
  await page.route("**/api/chat", (route) => {
    pending.push(route);
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("Old capture before reset");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit your profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear my records", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("Fresh conversation after reset");
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(() => pending.length).toBe(2);
  const oldRequest = pending[0].request().postDataJSON();
  const newRequest = pending[1].request().postDataJSON();
  // A provider can complete after client cancellation; its receipt must stay discarded.
  await pending[0]
    .fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          result: resultFixture(oldRequest.requestId),
        }) + "\n",
    })
    .catch(() => {});
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("Wait for the new answer");
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  await pending[1].fulfill({
    contentType: "application/x-ndjson",
    body:
      JSON.stringify({
        type: "result",
        result: {
          ...resultFixture(newRequest.requestId),
          reply: "This is your new conversation.",
          receipt: null,
          meal: null,
          decision: "conversation",
        },
      }) + "\n",
  });
  await expect(
    page.getByText("This is your new conversation.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeEnabled();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("fuel.prototype.v1")!),
  );
  expect(
    state.messages.some(
      (message: any) =>
        message.id === oldRequest.requestId ||
        message.requestId === oldRequest.requestId,
    ),
  ).toBe(false);
  expect(
    state.messages.filter(
      (message: any) => message.requestId === newRequest.requestId,
    ),
  ).toHaveLength(1);
  expect(state.groceries ?? []).toEqual([]);
  await page.reload();
  await expect(
    page.getByText("This is your new conversation.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Old capture before reset", { exact: true }),
  ).toHaveCount(0);
});
