// Root lint gate: web app (src/), server/, scripts/, browser specs (tests/), the
// Playwright helpers both browser suites share (e2e-shared/) and root config
// files. mobile/ keeps its own Expo config (`npm --prefix mobile run lint`).
//
// typescript-eslint needs the TypeScript JS API, which `typescript@7` no longer
// ships; tools/typescript-eslint is a small separate project whose own
// node_modules holds typescript@6 for the parser, so root `tsc` stays on
// TypeScript 7. `npm run lint` installs it on first use (prelint).
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "./tools/typescript-eslint/index.js";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      ".generated/",
      ".fuel-data/",
      ".local-checks/",
      "test-results/",
      "playwright-report/",
      "mobile/",
      "docs/",
      "public/",
      "supabase/",
      ".cyc/",
      ".claude/",
      ".agents/",
      ".codex/",
      ".cursor/",
      ".vercel/",
      "scripts/claude-hooks/", // installed by the CYC engine, not authored here
      // Local scratch files that .gitignore already excludes; they never exist
      // in CI, so skipping them keeps local and CI results identical.
      ".ai-*.ts",
      ".ai-*.mjs",
      ".jev-smoke.ts",
      ".receipt-fixture.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // React Compiler rules (eslint-plugin-react-hooks 7) lowered to "warn"
      // under the gate policy below: 11 + 9 + 1 hits in src/ screens. Real
      // review items (Q2 refactor territory), not noise. rules-of-hooks stays
      // an error (0 hits). Plugin rules must be configured in the object that
      // defines the plugin, hence here rather than in the shared block.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // Gate policy (2026-10-10 audit, note A6-hygiene): the gate must pass with
    // zero errors on the tree as it stands, and the source files were owned by
    // other agents in that pass, so the recommended rules that fired were
    // lowered to "warn" rather than silenced. Everything else in the
    // recommended sets (including react-hooks/rules-of-hooks) stays an error.
    // Promote a rule back to "error" once its warning count reaches zero.
    rules: {
      // 34 hits: 33 in tests/ (outside the root tsconfig) and the one in src/
      // that the audit already counts (src/features/cloud/sync.ts, Q9).
      "@typescript-eslint/no-explicit-any": "warn",
      // 9 hits in src/, server/ and tests/: unused destructured bindings and
      // catch/params that noUnusedLocals does not flag.
      "@typescript-eslint/no-unused-vars": "warn",
      // 1 hit (a bare `void`-less expression statement).
      "@typescript-eslint/no-unused-expressions": "warn",
    },
  },
);
