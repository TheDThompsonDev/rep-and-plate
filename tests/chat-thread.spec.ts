import { aiRequestSchema } from "../src/ai-contract";
import { resultFixture } from "./ai-fixtures";
import { seedConversation } from "./record-fixture";
import { test, expect, type Page } from "./app-fixture";

// Audit §1 completeness gaps for the Chat home: scroll anchoring with a
// "Jump to latest" control, a live region that announces only messages, the
// shared composer limit, and date dividers across local days.

const LIMIT = 4000;
const composer = (page: Page) =>
  page.getByRole("textbox", { name: "Message Rep & Plate" });
const thread = (page: Page) => page.locator(".fuel-conversation");
const log = (page: Page) => page.locator("[role=log]");
const jump = (page: Page) => page.getByRole("button", { name: /Jump to latest/ });
const processing = (page: Page) =>
  page.getByRole("status").filter({ hasText: "Got it. Tiny plate. Big thinking." });

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
const localIso = (daysAgo: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
/** Enough alternating messages that the thread scrolls on both projects. */
const longHistory = (count = 30) =>
  Array.from({ length: count }, (_, i) => ({
    id: `history-${i}`,
    role: i % 2 ? "assistant" : "user",
    text:
      i % 2
        ? `Logged. That is history line ${i} of your conversation so far.`
        : `History line ${i}: I had a bowl of oats with berries and a coffee.`,
    time: "9:05 AM",
    at: localIso(0, 9, i),
  }));
const position = (page: Page) =>
  thread(page).evaluate((el) => ({
    top: el.scrollTop,
    gap: el.scrollHeight - el.scrollTop - el.clientHeight,
  }));
/** Wait until any smooth follow animation has finished moving the thread. */
const settled = (page: Page) =>
  expect
    .poll(async () => {
      const before = (await position(page)).top;
      await page.waitForTimeout(120);
      return (await position(page)).top === before;
    })
    .toBe(true);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: true, jev: true, model: "test-model" } }),
  );
});

test("a reply arriving while the reader has scrolled up does not move the thread, and Jump to latest catches up", async ({
  page,
}, info) => {
  const chat = await holdFirstReply(page);
  await page.goto("/");
  await seedConversation(page, longHistory());
  await send(page, "I had oatmeal with berries");
  await expect(processing(page)).toBeVisible();
  await expect.poll(async () => (await position(page)).gap).toBeLessThan(48);
  await settled(page);
  await thread(page).evaluate((el) => el.scrollTo({ top: 0 }));
  await expect.poll(async () => (await position(page)).top).toBe(0);
  chat.release();
  await expect(
    page.getByText("Reply to: I had oatmeal with berries", { exact: true }),
  ).toBeAttached();
  await page.waitForTimeout(300);
  expect((await position(page)).top).toBe(0);
  await expect(jump(page)).toBeVisible();
  await expect(jump(page)).toContainText("1 new");
  await page.screenshot({ path: info.outputPath("jump-to-latest.png") });
  await jump(page).click();
  await expect.poll(async () => (await position(page)).gap).toBeLessThan(48);
  await expect(
    page.getByText("Reply to: I had oatmeal with berries", { exact: true }),
  ).toBeInViewport();
  await expect(jump(page)).toBeHidden();
});

test("at the bottom the thread follows new replies and offers no jump control", async ({
  page,
}) => {
  const chat = await holdFirstReply(page);
  await page.goto("/");
  await seedConversation(page, longHistory());
  await expect.poll(async () => (await position(page)).gap).toBeLessThan(48);
  await expect(jump(page)).toBeHidden();
  await send(page, "Then a banana");
  await expect(processing(page)).toBeVisible();
  chat.release();
  await expect(
    page.getByText("Reply to: Then a banana", { exact: true }),
  ).toBeInViewport();
  await expect.poll(async () => (await position(page)).gap).toBeLessThan(48);
  await expect(jump(page)).toBeHidden();
});

test("Jump to latest respects prefers-reduced-motion by jumping instantly", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await seedConversation(page, longHistory());
  await settled(page);
  await thread(page).evaluate((el) => el.scrollTo({ top: 0 }));
  await expect(jump(page)).toBeVisible();
  await jump(page).click();
  // One frame later the thread is already at the bottom: no smooth animation.
  const gap = await thread(page).evaluate(
    (el) =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() =>
          resolve(el.scrollHeight - el.scrollTop - el.clientHeight),
        ),
      ),
  );
  expect(gap).toBeLessThan(48);
  await expect(jump(page)).toBeHidden();
});

test("the live region holds only conversation messages", async ({ page }) => {
  const chat = await holdFirstReply(page);
  await page.goto("/");
  await seedConversation(page, longHistory(4));
  await expect(log(page)).toHaveCount(1);
  await expect(log(page)).toHaveAttribute("aria-live", "polite");
  // Discovery content is still on the page, just not inside the log.
  await expect(page.getByText("What can I say to Spot?")).toBeVisible();
  await expect(page.locator(".spot-welcome")).toBeVisible();
  await expect(log(page).locator(".spot-welcome")).toHaveCount(0);
  await expect(log(page).locator("details")).toHaveCount(0);
  await expect(log(page).locator(".receipt-entry")).toHaveCount(0);
  await expect(log(page).locator(".fuel-connection-notice")).toHaveCount(0);
  await expect(log(page).locator("[role=status]")).toHaveCount(0);
  await expect(log(page).locator("[aria-live]")).toHaveCount(0);
  const children = await log(page).evaluate((el) =>
    Array.from(el.children).map((child) => child.className.split(" ")[0]),
  );
  expect(children.length).toBeGreaterThanOrEqual(4);
  expect(
    children.every((name) => name === "fuel-message" || name === "fuel-day-divider"),
  ).toBe(true);
  await expect(log(page).locator(".fuel-message")).toHaveCount(4);
  // The processing indicator is a status outside the log.
  await send(page, "Coffee");
  await expect(processing(page)).toBeVisible();
  await expect(log(page).locator("[role=status]")).toHaveCount(0);
  const snapshot = await log(page).ariaSnapshot();
  expect(snapshot).not.toMatch(/- status/);
  chat.release();
  await expect(page.getByText("Reply to: Coffee", { exact: true })).toBeVisible();
  await expect(log(page).locator(".fuel-message")).toHaveCount(6);
});

test("the composer accepts exactly the shared server limit and counts down only near it", async ({
  page,
}) => {
  const requests: unknown[] = [];
  await page.route("**/api/chat", async (route) => {
    const request = route.request().postDataJSON();
    requests.push(request);
    await route.fulfill(ndjson(conversation(request.requestId, "Noted.")));
  });
  await page.goto("/");
  await expect(composer(page)).toHaveAttribute("maxlength", String(LIMIT));
  await composer(page).fill("x".repeat(LIMIT - 201));
  await expect(page.getByText(/characters left/)).toHaveCount(0);
  await composer(page).fill("x".repeat(LIMIT - 200));
  await expect(page.getByRole("status").filter({ hasText: "200 characters left" })).toBeVisible();
  const exact = "y".repeat(LIMIT);
  await composer(page).fill(exact);
  await expect(page.getByRole("status").filter({ hasText: "0 characters left" })).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Noted.", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  const parsed = aiRequestSchema.safeParse(requests[0]);
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.text).toHaveLength(LIMIT);
  await expect(page.getByText(/characters left/)).toHaveCount(0);
});

test("a date divider separates messages from different local days; unstamped records get none", async ({
  page,
}) => {
  await page.goto("/");
  await seedConversation(page, [
    { id: "d1", role: "user", text: "Late dinner", time: "11:50 PM", at: localIso(1, 23, 50) },
    { id: "d2", role: "assistant", text: "Logged your dinner.", time: "11:51 PM", at: localIso(1, 23, 51) },
    { id: "d3", role: "user", text: "Midnight snack", time: "12:10 AM", at: localIso(0, 0, 10) },
    { id: "d4", role: "assistant", text: "Logged your snack.", time: "12:11 AM" },
  ]);
  await expect(log(page).getByRole("separator", { name: "Yesterday" })).toHaveCount(1);
  await expect(log(page).getByRole("separator", { name: "Today" })).toHaveCount(1);
  await expect(log(page).getByRole("separator")).toHaveCount(2);
  await expect(log(page).locator(".fuel-message")).toHaveCount(4);
  // Records saved before `at` existed render exactly as before: no dividers.
  await seedConversation(page, [
    { id: "o1", role: "user", text: "Old capture", time: "8:00 AM" },
    { id: "o2", role: "assistant", text: "Old reply", time: "8:01 AM" },
  ]);
  await expect(log(page).locator(".fuel-message")).toHaveCount(2);
  await expect(log(page).getByRole("separator")).toHaveCount(0);
});
