import { describe, expect, it } from 'vitest';
import { initialState } from '../domain';
import { restoreDeviceSnapshot, serialWriter } from './snapshot';
describe('native record persistence', () => {
  it('preserves records, flags interrupted responses and rejects corrupt data', () => {
    const state = initialState();
    state.messages.push({ id:'pending',role:'user',text:'My receipt',time:'10 AM',aiStatus:'pending',image:'data:image/png;base64,abc' });
    const result = restoreDeviceSnapshot(JSON.stringify(state));
    expect(result.messages.at(-1)).toMatchObject({text:'My receipt',image:'data:image/png;base64,abc',aiStatus:'error'});
    expect(result.meals).toEqual(state.meals);
    expect(()=>restoreDeviceSnapshot('{')).toThrow();
    expect(()=>restoreDeviceSnapshot('{}')).toThrow();
    expect(restoreDeviceSnapshot(null).meals).toHaveLength(0);
  });
  it('orders saves and recovers after storage failures without overwriting the newest snapshot', async () => {
    const writes:string[]=[]; let attempt=0;
    const save=serialWriter(async raw=>{ if(++attempt===1)throw new Error('disk'); writes.push(raw); });
    const first=save(initialState());
    const latest=initialState();latest.profile.name='Latest';
    const second=save(latest);
    await expect(first).rejects.toThrow('disk');await second;
    expect(JSON.parse(writes[0]).profile.name).toBe('Latest');
  });
});
