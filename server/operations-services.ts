import { createClient } from "@supabase/supabase-js";
import {
  eligibleCaptures,
  type CaptureCandidate,
  type GenerationEvent,
} from "./operations.ts";

type Rate = {
  input: number;
  cachedInput: number;
  output: number;
  inputAudio?: number;
};
export function tokenCost(event: GenerationEvent, rates: Record<string, Rate>) {
  const rate = rates[`${event.provider}:${event.model}`];
  const input = event.input_tokens,
    cached =
      event.cached_input_tokens ??
      (event.input_audio_tokens != null ? 0 : null),
    output = event.output_tokens;
  if (
    !rate ||
    ![rate.input, rate.cachedInput, rate.output].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) ||
    input === null ||
    output === null ||
    cached === null ||
    cached > input
  )
    return null;
  if (event.model === "gpt-4o-mini-transcribe") {
    const audio = event.input_audio_tokens;
    if (
      audio == null ||
      audio > input - cached ||
      typeof rate.inputAudio !== "number" ||
      !Number.isFinite(rate.inputAudio) ||
      rate.inputAudio < 0
    )
      return null;
    return (
      ((input - cached - audio) * rate.input +
        cached * rate.cachedInput +
        audio * rate.inputAudio +
        output * rate.output) /
      1_000_000
    );
  }
  return (
    ((input - cached) * rate.input +
      cached * rate.cachedInput +
      output * rate.output) /
    1_000_000
  );
}

export function createOperationsServices(
  env: Record<string, string | undefined>,
) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error("OPERATIONS_CONFIG");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
    },
  });
  let rates: Record<string, Rate> = {};
  try {
    const parsed = JSON.parse(env.AI_TOKEN_RATES_JSON || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      rates = parsed;
  } catch {
    /* Missing/invalid rates must never masquerade as free usage. */
  }
  return {
    recordGeneration: async (events: GenerationEvent[]) => {
      const rows = events.map((event) => ({
        ...event,
        token_cost_usd: tokenCost(event, rates),
      }));
      const { error } = await admin
        .from("health_generation_events")
        .insert(rows)
        .abortSignal(AbortSignal.timeout(1000));
      if (error) throw Error("TELEMETRY_STORAGE");
    },
    maintenance: async () => {
      let capturesDeleted = 0;
      let moreCaptures = false;
      // Bounded batches; the next daily invocation resumes safely after partial failure.
      for (let batch = 0; batch < 5; batch++) {
        const { data, error } = await admin.rpc(
          "health_expired_capture_candidates",
        );
        if (error) throw Error("CAPTURE_CANDIDATES");
        const names = eligibleCaptures(
          (data ?? []) as CaptureCandidate[],
          Date.now(),
        );
        if (!names.length) {
          moreCaptures = false;
          break;
        }
        const removed = await admin.storage
          .from("health-captures")
          .remove(names);
        if (removed.error) throw Error("CAPTURE_CLEANUP");
        capturesDeleted += names.length;
        moreCaptures = names.length === 500;
        if (!moreCaptures) break;
      }
      const pruned = await admin.rpc("health_prune_operations");
      if (pruned.error) throw Error("OPERATIONS_CLEANUP");
      const result = { capturesDeleted, moreCaptures, pruned: pruned.data };
      console.info("maintenance_complete", JSON.stringify(result));
      return result;
    },
  };
}
