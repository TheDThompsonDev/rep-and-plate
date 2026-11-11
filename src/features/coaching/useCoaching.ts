import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import type { AppState } from '../../domain';
import { today } from '../../domain';
import { buildAgentContext } from '../connections/context';
import type { ConnectionSession, ConnectionsPlatform } from '../connections/useConnections';
import { cloudEpoch, onAccountChange } from '../cloud/sync-control';
import { SAVE_REPORTED_RECORDS, coachingBriefSchema, coachingCommandSchema, coachingStateSchema, coachingWeeklyReviewSchema, type CoachingCommand } from './contracts';

/** A record brought in from another app, identified the way its source identifies it. */
export type ImportedRecordRef = { kind: 'activity'; source: string; externalId: string } | { kind: 'nutrition'; source: string; day: string };

const freshnessSchema = z.object({
  mode: z.string(), publishedAt: z.string().nullable().optional(),
  dataUpdatedAt: z.string().nullable(), sourceRevision: z.number().nullable(),
  ageSeconds: z.number().nullable(), stale: z.boolean(),
});
const responseSchema = z.object({ state: coachingStateSchema, brief: coachingBriefSchema, weekly: coachingWeeklyReviewSchema, freshness: freshnessSchema, nextSteps: z.array(z.string()).max(4).optional() });
type Snapshot = z.infer<typeof responseSchema>;

/** Coaching is server-owned. Account snapshots supply evidence, never overwrite the plan. */
export function useCoaching(records: AppState, platform: ConnectionsPlatform, open: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const current = useRef(records);
  const lastRecords = useRef(records);
  const session = useRef<ConnectionSession | null>(null);
  const generation = useRef(0);
  const running = useRef(false);
  const latest = useRef<Snapshot | null>(null);
  const pending = useRef<{ key: string; requestId: string; baseRevision: number } | null>(null);
  const lastPublished = useRef('');
  const evidenceUpdatedAt = useRef<string | null>(null);
  const encodedRecords = useMemo(() => JSON.stringify(buildAgentContext(records, today(), Intl.DateTimeFormat().resolvedOptions().timeZone)), [records]);
  useEffect(() => {
    current.current = records;
    // Loading a saved device snapshot does not establish when its evidence changed.
    if (lastRecords.current !== records) evidenceUpdatedAt.current = new Date().toISOString();
    lastRecords.current = records;
  }, [records]);
  useEffect(() => onAccountChange(() => {
    generation.current++; session.current = null; latest.current = null;
    pending.current = null; lastPublished.current = ''; evidenceUpdatedAt.current = null;
    setSnapshot(null); setError('Your account changed. Refresh your coaching plan to continue.'); setNotice('');
  }), []);

  const checked = useCallback(async () => {
    const epoch = cloudEpoch(), ticket = generation.current;
    if (session.current && !session.current.active()) {
      session.current = null; latest.current = null; pending.current = null;
      lastPublished.current = ''; setSnapshot(null);
    }
    const active = session.current?.active() ? session.current : await platform.session();
    if (epoch !== cloudEpoch() || ticket !== generation.current || !active.active()) throw Error('Your account changed. Reopen your coaching plan.');
    if (session.current && session.current.identity !== active.identity) {
      latest.current = null; setSnapshot(null); pending.current = null; lastPublished.current = '';
    }
    session.current = active;
    return active;
  }, [platform]);

  const read = useCallback(async (active: ConnectionSession) => {
    // Local source snapshots have no automatic sync path. Publish explicitly loaded records.
    // Hosted readers use the authoritative synchronized account snapshot instead.
    if (active.mode === 'local') {
      const context = buildAgentContext(current.current, today(), Intl.DateTimeFormat().resolvedOptions().timeZone);
      const encoded = JSON.stringify(context);
      if (encoded !== lastPublished.current) {
        await active.request({ operation: 'publish', context, dataUpdatedAt: evidenceUpdatedAt.current });
        if (!active.active()) throw Error('Your account changed. Refresh your coaching plan.');
        lastPublished.current = encoded;
      }
    }
    const result = responseSchema.parse(await active.request({ operation: 'coaching.read', day: today() }));
    if (!active.active()) throw Error('Your account changed. Refresh your coaching plan.');
    return result;
  }, []);

  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const ticket = generation.current;
    setLoading(true); setError('');
    try {
      const active = await checked();
      const result = await read(active);
      if (ticket === generation.current && active.active()) { latest.current = result; setSnapshot(result); }
    } catch (reason) {
      if (ticket === generation.current) setError(reason instanceof Error ? reason.message : 'Your coaching plan could not load.');
    } finally {
      running.current = false;
      if (ticket === generation.current) setLoading(false);
    }
  }, [checked, read]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void Promise.resolve().then(() => { if (live) void refresh(); });
    const timer = setInterval(() => { if (live && (!platform.foreground || platform.foreground())) void refresh(); }, 30000);
    return () => { live = false; clearInterval(timer); };
  }, [open, refresh, platform, encodedRecords]);
  useEffect(() => () => { generation.current++; }, []);

  const perform = useCallback(async (operation: (active: ConnectionSession) => Promise<unknown>, message: string) => {
    if (running.current) throw Error('Wait for the current coaching request to finish.');
    running.current = true;
    const ticket = generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const active = await checked();
      await operation(active);
      if (ticket !== generation.current || !active.active()) throw Error('Your account changed. Refresh to check the outcome.');
      const result = await read(active);
      if (ticket !== generation.current || !active.active()) throw Error('Your account changed. Refresh to check the outcome.');
      latest.current = result; setSnapshot(result); setNotice(message);
    } catch (reason) {
      if (ticket === generation.current) setError(reason instanceof Error ? reason.message : 'Your change could not be confirmed. Refresh before retrying.');
      throw reason;
    } finally {
      running.current = false;
      if (ticket === generation.current) setBusy(false);
    }
  }, [checked, read]);

  const propose = useCallback(async (input: CoachingCommand) => {
    const command = coachingCommandSchema.parse(input);
    const state = latest.current?.state;
    if (!state) throw Error('Refresh your coaching plan before making a change.');
    const key = JSON.stringify(command);
    if (!pending.current || pending.current.key !== key) pending.current = { key, requestId: crypto.randomUUID(), baseRevision: state.revision };
    const attempt = pending.current;
    await perform(active => active.request({ operation: 'coaching.propose', requestId: attempt.requestId, baseRevision: attempt.baseRevision, command }), 'Ready to review. Your agreed plan has not changed.');
    if (pending.current === attempt) pending.current = null;
  }, [perform]);
  const resolve = useCallback(async (proposalId: string, status: 'accepted' | 'dismissed') => {
    await perform(active => active.request({ operation: 'coaching.resolve', proposalId, status, ...(status === 'accepted' ? { confirmation: 'APPLY_REVIEWED_CHANGE' as const } : {}) }), status === 'accepted' ? 'Saved to your coaching record. Your next conversation can pick up here.' : 'Proposal dismissed. Your agreed plan is unchanged.');
  }, [perform]);
  const undo = useCallback(async (entryId: string) => {
    const state = latest.current?.state;
    if (!state) throw Error('Refresh your coaching plan first.');
    const key = `undo:${entryId}`;
    if (!pending.current || pending.current.key !== key) pending.current = { key, requestId: crypto.randomUUID(), baseRevision: state.revision };
    const attempt = pending.current;
    await perform(active => active.request({ operation: 'coaching.undo', entryId, requestId: attempt.requestId, baseRevision: attempt.baseRevision }), 'The reviewed change was undone. The earlier plan is restored.');
    if (pending.current === attempt) pending.current = null;
  }, [perform]);

  const removeRecord = useCallback(async (record: ImportedRecordRef) => {
    // Imported records sit outside the reviewed plan, so removing one never changes the plan revision.
    await perform(active => active.request({
      operation: 'coaching.import', activities: [], nutritionDays: [], confirmation: SAVE_REPORTED_RECORDS,
      remove: record.kind === 'activity'
        ? { activities: [{ source: record.source, externalId: record.externalId }], nutritionDays: [] }
        : { activities: [], nutritionDays: [{ source: record.source, day: record.day }] },
    }), 'Removed from your records. Your agreed plan is unchanged.');
  }, [perform]);

  return {
    state: snapshot?.state ?? null,
    brief: snapshot?.brief ?? null,
    weekly: snapshot?.weekly ?? null,
    freshness: snapshot?.freshness ?? null,
    nextSteps: snapshot?.nextSteps ?? [],
    loading, busy, error, notice, refresh, propose, resolve, undo, removeRecord,
  };
}
export type CoachingController = ReturnType<typeof useCoaching>;
