// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  { ignores: ['dist/**', 'android/**', 'ios/**', '.expo/**', 'test-results/**'] },
  expoConfig,
  { files: ['*.cjs'], languageOptions: { globals: { __dirname: 'readonly' } } },
  {
    // Shared domain files live outside mobile/, so resolve their parser from
    // this package instead of from the parent web app's dependencies.
    // Vitest unit tests beside native modules import `vitest` from the root
    // package; its exports-only dependencies defeat the node resolver and the
    // configured `typescript` fallback is not installed, so skip resolving it.
    settings: { 'import/core-modules': ['vitest'], 'import/parsers': {
      '@typescript-eslint/parser': [],
      [require.resolve('@typescript-eslint/parser')]: ['.ts', '.tsx'],
    } },
  }
]);
