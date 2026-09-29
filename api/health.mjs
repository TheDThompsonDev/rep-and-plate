// The build bundles shared web/native TypeScript imports into one Node ESM file.
export { default } from '../.generated/health.mjs';
export const config = { api: { bodyParser: false } };
