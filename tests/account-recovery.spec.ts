import { test } from "@playwright/test";
import { exercisePasswordRecovery } from "../e2e-shared/account-recovery-fixture";
test("password recovery verifies a code without entering an account or touching records", async ({
  page,
}) => {
  await exercisePasswordRecovery(page);
});
