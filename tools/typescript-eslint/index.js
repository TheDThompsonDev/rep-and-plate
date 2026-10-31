// Re-exports typescript-eslint from this directory's own node_modules, where
// `typescript` is 6.x (the JS compiler API). The root typescript@7 package only
// provides the native `tsc`. Imported by ../../eslint.config.js.
let toolchain;
try {
  toolchain = await import("typescript-eslint");
} catch (error) {
  throw new Error(
    "Lint toolchain is not installed. Run `npm run lint` (its prelint step installs tools/typescript-eslint) " +
      "or `npm ci` inside tools/typescript-eslint. Cause: " + (error && error.message),
  );
}
export default toolchain.default;
export const config = toolchain.config;
export const configs = toolchain.configs;
export const parser = toolchain.parser;
export const plugin = toolchain.plugin;
