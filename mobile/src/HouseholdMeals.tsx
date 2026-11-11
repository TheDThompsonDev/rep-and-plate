import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Button, Field, Choice, Sheet, Card, s } from './ui';
import { cloudClient } from './api';
import { requireDeviceOwner } from './auth';
import { createHouseholdClient } from '../../src/features/household/shared-client';
import { householdMealProposal, householdPortionsSchema, portionNutrition } from '../../src/features/household/domain';
import type {
  HouseholdBatchCandidate, HouseholdMealProposal, HouseholdReservation,
  HouseholdState, HouseholdTransfer, SharedHouseholdBatch,
} from '../../src/features/household/contracts';

const api = createHouseholdClient({ getClient: cloudClient, verifyOwner: requireDeviceOwner });
const emptyState: HouseholdState = { households: [], batches: [], reservations: [] };
type Review = { batch: SharedHouseholdBatch; portions: string; requestKey: string; reservation?: HouseholdReservation };
const requestKey = () => `portion-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function HouseholdMeals({ candidates, loggedReservationIds, displayName = '', onPublished, onLogMeal, onClose }: {
  candidates: HouseholdBatchCandidate[];
  loggedReservationIds: string[];
  displayName?: string;
  onPublished: (transfer: HouseholdTransfer) => void;
  onLogMeal: (proposal: HouseholdMealProposal) => boolean | Promise<boolean>;
  onClose: () => void;
}) {
  const [remote, setRemote] = useState<HouseholdState>(emptyState);
  const [selected, setSelected] = useState('');
  const [memberName, setMemberName] = useState(displayName);
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(true);
  const [review, setReview] = useState<Review | null>(null);
  const [publishId, setPublishId] = useState('');
  const [memberReview, setMemberReview] = useState<{ kind: 'remove' | 'owner' | 'leave'; userId?: string; name?: string } | null>(null);
  const alive = useRef(true);
  const published = useRef(new Set<string>());
  const publishCallback = useRef(onPublished);
  useEffect(() => { publishCallback.current = onPublished; }, [onPublished]);

  async function refresh() {
    const data = await api.loadHouseholdState();
    if (!alive.current) return;
    for (const batch of data.batches) {
      if (!batch.sourceBatchId || published.current.has(batch.id)) continue;
      publishCallback.current({ sourceBatchId: batch.sourceBatchId, householdBatchId: batch.id, portions: batch.totalPortions });
      published.current.add(batch.id);
    }
    setRemote(data);
    setSelected(current => data.households.some(household => household.id === current) ? current : data.households[0]?.id ?? '');
  }
  useEffect(() => {
    alive.current = true;
    let unsubscribe: (() => void) | undefined;
    void refresh().catch(reason => { if (alive.current) setError(reason instanceof Error ? reason.message : 'Household meals could not load.'); })
      .finally(() => { if (alive.current) setBusy(false); });
    void cloudClient().then(client => {
      if (!client || !alive.current) return;
      let previous: string | null | undefined;
      const listener = client.auth.onAuthStateChange((_event, session) => {
        const userId = session?.user.id ?? null;
        if (previous !== undefined && previous !== userId && alive.current) {
          setRemote(emptyState); setReview(null); setInvite('');
          setError('Your account changed. Close household meals and open it again.');
        }
        previous = userId;
      });
      unsubscribe = () => listener.data.subscription.unsubscribe();
    }).catch(() => { /* The initial request reports connection errors. */ });
    return () => { alive.current = false; unsubscribe?.(); };
  }, []);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Household sharing could not finish.'); }
    finally { if (alive.current) setBusy(false); }
  }
  const household = remote.households.find(item => item.id === selected);
  const batches = remote.batches.filter(batch => batch.householdId === selected);
  const availableBatches = batches.filter(batch => batch.remainingPortions > 0);
  const pending = remote.reservations.filter(reservation => reservation.status === 'reserved' && reservation.householdId === selected);
  const previousPending = remote.reservations.filter(reservation => reservation.status === 'reserved' && !remote.households.some(item => item.id === reservation.householdId));
  const selectedCandidate = candidates.find(candidate => candidate.id === publishId);
  const portions = Number(review?.portions);
  const validPortion = !!review && householdPortionsSchema.safeParse(portions).success &&
    (review.reservation ? portions === review.reservation.portions : portions <= review.batch.remainingPortions);
  const preview = review && validPortion ? portionNutrition(review.batch.perPortion, portions) : null;

  async function logPortion() {
    if (!review || !validPortion) return;
    const reservation = review.reservation ?? await api.reserveHouseholdPortions(review.batch.id, portions, review.requestKey);
    if (reservation.status === 'released') throw Error('This portion was already returned. Review another portion.');
    setReview({ ...review, reservation, portions: String(reservation.portions) });
    const saved = await onLogMeal(householdMealProposal(review.batch, reservation));
    if (!saved) throw Error('Your portion is reserved. Finish saving it here, or return the unlogged portion.');
    try { await api.markHouseholdPortionLogged(reservation.id); }
    catch { setNotice('Your private meal is saved. Confirm the same saved entry if it still appears below.'); await refresh(); setReview(null); return; }
    await refresh(); setReview(null); setNotice('Logged privately. Your shared portions are updated.');
  }

  return <Sheet title="Household meals" onClose={onClose}>
    <View style={{ gap: 16 }}>
      <Text style={s.muted}>Cook once. Share prepared food. Each person logs their own portion privately. Your diary, goals, measurements and workouts stay in your account.</Text>
      {!!error && <Text accessibilityRole="alert" style={{ color: '#8a2d24' }}>{error}</Text>}
      {!!notice && <Text accessibilityRole="alert" style={s.muted}>{notice}</Text>}
      <Button label={busy ? 'Working…' : 'Refresh household meals'} secondary disabled={busy} onPress={() => void run(refresh)} />
      <Card>
        <Field label="Your name in the household" value={memberName} onChangeText={setMemberName} />
        <Field label="New household name" value={name} onChangeText={setName} />
        <Button label="Create household" disabled={busy || !name.trim() || !memberName.trim()} onPress={() => void run(async () => { await api.createHousehold(name, memberName); setName(''); await refresh(); })} />
        <Field label="Invitation code" value={joinCode} onChangeText={setJoinCode} />
        <Button label="Join household" secondary disabled={busy || !joinCode.trim() || !memberName.trim()} onPress={() => void run(async () => { await api.joinHousehold(joinCode, memberName); setJoinCode(''); await refresh(); })} />
      </Card>
      {household && <>
        {remote.households.length > 1 && <Choice values={remote.households.map(item => `${item.name} · ${item.id.slice(0, 6)}`)} value={`${household.name} · ${household.id.slice(0, 6)}`} onChange={value => {
          const next = remote.households.find(item => `${item.name} · ${item.id.slice(0, 6)}` === value);
          if (next) { setSelected(next.id); setReview(null); setInvite(''); setMemberReview(null); }
        }} />}
        <Text style={s.muted}>{household.name} · {household.memberCount} {household.memberCount === 1 ? 'member' : 'members'}</Text>
        {household.isOwner && <Card>
          <Button label="Create invitation code" secondary disabled={busy} onPress={() => void run(async () => setInvite(await api.inviteHouseholdMember(household.id)))} />
          <Text style={s.muted}>A new invitation replaces the previous code and expires after seven days.</Text>
          {!!invite && <Text selectable>{invite}</Text>}
        </Card>}
        <Card>
          <Text style={{ fontWeight: '700' }}>Share prepared leftovers</Text>
          <Text style={s.muted}>Move the available portions from personal leftovers into this kitchen. Sharing does not log food.</Text>
          {candidates.length ? <>
            <Choice values={candidates.map(candidate => `${candidate.title} · ${candidate.remainingPortions} portions · ${candidate.id.slice(-6)}`)} value={selectedCandidate ? `${selectedCandidate.title} · ${selectedCandidate.remainingPortions} portions · ${selectedCandidate.id.slice(-6)}` : ''} onChange={value => {
              const candidate = candidates.find(item => `${item.title} · ${item.remainingPortions} portions · ${item.id.slice(-6)}` === value);
              setPublishId(candidate?.id ?? '');
            }} />
            {selectedCandidate && <Text style={s.muted}>{selectedCandidate.perPortion.calories} cal · {selectedCandidate.perPortion.protein}g protein per portion</Text>}
            <Button label="Share these prepared portions" disabled={busy || !selectedCandidate} onPress={() => void run(async () => {
              if (!selectedCandidate) return;
              const batch = await api.publishHouseholdBatch(household.id, selectedCandidate);
              publishCallback.current({ sourceBatchId: selectedCandidate.id, householdBatchId: batch.id, portions: batch.totalPortions });
              published.current.add(batch.id); setPublishId(''); await refresh();
              setNotice('Prepared food moved to the shared kitchen. Nothing was logged as eaten.');
            })} />
          </> : <Text style={s.muted}>Prepare a recipe first to share its remaining portions.</Text>}
        </Card>
        {pending.map(reservation => {
          const batch = batches.find(item => item.id === reservation.batchId);
          const saved = loggedReservationIds.includes(reservation.id);
          return <Card key={reservation.id}>
            <Text style={{ fontWeight: '700' }}>{batch?.title ?? 'Shared meal'} · {reservation.portions} reserved portions</Text>
            {batch && <Button label={saved ? 'Confirm saved entry' : 'Continue logging'} secondary disabled={busy} onPress={() => setReview({ batch, portions: String(reservation.portions), reservation, requestKey: reservation.id })} />}
            {!saved ? <Button label="Return unlogged portion" secondary disabled={busy} onPress={() => void run(async () => { await api.releaseHouseholdPortion(reservation.id); await refresh(); if (review?.reservation?.id === reservation.id) setReview(null); })} /> : <Text style={s.muted}>This portion is already in your private diary. Remove that meal from Nutrition to return it.</Text>}
          </Card>;
        })}
        {!availableBatches.length && <Text style={s.muted}>No prepared portions are available right now. Share a batch when you are ready.</Text>}
        {availableBatches.map(batch => <Card key={batch.id}>
          <Text style={{ fontWeight: '700' }}>{batch.title}</Text>
          <Text style={s.muted}>{batch.remainingPortions} of {batch.totalPortions} portions available</Text>
          <Text style={s.muted}>{batch.perPortion.calories} cal · {batch.perPortion.protein}g protein per portion</Text>
          <Button label="Review my portion" secondary disabled={busy || batch.remainingPortions <= 0} onPress={() => setReview({ batch, portions: String(Math.min(1, batch.remainingPortions)), requestKey: requestKey() })} />
        </Card>)}
        {review && <Card>
          <Text style={{ fontWeight: '700' }}>{review.batch.title}</Text>
          {review.reservation ? <Text>{review.portions} reserved portions</Text> : <Field label="Portions you ate" value={review.portions} onChangeText={value => setReview({ ...review, portions: value })} keyboardType="decimal-pad" />}
          {preview ? <Text>{preview.calories} cal · {preview.protein}g protein · {preview.carbs}g carbs · {preview.fat}g fat</Text> : <Text style={s.muted}>Choose an available amount, with up to four decimal places.</Text>}
          <Text style={s.muted}>Nutrition comes from the shared preparation snapshot. Confirm only the amount you ate.</Text>
          <Button label="Log my portion privately" disabled={busy || !validPortion} onPress={() => void run(logPortion)} />
          <Button label="Close review" secondary disabled={busy} onPress={() => setReview(null)} />
        </Card>}
        <Card>
          <Text style={{ fontWeight: '700' }}>Household members</Text>
          {household.members.map(member => <View key={member.userId} style={{ gap: 8, marginVertical: 6 }}>
            <Text>{member.name}{member.isMe ? ' · You' : ''}{member.isOwner ? ' · Owner' : ''}</Text>
            {household.isOwner && !member.isMe && <>
              <Button label="Remove member" secondary disabled={busy} onPress={() => setMemberReview({ kind: 'remove', userId: member.userId, name: member.name })} />
              <Button label="Make owner" secondary disabled={busy} onPress={() => setMemberReview({ kind: 'owner', userId: member.userId, name: member.name })} />
            </>}
          </View>)}
          {!household.isOwner ? <Button label="Leave household" secondary disabled={busy} onPress={() => setMemberReview({ kind: 'leave' })} /> : <Text style={s.muted}>Choose another member as owner before leaving.</Text>}
          {memberReview && <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '700' }}>{memberReview.kind === 'owner' ? `Make ${memberReview.name} the owner?` : memberReview.kind === 'remove' ? `Remove ${memberReview.name}?` : 'Leave this household?'}</Text>
            <Text style={s.muted}>Your existing private food logs stay in your account. Reserved and recorded portions stay allocated until returned or undone.</Text>
            <Button label="Confirm membership change" disabled={busy} onPress={() => void run(async () => {
              if (memberReview.kind === 'leave') await api.leaveHousehold(household.id);
              else if (memberReview.kind === 'remove' && memberReview.userId) await api.removeHouseholdMember(household.id, memberReview.userId);
              else if (memberReview.userId) await api.transferHouseholdOwnership(household.id, memberReview.userId);
              setMemberReview(null); setReview(null); setInvite(''); await refresh();
            })} />
            <Button label="Keep membership" secondary disabled={busy} onPress={() => setMemberReview(null)} />
          </View>}
        </Card>
      </>}
      {previousPending.map(reservation => <Card key={reservation.id}>
        <Text>Previous household · {reservation.portions} reserved portions</Text>
        {loggedReservationIds.includes(reservation.id) ? <Text style={s.muted}>Remove the saved private meal from Nutrition if you need to return it.</Text> : <Button label="Return unlogged portion" secondary disabled={busy} onPress={() => void run(async () => { await api.releaseHouseholdPortion(reservation.id); await refresh(); })} />}
      </Card>)}
    </View>
  </Sheet>;
}
