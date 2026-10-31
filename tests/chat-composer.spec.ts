import { initialState } from "../src/domain";
import { resultFixture } from "../e2e-shared/ai-fixtures";
import { readBrowserRecords } from "./record-fixture";
import { test, expect, type Page } from "./app-fixture";

// Audit C1, C2, C7: the composer must never lose text while a reply is
// processing, the user can stop an in-flight reply, and the capture retry is
// gated on connected chat with user-facing copy.

const composer = (page: Page) =>
  page.getByRole("textbox", { name: "Message Rep & Plate" });
const processing = (page: Page) =>
  page.getByText("Got it. Tiny plate. Big thinking.", { exact: true });
const conversation = (requestId: string, reply: string) => ({
  ...resultFixture(requestId),
  receipt: null,
  decision: "conversation",
  reply,
  warnings: [],
  sources: [],
});
const ndjson = (result: unknown) => ({
  contentType: "application/x-ndjson",
  body: JSON.stringify({ type: "result", result }) + "\n",
});
async function send(page: Page, text: string) {
  await composer(page).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}
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
      .fulfill(ndjson(conversation(request.requestId, `Reply to: ${request.text}`)))
      .catch(() => {});
  });
  return { requests, release };
}
async function fakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    const stream = { getTracks: () => [{ stop: () => {} }] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => Promise.resolve(stream) },
    });
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["synthetic voice fixture"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: Recorder,
    });
  });
}
const userMessages = async (page: Page, text: string) =>
  (await readBrowserRecords(page)).messages.filter(
    (m: { role: string; text: string }) => m.role === "user" && m.text === text,
  ).length;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: true, jev: true, model: "test-model" } }),
  );
});

test("A menu preset chosen while Spot is replying stays in the composer with a notice", async ({
  page,
}) => {
  const chat = await holdFirstReply(page);
  await page.goto("/");
  await send(page, "I had oatmeal with berries");
  await expect(processing(page)).toBeVisible();
  await page.getByRole("button", { name: "Open chat menu", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Today.s nutrition/ })
    .click();
  await expect(composer(page)).toHaveValue("How am I doing today?");
  await expect(page.locator(".toast")).toContainText("stays in the composer");
  expect(chat.requests).toHaveLength(1);
  chat.release();
  await expect(
    page.getByText("Reply to: I had oatmeal with berries", { exact: true }),
  ).toBeVisible();
  await expect(composer(page)).toHaveValue("How am I doing today?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(composer(page)).toHaveValue("");
  await expect.poll(() => userMessages(page, "How am I doing today?")).toBe(1);
  // The nutrition summary is a local command: no second provider call.
  expect(chat.requests).toHaveLength(1);
});

test("A voice transcript sent while Spot is replying is kept in the composer", async ({
  page,
}) => {
  await fakeMicrophone(page);
  await page.route("**/api/voice", (route) =>
    route.fulfill({ json: { text: "Two eggs and toast" } }),
  );
  const chat = await holdFirstReply(page);
  await page.goto("/");
  await send(page, "Coffee with milk");
  await expect(processing(page)).toBeVisible();
  await page.getByRole("button", { name: "Use voice", exact: true }).first().click();
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await page.getByRole("button", { name: "Stop recording", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Voice transcript" })).toHaveValue(
    "Two eggs and toast",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(composer(page)).toHaveValue("Two eggs and toast");
  await expect(page.locator(".toast")).toContainText("stays in the composer");
  expect(chat.requests).toHaveLength(1);
  chat.release();
  await expect(page.getByText("Reply to: Coffee with milk", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Reply to: Two eggs and toast", { exact: true })).toBeVisible();
  expect(chat.requests.map((r) => r.text)).toEqual(["Coffee with milk", "Two eggs and toast"]);
});

test("Stop response aborts the reply, keeps the capture retryable, and drops the late result", async ({
  page,
}, testInfo) => {
  const chat = await holdFirstReply(page);
  await page.goto("/");
  await send(page, "I had a chai latte");
  await expect(processing(page)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("stop-response.png") });
  await page.getByRole("button", { name: "Stop response", exact: true }).click();
  await expect(processing(page)).toBeHidden();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Stopped. Your capture is saved; you can retry.");
  await expect(
    alert.getByRole("button", { name: "Retry this capture", exact: true }),
  ).toBeEnabled();
  await expect(composer(page)).toBeEnabled();
  // The held reply is released after the stop; it must never land.
  chat.release();
  await page.waitForTimeout(1000);
  await expect(page.getByText("Reply to: I had a chai latte", { exact: true })).toHaveCount(0);
  await send(page, "And a banana");
  await expect(page.getByText("Reply to: And a banana", { exact: true })).toBeVisible();
  await alert.getByRole("button", { name: "Retry this capture", exact: true }).click();
  await expect(page.getByText("Reply to: I had a chai latte", { exact: true })).toBeVisible();
  expect(chat.requests.map((r) => r.text)).toEqual([
    "I had a chai latte",
    "And a banana",
    "I had a chai latte",
  ]);
  expect(chat.requests[2].requestId).toBe(chat.requests[0].requestId);
  const state = await readBrowserRecords(page);
  expect(
    state.messages.filter((m: { role: string; ai?: boolean }) => m.role === "assistant" && m.ai),
  ).toHaveLength(2);
});

for (const scenario of [
  { access: undefined, label: "Reconnect to retry this capture" },
  { access: "signin", label: "Sign in to retry this capture" },
] as const) {
  test(`A failed capture offers "${scenario.label}" instead of retry when chat is unavailable`, async ({
    page,
  }) => {
    await page.route("**/api/status", (route) =>
      route.fulfill({ json: { available: false, jev: false, access: scenario.access } }),
    );
    const state = initialState();
    state.messages.push({
      id: "capture-1",
      role: "user",
      text: "I had a burrito",
      time: "12:00 PM",
      ai: true,
      aiStatus: "error",
      aiError: "The AI service is temporarily unavailable.",
    });
    await page.addInitScript(
      (seed) => localStorage.setItem("fuel.prototype.v1", JSON.stringify(seed)),
      state,
    );
    await page.goto("/");
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("temporarily unavailable");
    await expect(
      alert.getByRole("button", { name: "Retry this capture", exact: true }),
    ).toHaveCount(0);
    await expect(alert.getByRole("button", { name: scenario.label, exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("check the server");
  });
}
