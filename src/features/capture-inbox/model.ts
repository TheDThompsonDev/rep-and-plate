import { CAPTURE_IMAGE_BYTES, CAPTURE_INBOX_LIMIT, CAPTURE_TEXT_LIMIT, captureItemSchema, type CaptureItem, type CapturePurpose } from './contracts';

export function validateCaptureImage(image: string): string {
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match || match[1].length % 4 !== 0) throw Error('Choose a JPEG, PNG or WebP photo.');
  const padding = match[1].endsWith('==') ? 2 : match[1].endsWith('=') ? 1 : 0;
  if (match[1].length * 3 / 4 - padding > CAPTURE_IMAGE_BYTES) throw Error('Choose a photo smaller than 8 MB.');
  return image;
}

export function newCapture(input: { text: string; image?: string; purpose: CapturePurpose }, id: string = crypto.randomUUID(), at = new Date().toISOString()): CaptureItem {
  const text = input.text.trim();
  if (text.length > CAPTURE_TEXT_LIMIT) throw Error('Keep your capture under 4,000 characters.');
  if (input.image) validateCaptureImage(input.image);
  return captureItemSchema.parse({ id, text, image: input.image, purpose: input.purpose, createdAt: at, status: 'pending' });
}

export function appendCapture(items: readonly CaptureItem[], capture: CaptureItem): CaptureItem[] {
  const saved = captureItemSchema.parse(capture);
  if (items.some(item => item.id === saved.id)) return [...items];
  if (items.length >= CAPTURE_INBOX_LIMIT) throw Error('Your inbox is full. Finish or remove a saved capture first.');
  return [...items, saved];
}

export type SharedCapture = { text: string; error?: string };
/** Shared content is a draft. Parsing never writes records or calls AI. */
export function readSharedCapture(input: string): SharedCapture | null {
  const url = new URL(input, 'https://repandplate.com');
  if (url.searchParams.get('share') !== '1') return null;
  const title = url.searchParams.get('title')?.trim() ?? '';
  const text = url.searchParams.get('text')?.trim() ?? '';
  const link = url.searchParams.get('url')?.trim() ?? '';
  if (link) {
    try { if (!['https:', 'http:'].includes(new URL(link).protocol)) return { text: '', error: 'This shared link is not supported. Paste the details instead.' }; }
    catch { return { text: '', error: 'This shared link could not be read. Paste the details instead.' }; }
  }
  const combined = [...new Set([title, text, link].filter(Boolean))].join('\n\n');
  if (combined.length > CAPTURE_TEXT_LIMIT) return { text: '', error: 'This share is too long. Paste the part you want Spot to review.' };
  return { text: combined };
}

export function clearShareParameters(input: string): string {
  const url = new URL(input, 'https://repandplate.com');
  if (url.searchParams.get('share') === '1') for (const key of ['share', 'title', 'text', 'url']) url.searchParams.delete(key);
  return `${url.pathname}${url.search}${url.hash}`;
}
