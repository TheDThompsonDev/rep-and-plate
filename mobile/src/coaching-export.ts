import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { cloudEpoch } from '../../src/features/cloud/sync-control';
import { coachingStateSchema, type CoachingState } from '../../src/features/coaching/contracts';

/** Exports the retrieved coaching document, never a connection or account snapshot. */
export async function shareCoachingRecord(state: CoachingState): Promise<void> {
  const epoch = cloudEpoch();
  const requireCurrentAccount = () => {
    if (epoch !== cloudEpoch()) throw Error('Your account changed. Refresh your coaching record before exporting.');
  };
  const json = JSON.stringify({
    format: 'rep-and-plate-coaching',
    version: 1,
    exportedAt: new Date().toISOString(),
    state: coachingStateSchema.parse(state),
  }, null, 2);
  requireCurrentAccount();
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    try {
      requireCurrentAccount();
      const link = document.createElement('a');
      link.href = url;
      link.download = 'rep-and-plate-coaching.json';
      link.click();
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    return;
  }
  const available = await Sharing.isAvailableAsync();
  requireCurrentAccount();
  if (!available) throw Error('Sharing is unavailable on this device. Open your coaching record on the web to download it.');
  if (!FileSystem.cacheDirectory) throw Error('Temporary storage is unavailable. Try again when device storage is available.');
  const uri = `${FileSystem.cacheDirectory}rep-and-plate-coaching-${Crypto.randomUUID()}.json`;
  try {
    requireCurrentAccount();
    await FileSystem.writeAsStringAsync(uri, json);
    requireCurrentAccount();
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Keep a copy of your coaching record' });
    requireCurrentAccount();
  } finally {
    // Remove only this export's unique temporary file after the sheet finishes.
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
}
