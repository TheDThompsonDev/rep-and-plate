import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIncomingShare } from 'expo-sharing';
import { CAPTURE_TEXT_LIMIT, type CaptureItem, type CapturePurpose, type CaptureSendResult } from '../../src/features/capture-inbox/contracts';
import { appendCapture, newCapture } from '../../src/features/capture-inbox/model';

type Props = {
  items: readonly CaptureItem[];
  scopeKey: string;
  createId: () => string;
  imageFromUri: (uri: string) => Promise<string>;
  onChange: (items: CaptureItem[]) => Promise<void> | void;
  onSend: (item: CaptureItem) => Promise<CaptureSendResult>;
  disabled?: boolean;
};
const choices: { value: CapturePurpose; label: string }[] = [
  { value: 'general', label: 'Help with this' }, { value: 'meal', label: 'I ate this' },
  { value: 'receipt', label: 'Groceries' }, { value: 'menu', label: 'Help me choose' }, { value: 'workout', label: 'Movement' },
];

/** Incoming shares are explicitly claimed by the current account before processing. */
export function IncomingShareInbox({ items, scopeKey, createId, imageFromUri, onChange, onSend, disabled = false }: Props) {
  const incoming = useIncomingShare();
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState(false);
  const [purpose, setPurpose] = useState<CapturePurpose>('general');
  const [showIncoming, setShowIncoming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const signature = useRef('');
  const scope = useRef(scopeKey);
  const generation = useRef(0);
  const { sharedPayloads, resolvedSharedPayloads, isResolving, clearSharedPayloads } = incoming;

  useEffect(() => {
    if (scope.current === scopeKey) return;
    scope.current = scopeKey; generation.current += 1; signature.current = '';
    setText(''); setImages([]); setPhotoError(false); setShowIncoming(false); setNotice(''); setBusy(null);
    clearSharedPayloads();
  }, [scopeKey, clearSharedPayloads]);

  useEffect(() => {
    if (isResolving || !sharedPayloads.length) return;
    const next = JSON.stringify(sharedPayloads.map(payload => [payload.shareType, payload.value]));
    if (signature.current === next) return;
    signature.current = next;
    const generationAtStart = ++generation.current;
    void Promise.resolve().then(() => {
    if (generationAtStart !== generation.current) return;
    const words = [...new Set(sharedPayloads.filter(payload => payload.shareType === 'text' || payload.shareType === 'url').map(payload => payload.value.trim()).filter(Boolean))].join('\n\n');
    const photos = resolvedSharedPayloads.filter(payload => payload.contentType === 'image' && payload.contentUri).map(payload => payload.contentUri!);
    const unsupported = sharedPayloads.filter(payload => !['text', 'url', 'image'].includes(payload.shareType));
    setShowIncoming(true); setExpanded(true); setText(words); setImages([]); setPhotoError(false); setPurpose('general');
    if (photos.length > 8) { setPhotoError(true); setNotice('Share up to eight photos at a time so each one can be reviewed. Nothing has been saved yet.'); return; }
    if (unsupported.length) setNotice('Photos, text and links can be saved. Other attached files have not been imported.');
    else setNotice(words.length > CAPTURE_TEXT_LIMIT ? 'This share is too long. Keep the part you want Spot to review before saving.' : 'Shared with Rep & Plate. Review it, then save it to this account.');
    if (photos.length) {
      setBusy('incoming');
      void Promise.all(photos.map(uri => imageFromUri(uri))).then(values => {
        if (generationAtStart === generation.current) setImages(values);
      }).catch(() => {
        if (generationAtStart === generation.current) { setPhotoError(true); setNotice('The shared photo could not be read. Share it again or use Chat’s photo button. Nothing has been saved.'); }
      }).finally(() => { if (generationAtStart === generation.current) setBusy(null); });
    } else if (sharedPayloads.some(payload => payload.shareType === 'image')) { setPhotoError(true); setNotice('This shared photo is still unavailable. Share it again or use Chat’s photo button.'); }
    });
  }, [sharedPayloads, resolvedSharedPayloads, isResolving, imageFromUri]);

  async function save() {
    if (busy || disabled || photoError) return;
    const generationAtStart = generation.current;
    setBusy('save');
    try {
      let next = [...items];
      if (images.length) for (const image of images) next = appendCapture(next, newCapture({ text, image, purpose }, createId()));
      else next = appendCapture(next, newCapture({ text, purpose }, createId()));
      await onChange(next);
      if (generationAtStart !== generation.current) return;
      clearSharedPayloads(); setShowIncoming(false); setText(''); setImages([]); setNotice('Saved to your inbox. Send it to Spot when you’re ready.');
    } catch (error) { if (generationAtStart === generation.current) setNotice(error instanceof Error ? error.message : 'Your capture could not be saved. Try again.'); }
    finally { if (generationAtStart === generation.current) setBusy(null); }
  }
  async function send(item: CaptureItem) {
    if (busy || disabled) return;
    const generationAtStart = generation.current;
    setBusy(item.id); setNotice('');
    try {
      const result = await onSend(item);
      if (generationAtStart !== generation.current) return;
      if (result === 'complete') { await onChange(items.filter(candidate => candidate.id !== item.id)); setNotice('Sent to Spot. Review proposed details in Chat before logging.'); }
      else if (result === 'saved') { await onChange(items.map(candidate => candidate.id === item.id ? { ...candidate, status: 'saved' } : candidate)); setNotice('This capture is saved. Retry when your connection is ready.'); }
      else setNotice(result === 'busy' ? 'Spot is finishing another capture. This one is saved.' : 'This capture is saved. Check your account or connection before retrying.');
    } catch { if (generationAtStart === generation.current) setNotice('This capture is still saved. Try sending it again when you’re ready.'); }
    finally { if (generationAtStart === generation.current) setBusy(null); }
  }
  async function remove(id: string) {
    if (busy || disabled) return;
    setBusy(id);
    try { await onChange(items.filter(item => item.id !== id)); setNotice('Capture removed.'); }
    catch { setNotice('This capture could not be removed. Try again.'); }
    finally { setBusy(null); }
  }

  if (!items.length && !showIncoming && !notice && !incoming.error) return null;
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.row}>
      <Text style={styles.heading}>Send to Spot</Text><Text style={styles.muted}>{items.length} saved</Text>
    </Pressable>
    {expanded && <View style={styles.body}>
      {showIncoming && <View style={styles.incoming}>
        <Text style={styles.label}>Shared with Rep & Plate</Text>
        <Text style={styles.copy}>Review this capture before saving it to your current account.</Text>
        <TextInput accessibilityLabel="Shared capture text" multiline value={text} onChangeText={setText} style={styles.input} placeholder="Add a few words…"/>
        <View style={styles.choices}>{choices.map(choice => <Pressable key={choice.value} accessibilityRole="button" accessibilityState={{ selected: purpose === choice.value }} onPress={() => setPurpose(choice.value)} style={[styles.choice, purpose === choice.value && styles.selected]}><Text style={styles.choiceText}>{choice.label}</Text></Pressable>)}</View>
        {images.length > 0 && <View style={styles.choices}>{images.map((image, index) => <Image key={index} source={{ uri: image }} accessibilityLabel={`Shared photo ${index + 1}`} style={styles.image}/>)}</View>}
        <View style={styles.row}><Pressable accessibilityRole="button" disabled={!!busy || disabled || photoError || text.length > CAPTURE_TEXT_LIMIT || (!text.trim() && !images.length)} onPress={() => void save()} style={[styles.primary, (!!busy || disabled || photoError) && styles.disabled]}><Text style={styles.primaryText}>{busy === 'incoming' ? 'Reading photos…' : busy === 'save' ? 'Saving…' : 'Save to my inbox'}</Text></Pressable><Pressable accessibilityRole="button" disabled={!!busy} onPress={() => { clearSharedPayloads(); generation.current += 1; setText(''); setImages([]); setPhotoError(false); setShowIncoming(false); setNotice('Shared capture dismissed.'); }} style={styles.secondary}><Text style={styles.secondaryText}>Dismiss</Text></Pressable></View>
      </View>}
      {items.map(item => <View key={item.id} style={styles.item}>
        <Text style={styles.label}>{choices.find(choice => choice.value === item.purpose)?.label ?? 'Capture'}</Text>
        <Text style={styles.copy} numberOfLines={3}>{item.text || 'Photo capture'}</Text>
        <Text style={styles.muted}>{item.image ? 'Photo attached · ' : ''}{new Date(item.createdAt).toLocaleString()}</Text>
        <View style={styles.row}><Pressable accessibilityRole="button" disabled={!!busy || disabled} onPress={() => void send(item)} style={[styles.primary, (!!busy || disabled) && styles.disabled]}><Text style={styles.primaryText}>{busy === item.id ? 'Working…' : item.status === 'saved' ? 'Retry with Spot' : 'Send to Spot'}</Text></Pressable><Pressable accessibilityRole="button" disabled={!!busy || disabled} onPress={() => void remove(item.id)} style={styles.secondary}><Text style={styles.secondaryText}>Remove</Text></Pressable></View>
      </View>)}
      <Text style={styles.muted}>Saving a capture doesn’t log food, change your pantry or record a workout.</Text>
    </View>}
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
    {incoming.error ? <Text style={styles.notice}>Shared content could not be opened. You can attach it in Chat.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { marginVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: '#dcebe4', backgroundColor: '#fff', padding: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, minHeight: 44 },
  heading: { color: '#173c31', fontSize: 16, fontWeight: '700', flex: 1 }, muted: { color: '#557469', fontSize: 12, lineHeight: 18 },
  body: { gap: 12, marginTop: 10 }, incoming: { gap: 10 }, label: { color: '#173c31', fontSize: 14, fontWeight: '700' }, copy: { color: '#365e4f', fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: '#cddfd5', borderRadius: 12, padding: 12, color: '#173c31', fontSize: 16, minHeight: 80, textAlignVertical: 'top' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#dcebe4', paddingHorizontal: 12, justifyContent: 'center' }, selected: { backgroundColor: '#dcefe4', borderColor: '#438a6d' }, choiceText: { color: '#173c31', fontSize: 13 },
  image: { width: 72, height: 72, borderRadius: 10 }, item: { borderTopWidth: 1, borderTopColor: '#e3ede7', paddingTop: 12, gap: 6 },
  primary: { minHeight: 44, borderRadius: 12, backgroundColor: '#006249', paddingHorizontal: 14, justifyContent: 'center' }, primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondary: { minHeight: 44, borderRadius: 12, backgroundColor: '#eff6f1', paddingHorizontal: 14, justifyContent: 'center' }, secondaryText: { color: '#365e4f', fontSize: 14 }, disabled: { opacity: .5 }, notice: { color: '#365e4f', fontSize: 13, lineHeight: 19, marginTop: 10 },
});
