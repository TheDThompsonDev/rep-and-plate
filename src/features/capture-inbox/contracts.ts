import { z } from 'zod';

export const CAPTURE_TEXT_LIMIT = 4000;
export const CAPTURE_IMAGE_BYTES = 8 * 1024 * 1024;
export const CAPTURE_INBOX_LIMIT = 30;
export const capturePurposeSchema = z.enum(['general', 'meal', 'receipt', 'menu', 'workout']);
export type CapturePurpose = z.infer<typeof capturePurposeSchema>;
export const captureItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().max(CAPTURE_TEXT_LIMIT),
  // Private media references are resolved by the existing account media layer.
  image: z.string().max(12 * 1024 * 1024).refine(value => /^data:image\/(?:jpeg|png|webp);base64,/.test(value) || /^rp-media:[a-zA-Z0-9/_.-]+$/.test(value), 'This saved photo reference is not supported.').optional(),
  createdAt: z.string().datetime(),
  purpose: capturePurposeSchema.default('general'),
  status: z.enum(['pending', 'saved']).default('pending'),
  capturePurpose: z.enum(["decide", "menu", "rough-meal", "clarify-meal"]).optional(),
}).refine(value => value.text.trim().length > 0 || !!value.image, 'Add a few words or a photo.');
export type CaptureItem = z.infer<typeof captureItemSchema>;
export const captureInboxSchema = z.array(captureItemSchema).max(CAPTURE_INBOX_LIMIT).refine(items => new Set(items.map(item => item.id)).size === items.length, 'Each saved capture must have a unique ID.');
export type CaptureSendResult = 'complete' | 'saved' | 'blocked' | 'busy';
