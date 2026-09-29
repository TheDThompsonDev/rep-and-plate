// Installed as scripts/claude-hooks/cyc.mjs in the consuming project.
// Resolve from this file so nested working directories and moved clones work.
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const engine = resolve(root, '.cyc/engine/scripts/response-hook.mjs');
process.argv = [process.execPath, engine, 'claude', '--project', root];
await import(pathToFileURL(engine).href);
