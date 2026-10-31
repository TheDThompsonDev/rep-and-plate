import { expect, type Page } from "@playwright/test";

// Shared chat composer helpers for the web browser specs. `send` only submits;
// `sendAndWaitForReply` also waits until the processing indicator has cleared.
export async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message Rep & Plate" }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}

export async function sendAndWaitForReply(page: Page, text: string) {
  await send(page, text);
  // The processing indicator is `.fuel-processing` wrapping the Spot status;
  // wait until it appears (or the reply already landed) and then clears.
  await expect(page.locator(".fuel-processing")).toHaveCount(0, { timeout: 15000 });
}
