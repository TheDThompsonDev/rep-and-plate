import type { IncomingMessage, ServerResponse } from 'node:http';
import { betaHandler } from './beta.ts';
import { betaServices } from './beta-services.ts';
import { handlePreview } from './preview-node.ts';
let handler: ReturnType<typeof betaHandler> | undefined;
export default async function health(req: IncomingMessage, res: ServerResponse) {
  try {
    if (await handlePreview(req, res, { ...process.env, VERCEL: '1' })) return;
    const url = new URL(req.url ?? '/', 'http://localhost');
    const endpoint = url.searchParams.get('endpoint');
    if (endpoint) req.url = `/api/${endpoint}`;
    handler ??= betaHandler(betaServices(process.env));
    await handler(req, res);
  } catch {
    if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'Beta service is not configured yet.' }));
  }
}
