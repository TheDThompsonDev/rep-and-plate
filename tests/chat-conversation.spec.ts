import { test, expect } from "./app-fixture";
import { readBrowserRecords } from "./record-fixture";
import { boundaryReply } from "../server/chat-boundaries";

test("questions and boundary replies stay conversational across refresh", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: true, jev: false } }),
  );
  await page.route("**/api/chat", (route) => {
    const request = route.request().postDataJSON();
    const result = boundaryReply(
      request.requestId,
      request.text.includes("stock") ? "off_topic" : "medical",
    );
    if (request.text.includes("rest days"))
      result.reply =
        "Rest days give your muscles time to recover between training sessions. You can adjust rest to your training load and how you feel.";
    return route.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "result", result }) + "\n",
    });
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message Rep & Plate" }).waitFor();
  const before = await readBrowserRecords(page);
  for (const [text, reply] of [
    ["Why do rest days matter?", /Rest days give your muscles/],
    ["Which stock should I buy?", /Rep & Plate focuses on health and fitness/],
    [
      "Tell me which medication dose I need.",
      /That needs guidance from a qualified clinician/,
    ],
  ] as const) {
    await page.getByRole("textbox", { name: "Message Rep & Plate" }).fill(text);
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(page.getByText(reply)).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByText(/That needs guidance from a qualified clinician/),
  ).toBeVisible();
  const after = await readBrowserRecords(page);
  for (const key of ["meals", "groceries", "reviews", "workout"])
    expect(after[key]).toEqual(before[key]);
  expect(
    after.messages.filter(
      (message: { role: string }) => message.role === "user",
    ),
  ).toHaveLength(3);
  await expect(
    page.getByRole("button", { name: "Add to my food", exact: true }),
  ).toHaveCount(0);
});
