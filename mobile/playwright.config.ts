import { defineConfig } from "@playwright/test";
// Helpers shared with the other browser suite live in ../e2e-shared/ and are imported
// by relative path; the matching tsconfig lists that directory in `include`.
export default defineConfig({
  testDir: "./e2e",
  // Compiles the app once before any test; see e2e/warm-bundle.ts.
  globalSetup: "./e2e/warm-bundle.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8081",
    viewport: { width: 390, height: 844 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run web -- --port 8081",
    url: "http://127.0.0.1:8081",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
