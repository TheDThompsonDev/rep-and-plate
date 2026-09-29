import type { IncomingMessage, ServerResponse } from 'node:http';
import { previewEnabled, previewGate } from './preview-gate.ts';

export async function handlePreview(req: IncomingMessage, res: ServerResponse, env: Record<string, string | undefined>) {
  if (!previewEnabled(env)) return false;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value);
  }
  const protocol = env.VERCEL === '1' ? 'https' : 'http';
  const url = new URL(req.url ?? '/', `${protocol}://${req.headers.host ?? 'localhost'}`);
  let body: string | undefined;
  if (url.pathname === '/preview/access' && req.method === 'POST') {
    const parts: Buffer[] = [];
    let size = 0;
    for await (const part of req) {
      size += part.length;
      if (size > 2048) {
        res.writeHead(413, { 'Cache-Control': 'no-store' }).end('Access code is too long.');
        return true;
      }
      parts.push(Buffer.from(part));
    }
    body = Buffer.concat(parts).toString('utf8');
  }
  const response = await previewGate(new Request(url, { method: req.method, headers, body }), env);
  if (!response) return false;
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  return true;
}
