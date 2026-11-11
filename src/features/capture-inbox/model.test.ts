import { describe, expect, it } from 'vitest';
import { appendCapture, clearShareParameters, newCapture, readSharedCapture, validateCaptureImage } from './model';
import { captureInboxSchema } from './contracts';

const id = '5a80c489-1549-4dca-8bc3-622ad7d750aa';
const at = '2026-11-08T12:00:00.000Z';
describe('saved capture intake', () => {
  it('keeps the stable capture ID when a queued item is retried', () => {
    const item = newCapture({ text: 'My lunch order', purpose: 'general' }, id, at);
    expect(appendCapture([item], { ...item, text: 'duplicate retry' })).toEqual([item]);
    expect(item.status).toBe('pending');
  });
  it('rejects empty and oversized captures without silently truncating evidence', () => {
    expect(() => newCapture({ text: ' ', purpose: 'general' }, id, at)).toThrow();
    expect(() => newCapture({ text: 'x'.repeat(4001), purpose: 'general' }, id, at)).toThrow(/4,000/);
  });
  it('accepts private media references after account media has saved the image', () => {
    const item = { id, createdAt: at, text: '', image: 'rp-media:owner/hash.png', purpose: 'meal', status: 'saved' };
    expect(captureInboxSchema.safeParse([item]).success).toBe(true);
    expect(captureInboxSchema.safeParse([item, item]).success).toBe(false);
  });
  it('requires an actual supported image for a new upload', () => {
    expect(validateCaptureImage('data:image/png;base64,aGVsbG8=')).toContain('data:image/png');
    expect(() => validateCaptureImage('data:text/html;base64,aGVsbG8=')).toThrow();
    expect(() => validateCaptureImage('rp-media:someone/other.png')).toThrow();
  });
  it('only interprets an explicit share route and leaves it as a draft', () => {
    expect(readSharedCapture('https://repandplate.com/?text=hello')).toBeNull();
    expect(readSharedCapture('https://repandplate.com/?share=1&title=Lunch&text=Lunch&url=https%3A%2F%2Fexample.com')).toEqual({ text: 'Lunch\n\nhttps://example.com' });
    expect(readSharedCapture('https://repandplate.com/?share=1&url=javascript%3Aalert(1)')?.error).toBeTruthy();
    expect(readSharedCapture('https://repandplate.com/?share=1&text='+ 'x'.repeat(4001))?.error).toBeTruthy();
  });
  it('removes shared content from the address bar while preserving other routes', () => {
    expect(clearShareParameters('https://repandplate.com/?share=1&text=private&other=1#chat')).toBe('/?other=1#chat');
  });
});
