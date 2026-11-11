import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components';
import { getCloudClient } from '../cloud/client';
import type {
  HouseholdBatchCandidate, HouseholdMealProposal, HouseholdReservation,
  HouseholdState, HouseholdTransfer, SharedHouseholdBatch,
} from './contracts';
import {
  createHousehold, inviteHouseholdMember, joinHousehold, loadHouseholdState,
  leaveHousehold, removeHouseholdMember, transferHouseholdOwnership,
  markHouseholdPortionLogged, publishHouseholdBatch, releaseHouseholdPortion,
  reserveHouseholdPortions,
} from './client';
import { householdMealProposal, householdPortionsSchema, portionNutrition } from './domain';
import './household.css';

const emptyState: HouseholdState = { households: [], batches: [], reservations: [] };
type Review = { batch: SharedHouseholdBatch; portions: string; reservation?: HouseholdReservation; requestKey: string };

export default function HouseholdDialog({ candidates, loggedReservationIds, displayName = '', onClose, onPublished, onLogMeal }: {
  candidates: HouseholdBatchCandidate[];
  loggedReservationIds: string[];
  displayName?: string;
  onClose: () => void;
  onPublished: (transfer: HouseholdTransfer) => void;
  /** Save idempotently by householdReservationId; return true only when the private meal is saved. */
  onLogMeal: (proposal: HouseholdMealProposal) => boolean | Promise<boolean>;
}) {
  const [remote, setRemote] = useState<HouseholdState>(emptyState);
  const [householdId, setHouseholdId] = useState('');
  const [name, setName] = useState('');
  const [memberName, setMemberName] = useState(displayName);
  const [joinCode, setJoinCode] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [publishId, setPublishId] = useState('');
  const [membershipReview, setMembershipReview] = useState<{ kind: 'leave' | 'remove' | 'owner'; userId?: string; name?: string } | null>(null);
  const published = useRef(new Set<string>());
  const publishCallback = useRef(onPublished);
  useEffect(() => { publishCallback.current = onPublished; }, [onPublished]);
  const alive = useRef(true);

  function rememberTransfers(data: HouseholdState) {
    for (const batch of data.batches) {
      if (!batch.sourceBatchId || published.current.has(batch.id)) continue;
      publishCallback.current({ sourceBatchId: batch.sourceBatchId, householdBatchId: batch.id, portions: batch.totalPortions });
      published.current.add(batch.id);
    }
  }
  async function refresh() {
    const data = await loadHouseholdState();
    if (!alive.current) return;
    rememberTransfers(data);
    setRemote(data);
    setHouseholdId(current => data.households.some(household => household.id === current) ? current : data.households[0]?.id ?? '');
    setLoaded(true);
  }
  useEffect(() => {
    alive.current = true;
    let unsubscribe: (() => void) | undefined;
    void refresh().catch(reason => { if (alive.current) setError(reason instanceof Error ? reason.message : 'Household meals could not load.'); })
      .finally(() => { if (alive.current) setBusy(false); });
    void getCloudClient().then(client => {
      if (!client || !alive.current) return;
      let previousUser: string | null | undefined;
      const listener = client.auth.onAuthStateChange((_event, session) => {
        const userId = session?.user.id ?? null;
        if (previousUser !== undefined && previousUser !== userId && alive.current) {
          setRemote(emptyState); setReview(null); setInvite(''); setLoaded(false);
          setError('Your account changed. Close household meals and open it again.');
        }
        previousUser = userId;
      });
      unsubscribe = () => listener.data.subscription.unsubscribe();
    }).catch(() => { /* The initial request reports connection errors. */ });
    return () => { alive.current = false; unsubscribe?.(); };
    // This dialog owns its request lifetime. Parent callbacks are read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Household sharing could not finish. Try again.'); }
    finally { if (alive.current) setBusy(false); }
  }

  const household = remote.households.find(item => item.id === householdId);
  const batches = remote.batches.filter(batch => batch.householdId === householdId);
  const availableBatches = batches.filter(batch => batch.remainingPortions > 0);
  const pending = remote.reservations.filter(reservation => reservation.householdId === householdId && reservation.status === 'reserved');
  const previousPending = remote.reservations.filter(reservation => reservation.status === 'reserved' && !remote.households.some(item => item.id === reservation.householdId));
  const selectedCandidate = candidates.find(candidate => candidate.id === publishId);
  const portions = Number(review?.portions);
  const validPortion = !!review && householdPortionsSchema.safeParse(portions).success &&
    (review.reservation ? portions === review.reservation.portions : portions <= review.batch.remainingPortions);
  const preview = review && validPortion ? portionNutrition(review.batch.perPortion, portions) : null;

  async function logReviewedPortion() {
    if (!review || !validPortion) return;
    const reservation = review.reservation ?? await reserveHouseholdPortions(review.batch.id, portions, review.requestKey);
    if (reservation.status === 'released') throw Error('This portion was already returned. Choose your portion again.');
    // Retain the exact reservation on a failed/unknown save so retry cannot allocate twice.
    setReview({ ...review, reservation, portions: String(reservation.portions) });
    const saved = await onLogMeal(householdMealProposal(review.batch, reservation));
    if (!saved) throw Error('Your portion is reserved. Finish saving it here, or return it to the household.');
    try { await markHouseholdPortionLogged(reservation.id); }
    catch {
      await refresh();
      setNotice('Your private meal is saved. If this portion still appears below, Continue logging safely confirms the same entry.');
      setReview(null);
      return;
    }
    await refresh(); setReview(null); setNotice('Logged privately. The shared portions are updated.');
  }

  return <Modal title="Household meals" onClose={onClose}>
    <div className="household-dialog">
      <p className="household-intro">Cook once. Share the prepared food. Each person logs their own portion privately.</p>
      <p className="household-privacy">Only meals you explicitly share appear here. Your food diary, goals, measurements and workouts stay in your account.</p>
      {error && <p className="household-error" role="alert">{error}</p>}
      {notice && <p className="household-notice" role="status">{notice}</p>}
      {!loaded && <button className="button secondary" disabled={busy} onClick={() => void run(refresh)}>{busy ? 'Opening household meals…' : 'Retry household connection'}</button>}
      <label>Your name in the household<input value={memberName} onChange={event => setMemberName(event.target.value)} maxLength={60} placeholder="The name members will see" /></label>
      <section className="household-connect" aria-label="Create or join a household">
        <form onSubmit={event => { event.preventDefault(); void run(async () => { await createHousehold(name, memberName); setName(''); await refresh(); }); }}>
          <label>New household name<input value={name} maxLength={80} onChange={event => setName(event.target.value)} placeholder="Our kitchen" required /></label>
          <button className="button secondary" disabled={busy || !name.trim() || !memberName.trim()}>Create household</button>
        </form>
        <form onSubmit={event => { event.preventDefault(); void run(async () => { await joinHousehold(joinCode, memberName); setJoinCode(''); await refresh(); }); }}>
          <label>Invitation code<input value={joinCode} maxLength={36} onChange={event => setJoinCode(event.target.value)} placeholder="Paste the complete code" autoCapitalize="none" autoCorrect="off" required /></label>
          <button className="button secondary" disabled={busy || !joinCode.trim() || !memberName.trim()}>Join household</button>
        </form>
      </section>
      {household && <>
        <div className="household-heading">
          <label>Your household<select value={householdId} onChange={event => { setHouseholdId(event.target.value); setReview(null); setInvite(''); setMembershipReview(null); }} disabled={busy}>
            {remote.households.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <span>{household.memberCount} {household.memberCount === 1 ? 'member' : 'members'}</span>
          <button className="button secondary" disabled={busy} onClick={() => void run(refresh)}>Refresh portions</button>
        </div>
        {household.isOwner && <section className="household-invite">
          <button className="button secondary" disabled={busy} onClick={() => void run(async () => { setInvite(await inviteHouseholdMember(household.id)); })}>Create invitation code</button>
          <small>A new code replaces the previous one and expires after seven days. Share it only with people you want in this household.</small>
          {invite && <label>Invitation code<input readOnly value={invite} onFocus={event => event.target.select()} /></label>}
        </section>}
        <details className="household-members">
          <summary>Household members</summary>
          {household.members.map(member => <div className="household-member" key={member.userId}>
            <span><strong>{member.name}</strong>{member.isMe ? ' · You' : ''}{member.isOwner ? ' · Owner' : ''}</span>
            {household.isOwner && !member.isMe && <div className="household-actions">
              <button className="button secondary" disabled={busy} onClick={() => setMembershipReview({ kind: 'remove', userId: member.userId, name: member.name })}>Remove member</button>
              <button className="button secondary" disabled={busy} onClick={() => setMembershipReview({ kind: 'owner', userId: member.userId, name: member.name })}>Make owner</button>
            </div>}
          </div>)}
          {!household.isOwner ? <button className="button secondary" disabled={busy} onClick={() => setMembershipReview({ kind: 'leave' })}>Leave household</button> : <p>Choose another member as owner before leaving this household.</p>}
          {membershipReview && <div className="household-review">
            <strong>{membershipReview.kind === 'owner' ? `Make ${membershipReview.name} the owner?` : membershipReview.kind === 'remove' ? `Remove ${membershipReview.name}?` : 'Leave this household?'}</strong>
            <p>{membershipReview.kind === 'owner' ? 'They will manage invitations and membership. You will stay a member.' : 'Shared kitchen access ends. Existing personal food logs stay private, and recorded or reserved portions stay allocated until undone or returned.'}</p>
            <div className="household-actions">
              <button className="button primary" disabled={busy} onClick={() => void run(async () => {
                if (membershipReview.kind === 'leave') await leaveHousehold(household.id);
                else if (membershipReview.kind === 'remove' && membershipReview.userId) await removeHouseholdMember(household.id, membershipReview.userId);
                else if (membershipReview.userId) await transferHouseholdOwnership(household.id, membershipReview.userId);
                setMembershipReview(null); setReview(null); setInvite(''); await refresh();
              })}>Confirm change</button>
              <button className="button secondary" disabled={busy} onClick={() => setMembershipReview(null)}>Keep membership</button>
            </div>
          </div>}
        </details>
        <section className="household-publish" aria-label="Share a prepared batch">
          <h3>Move a prepared batch into this kitchen</h3>
          <p>Share its remaining portions and reviewed nutrition. Those portions move out of your personal leftovers; sharing does not log food.</p>
          {candidates.length ? <>
            <label>Prepared meal<select value={publishId} disabled={busy} onChange={event => setPublishId(event.target.value)}>
              <option value="">Choose prepared leftovers</option>
              {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.title} · {candidate.remainingPortions} portions</option>)}
            </select></label>
            {selectedCandidate && <p>{selectedCandidate.perPortion.calories} cal · {selectedCandidate.perPortion.protein}g protein per portion</p>}
            <button className="button primary" disabled={busy || !selectedCandidate} onClick={() => void run(async () => {
              if (!selectedCandidate) return;
              const batch = await publishHouseholdBatch(household.id, selectedCandidate);
              publishCallback.current({ sourceBatchId: selectedCandidate.id, householdBatchId: batch.id, portions: batch.totalPortions });
              published.current.add(batch.id);
              setPublishId(''); await refresh(); setNotice('Prepared portions moved to your household kitchen. Nothing was logged as eaten.');
            })}>Share these prepared portions</button>
          </> : <p>Prepare a recipe first, then return here to share its available portions.</p>}
        </section>
        {!!pending.length && <section className="household-pending" aria-label="Your reserved portions">
          <h3>Your portions to finish</h3>
          <p>These are held for you. Review them to log privately or return them to the shared meal.</p>
          {pending.map(reservation => {
            const batch = batches.find(item => item.id === reservation.batchId);
            const privateSaved = loggedReservationIds.includes(reservation.id);
            return <div className="household-pending-item" key={reservation.id}>
              <strong>{batch?.title ?? 'Shared meal'} · {reservation.portions} portions</strong>
              <div className="household-actions">
                {batch && <button className="button secondary" disabled={busy} onClick={() => setReview({ batch, portions: String(reservation.portions), reservation, requestKey: reservation.id })}>{privateSaved ? 'Confirm saved entry' : 'Continue logging'}</button>}
                {!privateSaved && <button className="button secondary" disabled={busy} onClick={() => void run(async () => { await releaseHouseholdPortion(reservation.id); await refresh(); if (review?.reservation?.id === reservation.id) setReview(null); })}>Return portion</button>}
              </div>
              {privateSaved && <small>This portion is already in your private diary. Remove that meal from Nutrition if you need to return it.</small>}
            </div>;
          })}
        </section>}
        <section aria-label="Shared prepared meals">
          <h3>Ready in your shared kitchen</h3>
          {!availableBatches.length && <p>No prepared portions are available right now. Share a batch when you are ready.</p>}
          <div className="household-batches">{availableBatches.map(batch => <article className="household-batch" key={batch.id}>
            <strong>{batch.title}</strong>
            <span>{batch.remainingPortions} of {batch.totalPortions} portions available</span>
            <small>{batch.perPortion.calories} cal · {batch.perPortion.protein}g protein per portion</small>
            <button className="button secondary" disabled={busy || batch.remainingPortions <= 0} onClick={() => setReview({ batch, portions: String(Math.min(1, batch.remainingPortions)), requestKey: crypto.randomUUID() })}>Review my portion</button>
          </article>)}</div>
        </section>
        {review && <section className="household-review" aria-label="Review your personal portion">
          <h3>{review.batch.title}</h3>
          <label>Portions you ate<input type="number" min="0.0001" max={review.reservation ? review.reservation.portions : review.batch.remainingPortions} step="any" value={review.portions} readOnly={!!review.reservation} disabled={busy} onChange={event => setReview({ ...review, portions: event.target.value })} /></label>
          {preview ? <p><strong>{preview.calories} cal · {preview.protein}g protein</strong><br />{preview.carbs}g carbs · {preview.fat}g fat</p> : <p>Choose an available amount, using up to four decimal places.</p>}
          <p>These values come from the shared preparation snapshot. Only your confirmed portion enters your private food diary.</p>
          <div className="household-actions">
            <button className="button primary" disabled={busy || !validPortion} onClick={() => void run(logReviewedPortion)}>Log my portion privately</button>
            <button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Close review</button>
          </div>
        </section>}
      </>}
      {!!previousPending.length && <section className="household-pending" aria-label="Portions from previous households">
        <h3>Your portions from previous households</h3>
        <p>Your existing food logs stay private. Return only portions you have not logged or eaten.</p>
        {previousPending.map(reservation => <div className="household-pending-item" key={reservation.id}>
          <strong>Shared meal · {reservation.portions} portions</strong>
          {loggedReservationIds.includes(reservation.id) ? <p>This portion is in your diary. Remove the saved meal from Nutrition to return it.</p> : <button className="button secondary" disabled={busy} onClick={() => void run(async () => { await releaseHouseholdPortion(reservation.id); await refresh(); })}>Return unlogged portion</button>}
        </div>)}
      </section>}
    </div>
  </Modal>;
}
