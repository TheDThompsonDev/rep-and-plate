import { useEffect, useState, useSyncExternalStore } from 'react';
import { onBrowserRecordNotice, unreadableBrowserRecords, unreadableRecordsMessage } from './browser-records';

const currentMessage = () => {
  const notice = unreadableBrowserRecords();
  return notice ? unreadableRecordsMessage(notice) : null;
};

/** The app toast, mounted at the root: the same markup and class as App's own
 * `.toast`, so an unreadable snapshot is announced even while onboarding or a
 * sign-in screen owns the page. It appears once the aside copy has settled. */
export function BrowserRecordsNotice() {
  const message = useSyncExternalStore(onBrowserRecordNotice, currentMessage, () => null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setDismissed(message), 12000);
    return () => clearTimeout(timer);
  }, [message]);
  if (!message || dismissed === message) return null;
  return (
    <div className="toast" role="status">
      <span>{message}</span>
    </div>
  );
}
