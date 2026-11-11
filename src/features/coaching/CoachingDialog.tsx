import type { AppState } from '../../domain';
import { Modal } from '../../components';
import { browserConnections } from '../connections/browser';
import { useCoaching } from './useCoaching';
import CoachingPanel from './CoachingPanel';

export default function CoachingDialog({ records, onClose }: { records: AppState; onClose: () => void }) {
  const model = useCoaching(records, browserConnections, true);
  const download = () => {
    if (!model.state) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'rep-and-plate-coaching', version: 1, exportedAt: new Date().toISOString(), state: model.state }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'rep-and-plate-coaching.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <Modal title="Your coaching plan" onClose={onClose} wide>
    {model.state && model.freshness?.stale && <p className="coaching-source-note" role="status">Your coaching plan is saved. Activity and nutrition evidence may be incomplete or out of date; synchronize those records before using them to adjust the plan.</p>}
    <CoachingPanel state={model.state} brief={model.brief} weekly={model.weekly} loading={model.loading} busy={model.busy} error={model.error} notice={model.notice} onRefresh={() => void model.refresh()} onPropose={model.propose} onResolve={model.resolve} onUndo={model.undo} onRemoveRecord={model.removeRecord} />
    {model.state && <details className="coaching-disclosure"><summary>Keep a copy of your coaching record</summary><p>Download your last retrieved goals, plan, feedback, memories, records from other apps and decision history. This separate record includes historical values retained for review and undo.</p><button type="button" className="button secondary" onClick={download}>Download coaching record</button></details>}
  </Modal>;
}
