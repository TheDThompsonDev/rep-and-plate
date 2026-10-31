import { initialState, parseStoredState, stateSchema, type AppState } from '../domain';

/** A bad saved file must not be replaced with an empty account. Parsing goes
 * through the shared version table, so native and web accept the same files. */
export function restoreDeviceSnapshot(raw: string | null): AppState {
  if (raw === null) return initialState();
  const parsed = parseStoredState(raw);
  if (!parsed.ok) throw new Error('Your saved records could not be opened. Export a copy before restoring another backup.');
  const state = parsed.state;
  return { ...state, messages: state.messages.map(message => message.aiStatus === 'pending'
    ? { ...message, aiStatus: 'error', aiError: 'The app closed before this response finished. Retry this capture.' }
    : message) };
}

/** Serialize asynchronous native writes so an older save cannot replace newer data. */
export function serialWriter(write: (raw: string) => Promise<void>) {
  let tail = Promise.resolve();
  return (state: AppState) => {
    const raw = JSON.stringify(stateSchema.parse(state));
    const next = tail.catch(() => {}).then(() => write(raw));
    tail = next;
    return next;
  };
}
