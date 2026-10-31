import { test } from "@playwright/test";
import { exercisePasswordRecovery } from "../../e2e-shared/account-recovery-fixture";
test.setTimeout(90000);
test("native password recovery handles invalid and valid email codes", async ({
  page,
}) => {
  await exercisePasswordRecovery(page, true);
});
