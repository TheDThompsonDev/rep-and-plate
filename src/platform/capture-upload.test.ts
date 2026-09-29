import { it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadCapture } from './capture-upload';
it('uploads private media under the account and keeps the JSON request small', async () => {
  let uploaded = '', removed = ''; const bytes = Buffer.from('receipt-image');
  const client = { storage: { from: (bucket: string) => {
    expect(bucket).toBe('health-captures');
    return {
      upload: async (path: string, value: ArrayBuffer, options: { contentType: string }) => {
        uploaded = path; expect(Buffer.from(value)).toEqual(bytes); expect(options.contentType).toBe('image/jpeg'); return { error: null };
      },
      remove: async (paths: string[]) => { removed = paths[0]; return { error: null }; },
    };
  } } } as unknown as SupabaseClient;
  const result = await uploadCapture(client, 'account-a', { text: 'Groceries', image: `data:image/jpeg;base64,${bytes.toString('base64')}` });
  expect(uploaded).toMatch(/^account-a\/[a-f0-9-]+\.jpg$/);
  expect(result.body).toEqual({ text: 'Groceries', capture: { path: uploaded, kind: 'image' } });
  await result.cleanup(); expect(removed).toBe(uploaded);
});
it('leaves text-only requests alone without uploading anything', async () => {
  const body = { text: 'Hello' };
  const result = await uploadCapture({} as SupabaseClient, 'account', body);
  expect(result.body).toBe(body); await result.cleanup();
});
