import { test as base } from "@playwright/test";
export * from "@playwright/test";
// Feature journeys start as a returning local user. onboarding.spec.ts tests the real entry path.
export const test = base.extend<{ returningDevice: void }>({
  returningDevice: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        if (!localStorage.getItem("rep-and-plate.onboarding.v1"))
          localStorage.setItem(
            "rep-and-plate.onboarding.v1",
            JSON.stringify({
              version: 1,
              mode: "guest",
              focus: "A little of both",
            }),
          );
      });
      await use();
    },
    { auto: true },
  ],
});
