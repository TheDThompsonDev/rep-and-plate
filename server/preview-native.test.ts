import {it,expect} from 'vitest';
import {previewGate} from './preview-gate';
const env={PRIVATE_PREVIEW:'on',PREVIEW_ACCESS_CODE:'test-invitation-long-enough-code'};
it('lets native bootstrap reach public auth config while protecting the website',async()=>{
 expect(await previewGate(new Request('https://repandplate.com/api/cloud/config'),env)).toBeNull();
 expect((await previewGate(new Request('https://repandplate.com/'),env))?.headers.get('content-type')).toContain('text/html');
});
it('delegates bearer API calls to account authorization, not browser cookies',async()=>{
 expect(await previewGate(new Request('https://repandplate.com/api/chat',{method:'POST',headers:{Authorization:'Bearer session-token'}}),env)).toBeNull();
 expect((await previewGate(new Request('https://repandplate.com/api/chat',{method:'POST'}),env))?.status).toBe(401);
 expect(await previewGate(new Request('https://repandplate.com/api/chat',{method:'OPTIONS'}),env)).toBeNull();
});
