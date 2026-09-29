import { build } from 'esbuild';
await build({
  entryPoints: ['server/vercel-entry.ts'],
  outfile: '.generated/health.mjs',
  platform: 'node', target: 'node24', format: 'esm', bundle: true,
  packages: 'external', sourcemap: false,
});
console.log('Hosted API bundled for Node 24.');
