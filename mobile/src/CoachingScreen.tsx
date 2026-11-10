import { useLoadedHealth } from './store';
import { nativeConnections } from './Connections';
import { useCoaching } from '../../src/features/coaching/useCoaching';
import NativeCoaching from './Coaching';

export function CoachingScreen() {
  const h = useLoadedHealth();
  const model = useCoaching(h.state, nativeConnections, true);
  return <NativeCoaching model={model} onClose={() => h.setTool(null)} />;
}
