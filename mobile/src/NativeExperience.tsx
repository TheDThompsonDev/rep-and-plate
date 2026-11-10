import { View } from 'react-native';
import { useLoadedHealth } from './store';
import { Button } from './ui';
import { NativeDailyExperience } from './DailyCompanion';
import { IncomingShareInbox } from './IncomingShareInbox';
import { photoFromUri } from './Capture';
import { saveDevice } from './storage';
import { hasFirstLog } from '../../src/features/onboarding/first-log';
import { id } from '../../src/domain';
import type { CaptureItem } from '../../src/features/capture-inbox/contracts';

export function NativeExperience() {
  const h = useLoadedHealth();
  async function saveInbox(items: CaptureItem[]) {
    const scope = h.recordScope();
    if (!h.change(state => ({ ...state, captureInbox: items }))) throw Error('Your account records are still loading.');
    const next = h.readyRecords(); if (!next) throw Error('Your records are still loading.');
    await saveDevice(next);
    if (scope !== h.recordScope()) throw Error('Your account changed. Open your inbox again.');
  }
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button secondary label="Coaching plan" onPress={() => h.setTool('coaching')} /><Button secondary label="Food help" onPress={() => h.setTool('foodHelp')} /><Button secondary label="Life right now" onPress={() => h.setTool('lifeContext')} /></View>
    {hasFirstLog(h.state) && <NativeDailyExperience onDecide={() => h.setTool('foodHelp')} onLifeContext={() => h.setTool('lifeContext')} />}
    <IncomingShareInbox items={h.state.captureInbox ?? []} scopeKey={String(h.recordsRevision)} createId={id} imageFromUri={photoFromUri} onChange={saveInbox} disabled={h.busy} onSend={item => h.send(item.text || (item.purpose === 'menu' ? 'Help me choose from this menu. I have not eaten it.' : item.purpose === 'meal' ? 'Estimate this food I ate.' : item.purpose === 'receipt' ? 'These are groceries I bought, separate from food eaten.' : 'Help me interpret this capture without assuming consumption.'), item.image, undefined, item.capturePurpose ?? (item.purpose === 'menu' ? 'menu' : undefined), item.id)} />
  </View>;
}
