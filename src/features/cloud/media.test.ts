import {it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {recordMedia} from './media';
import {initialState} from '../../domain';
it('stores photos separately, reuses immutable references, and restores original bytes',async()=>{
 const upload=vi.fn().mockResolvedValue({error:null});const download=vi.fn().mockResolvedValue({data:new Blob(['photo']),error:null});
 const client={storage:{from:()=>({upload,download})}} as unknown as SupabaseClient;
 const user='11111111-1111-4111-8111-111111111111';const media=recordMedia(client,user);
 const s=initialState();s.messages[0].image='data:image/png;base64,cGhvdG8=';
 const encoded=await media.encode(s);expect(encoded.messages[0].image).toMatch(/^rp-media:/);expect(JSON.stringify(encoded)).not.toContain('cGhvdG8=');
 expect(await media.decode(encoded)).toEqual(s);await media.encode(s);expect(upload).toHaveBeenCalledOnce();
 const second=recordMedia(client,user);expect(await second.decode(encoded)).toEqual(s);expect(download).toHaveBeenCalledOnce();
 encoded.messages[0].image='rp-media:foreign/file.png';await expect(media.decode(encoded)).rejects.toThrow('verified');
});
it('failed photo upload prevents declaring the snapshot saved',async()=>{
 const media=recordMedia({storage:{from:()=>({upload:async()=>({error:{statusCode:'403'}})})}} as unknown as SupabaseClient,'test');const s=initialState();s.messages[0].image='data:image/png;base64,cGhvdG8=';
 await expect(media.encode(s)).rejects.toThrow('original remains');
});
it('does not interpret ordinary message text and notes as photo references',async()=>{
 const upload=vi.fn(),download=vi.fn();
 const media=recordMedia({storage:{from:()=>({upload,download})}} as unknown as SupabaseClient,'11111111-1111-4111-8111-111111111111');
 const state=initialState();state.messages[0].text='rp-media:foreign/file.png';state.profile.name='data:image/png;base64,cGhvdG8=';
 expect(await media.encode(state)).toEqual(state);expect(await media.decode(state)).toEqual(state);expect(upload).not.toHaveBeenCalled();expect(download).not.toHaveBeenCalled();
});
