// `prelint` hook: install the TypeScript-6-pinned lint toolchain on first use.
// Cheap when already installed (one stat); otherwise runs `npm ci` here.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
if (!existsSync(join(here, "node_modules", "typescript-eslint", "package.json"))) {
  console.log("Installing lint toolchain in tools/typescript-eslint (one-time) ...");
  const result = spawnSync("npm ci", { cwd: here, stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
