import { next } from '@vercel/functions';
import { previewGate } from './server/preview-gate.ts';

export default async function middleware(request: Request) {
  const response = await previewGate(request, { ...process.env, VERCEL: '1' });
  return response ?? next({ headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } });
}

export const config = { matcher: '/:path*' };
