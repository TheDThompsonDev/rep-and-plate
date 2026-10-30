import { test, expect, type Page } from "./app-fixture";
test.setTimeout(90000);

// Audit follow-up (CHAT-COMPOSER-001): native matched web's typed-draft
// retention but dropped a voice transcript sent while a reply was processing
// (Capture.tsx "Send message" -> store.send returned silently when busy).

const composer = (page: Page) =>
  page.getByRole("textbox", { name: "Message Rep & Plate" });
const sendButton = (page: Page) =>
  page.getByRole("button", { name: "Send message", exact: true });

/** Hold the first chat request open until `release()`; later requests answer at once. */
async function holdFirstReply(page: Page) {
  const requests: { requestId: string; text: string }[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/chat", async (route) => {
    const request = route.request().postDataJSON();
    requests.push(request);
    if (requests.length === 1) await gate;
    await route
      .fulfill({
        contentType: "application/x-ndjson",
        body:
          JSON.stringify({
            type: "result",
            result: {
              requestId: request.requestId,
              reply: `Reply to: ${request.text}`,
              decision: "conversation",
              meal: null,
              receipt: null,
              sources: [],
              warnings: [],
            },
          }) + "\n",
      })
      .catch(() => {});
  });
  return { requests, release };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "health.connection",
      JSON.stringify({ url: "http://127.0.0.1:5174", token: "a".repeat(64) }),
    ),
  );
});

test("native: a voice transcript and a typed draft sent while Spot is replying stay in the composer", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const chat = await holdFirstReply(page);
  await page.goto("/");
  await composer(page).fill("Coffee with milk");
  await sendButton(page).click();
  await expect(
    page.getByRole("button", { name: "Stop response", exact: true }),
  ).toBeVisible();
  await expect(composer(page)).toHaveValue("");

  // The mic stays available while the reply is processing. The review field
  // is where a transcript lands before the user sends it.
  await page.getByRole("button", { name: "Record a message", exact: true }).click();
  await expect(page.getByText("Tell me what happened", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Review your message" })
    .fill("Two eggs and toast");
  await sendButton(page).click();
  await expect(composer(page)).toHaveValue("Two eggs and toast");
  await expect(page.getByText("stays in the composer")).toBeVisible();
  await expect(page.getByText("Tell me what happened", { exact: true })).toHaveCount(0);
  expect(chat.requests).toHaveLength(1);

  // Sending the typed draft while still busy keeps it too (no silent drop).
  await sendButton(page).click();
  await expect(composer(page)).toHaveValue("Two eggs and toast");
  await expect(page.getByText("stays in the composer")).toBeVisible();
  expect(chat.requests).toHaveLength(1);

  chat.release();
  await expect(page.getByText("Reply to: Coffee with milk", { exact: true })).toBeVisible();
  await expect(composer(page)).toHaveValue("Two eggs and toast");
  await sendButton(page).click();
  await expect(composer(page)).toHaveValue("");
  await expect(page.getByText("Reply to: Two eggs and toast", { exact: true })).toBeVisible();
  expect(chat.requests.map((r) => r.text)).toEqual([
    "Coffee with milk",
    "Two eggs and toast",
  ]);
  expect(errors).toEqual([]);
});
