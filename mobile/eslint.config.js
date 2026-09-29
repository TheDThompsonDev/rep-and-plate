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
    settings: { 'import/parsers': {
      '@typescript-eslint/parser': [],
      [require.resolve('@typescript-eslint/parser')]: ['.ts', '.tsx'],
    } },
  }
]);
