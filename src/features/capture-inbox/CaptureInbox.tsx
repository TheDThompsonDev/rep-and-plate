import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { ImagePlus, Inbox, Send, Trash2, X } from 'lucide-react';
import { CAPTURE_IMAGE_BYTES, CAPTURE_TEXT_LIMIT, type CaptureItem, type CapturePurpose, type CaptureSendResult } from './contracts';
import { appendCapture, clearShareParameters, newCapture, readSharedCapture } from './model';
import './capture-inbox.css';

const purposeNames: Record<CapturePurpose, string> = {
  general: 'Help me with this', meal: 'Food I ate', receipt: 'Groceries I bought', menu: 'Help me choose', workout: 'Movement I did',
};
export type CaptureInboxProps = {
  items: readonly CaptureItem[];
  /** Resolve after the account-scoped record has been persisted. */
  onChange: (items: CaptureItem[]) => Promise<void> | void;
  /** Reuse item.id as the existing chat request ID on every retry. */
  onSend: (item: CaptureItem) => Promise<CaptureSendResult>;
  scopeKey?: string;
  disabled?: boolean;
};

export function CaptureInbox({ items, onChange, onSend, scopeKey = 'device', disabled = false }: CaptureInboxProps) {
  const [incoming] = useState(() => typeof window === 'undefined' ? null : readSharedCapture(window.location.href));
  const [expanded, setExpanded] = useState(!!incoming);
  const [unclaimed, setUnclaimed] = useState(!!incoming);
  const [text, setText] = useState(incoming?.text ?? '');
  const [image, setImage] = useState<string>();
  const [purpose, setPurpose] = useState<CapturePurpose>('general');
  const [notice, setNotice] = useState(incoming?.error ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const scope = useRef(scopeKey);
  const generation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (scope.current === scopeKey) return;
    scope.current = scopeKey;
    generation.current += 1;
    setText(''); setImage(undefined); setNotice(''); setBusy(null); setExpanded(false); setUnclaimed(false);
    window.history.replaceState(window.history.state, '', clearShareParameters(window.location.href));
  }, [scopeKey]);

  async function attach(file?: File) {
    if (!file) return;
    const current = generation.current;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('Choose a JPEG, PNG or WebP photo.');
      if (file.size > CAPTURE_IMAGE_BYTES) throw Error('Choose a photo smaller than 8 MB.');
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(Error('That photo could not be read.'));
        reader.onerror = () => reject(Error('That photo could not be read.'));
        reader.readAsDataURL(file);
      });
      if (current !== generation.current) return;
      setImage(result); setExpanded(true); setNotice('Photo attached. Save it to keep it in your inbox.');
    } catch (error) { if (current === generation.current) setNotice(error instanceof Error ? error.message : 'That photo could not be read.'); }
  }

  async function saveDraft() {
    if (busy || disabled) return;
    const current = generation.current;
    setBusy('save');
    try {
      const item = newCapture({ text, image, purpose });
      await onChange(appendCapture(items, item));
      if (current !== generation.current) return;
      setText(''); setImage(undefined); setPurpose('general'); setUnclaimed(false); setNotice('Saved to your inbox. Send it to Spot whenever you’re ready.');
      window.history.replaceState(window.history.state, '', clearShareParameters(window.location.href));
    } catch (error) { if (current === generation.current) setNotice(error instanceof Error ? error.message : 'Your capture could not be saved. Keep this screen open and try again.'); }
    finally { if (current === generation.current) setBusy(null); }
  }

  async function send(item: CaptureItem) {
    if (busy || disabled) return;
    if (!online) { setNotice('This capture is saved. Send it to Spot when you’re back online.'); return; }
    const current = generation.current;
    setBusy(item.id); setNotice('');
    try {
      const result = await onSend(item);
      if (current !== generation.current) return;
      if (result === 'complete') {
        await onChange(items.filter(candidate => candidate.id !== item.id));
        setNotice('Sent to Spot. Review any proposed details in Chat before logging.');
      } else if (result === 'saved') {
        await onChange(items.map(candidate => candidate.id === item.id ? { ...candidate, status: 'saved' } : candidate));
        setNotice('Your capture is still saved. Retry when the connection is ready.');
      } else setNotice(result === 'busy' ? 'Spot is finishing another capture. This one is saved for later.' : 'This capture is saved. Check your account or connection, then try again.');
    } catch { if (current === generation.current) setNotice('This capture is still saved. Try sending it again when you’re ready.'); }
    finally { if (current === generation.current) setBusy(null); }
  }

  async function remove(id: string) {
    if (busy || disabled) return;
    setBusy(id);
    try { await onChange(items.filter(item => item.id !== id)); setNotice('Capture removed.'); }
    catch { setNotice('This capture could not be removed. Try again.'); }
    finally { setBusy(null); }
  }

  function paste(event: ClipboardEvent<HTMLElement>) {
    const file = [...event.clipboardData.files].find(item => item.type.startsWith('image/'));
    if (file) { event.preventDefault(); void attach(file); }
  }
  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const file = [...event.dataTransfer.files].find(item => item.type.startsWith('image/'));
    if (file) void attach(file);
  }

  return <section className="capture-inbox" aria-label="Saved captures" onPaste={paste} onDragOver={event => event.preventDefault()} onDrop={drop}>
    <button className="capture-inbox-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      <Inbox size={18} aria-hidden="true"/><span>Send to Spot</span><small>{items.length ? `${items.length} saved` : 'Save something for later'}</small>
    </button>
    {expanded && <div className="capture-inbox-body">
      <p>Save a photo, screenshot, link or a few words. You choose when Spot reviews it.</p>
      <form onSubmit={event => { event.preventDefault(); void saveDraft(); }}>
        <label>What happened?<textarea value={text} maxLength={CAPTURE_TEXT_LIMIT} onChange={event => setText(event.target.value)} placeholder="Paste an order, describe a meal, or save a question…" rows={3}/></label>
        <label>What is this for?<select value={purpose} onChange={event => setPurpose(event.target.value as CapturePurpose)}>{Object.entries(purposeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {image && <div className="capture-image-preview"><img src={image} alt="Your capture preview"/><button type="button" aria-label="Remove attached photo" onClick={() => setImage(undefined)}><X size={16}/></button></div>}
        <input hidden ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void attach(event.target.files?.[0]); event.target.value = ''; }}/>
        <div className="capture-inbox-actions">
          <button className="button secondary" type="button" disabled={!!busy || disabled} onClick={() => fileInput.current?.click()}><ImagePlus size={16}/>Add photo</button>
          <button className="button primary" type="submit" disabled={!!busy || disabled || (!text.trim() && !image)}>{busy === 'save' ? 'Saving…' : unclaimed ? 'Save to my inbox' : 'Save capture'}</button>
          {unclaimed && <button className="button secondary" type="button" disabled={!!busy || disabled} onClick={() => { setText(''); setImage(undefined); setUnclaimed(false); setNotice('Shared capture dismissed.'); window.history.replaceState(window.history.state, '', clearShareParameters(window.location.href)); }}>Dismiss share</button>}
        </div>
      </form>
      {!online && <p className="capture-inbox-offline">You’re offline. Saved captures stay here until you send them.</p>}
      {items.length > 0 && <ul className="capture-inbox-list">{items.map(item => <li key={item.id}>
        <div>{item.image?.startsWith('data:image/') ? <img src={item.image} alt="Saved capture"/> : item.image ? <span className="capture-inbox-photo-label">Photo attached</span> : null}<span><strong>{purposeNames[item.purpose]}</strong><span className="capture-inbox-text">{item.text || 'Photo capture'}</span><small>{new Date(item.createdAt).toLocaleString()}{item.status === 'saved' ? ' · Ready to retry' : ''}</small></span></div>
        <div className="capture-inbox-actions"><button className="button secondary" type="button" disabled={!!busy || disabled || !online} onClick={() => void send(item)}><Send size={15}/>{busy === item.id ? 'Working…' : item.status === 'saved' ? 'Retry with Spot' : 'Send to Spot'}</button><button className="capture-inbox-remove" type="button" disabled={!!busy || disabled} aria-label={`Remove saved capture: ${item.text.slice(0,60) || 'photo'}`} onClick={() => void remove(item.id)}><Trash2 size={16}/></button></div>
      </li>)}</ul>}
      <small>Saving a capture doesn’t log food, change your pantry or record a workout.</small>
    </div>}
    {notice && <p className="capture-inbox-notice" role="status">{notice}</p>}
  </section>;
}
