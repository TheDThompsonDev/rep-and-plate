import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export type GenerationEvent = {
  id: string;
  user_id: string;
  operation: string;
  request_id: string;
  provider: "qwen" | "openai" | "jev";
  model: string;
  fallback: boolean;
  outcome: "success" | "error" | "cancelled" | "timeout";
  error_code: string | null;
  duration_ms: number;
  input_tokens: number | null;
  cached_input_tokens: number | null;
  output_tokens: number | null;
  input_audio_tokens?: number | null;
  audio_seconds?: number | null;
};
type Context = { userId: string; operation: string; requestId?: string };
type Attempt = Omit<
  GenerationEvent,
  "id" | "user_id" | "operation" | "request_id"
>;
const storage = new AsyncLocalStorage<{
  context: Context;
  events: GenerationEvent[];
}>();
const operations = new Set([
  "/api/chat",
  "/api/products/label",
  "/api/plans/workout",
  "/api/plans/meals",
  "/api/shopping/prices",
  "/api/voice",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only an explicit metadata allowlist is ever retained; never prompts, files or errors. */
export function recordGenerationAttempt(event: Attempt) {
  const active = storage.getStore();
  if (!active || active.events.length >= 8) return;
  active.events.push({
    id: randomUUID(),
    user_id: active.context.userId,
    operation: active.context.operation,
    request_id: active.context.requestId!,
    provider: event.provider,
    model: event.model.slice(0, 100),
    fallback: event.fallback,
    outcome: event.outcome,
    error_code: event.error_code,
    duration_ms: event.duration_ms,
    input_tokens: event.input_tokens,
    cached_input_tokens: event.cached_input_tokens,
    output_tokens: event.output_tokens,
    input_audio_tokens: event.input_audio_tokens ?? null,
    audio_seconds: event.audio_seconds ?? null,
  });
}

/** Jev and transcription calls share the same request correlation and privacy boundary. */
export async function trackServiceAttempt<T>(
  provider: "jev" | "openai",
  model: string,
  signal: AbortSignal,
  run: (setUsage: (usage: unknown) => void) => Promise<T>,
) {
  const started = Date.now();
  let usage: Record<string, unknown> = {};
  let outcome: GenerationEvent["outcome"] = "success";
  let errorCode: string | null = null;
  try {
    return await run((value) => {
      if (value && typeof value === "object")
        usage = value as Record<string, unknown>;
    });
  } catch (error) {
    const reason = signal.aborted ? signal.reason : error;
    outcome =
      reason instanceof Error && reason.name === "TimeoutError"
        ? "timeout"
        : signal.aborted
          ? "cancelled"
          : "error";
    const status =
      error && typeof error === "object" && "status" in error
        ? error.status
        : undefined;
    errorCode =
      typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 400 &&
      status <= 599
        ? `HTTP_${status}`
        : outcome === "timeout"
          ? "TIMEOUT"
          : outcome === "cancelled"
            ? "CANCELLED"
            : "PROVIDER_ERROR";
    throw error;
  } finally {
    const tokens = (value: unknown) =>
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? value
        : null;
    const details = (usage.input_token_details ??
      usage.input_tokens_details) as Record<string, unknown> | undefined;
    const seconds =
      typeof usage.seconds === "number" &&
      Number.isFinite(usage.seconds) &&
      usage.seconds >= 0
        ? usage.seconds
        : null;
    recordGenerationAttempt({
      provider,
      model,
      fallback: false,
      outcome,
      error_code: errorCode,
      duration_ms: Date.now() - started,
      input_tokens: tokens(usage.input_tokens),
      output_tokens: tokens(usage.output_tokens),
      cached_input_tokens: tokens(details?.cached_tokens),
      input_audio_tokens: tokens(details?.audio_tokens),
      audio_seconds: seconds,
    });
  }
}

export async function withGenerationTelemetry<T>(
  context: Context,
  persist: (events: GenerationEvent[]) => Promise<void>,
  run: () => Promise<T>,
): Promise<T> {
  if (!uuid.test(context.userId) || !operations.has(context.operation))
    return run();
  const events: GenerationEvent[] = [];
  return storage.run(
    {
      context: {
        ...context,
        requestId:
          context.requestId && uuid.test(context.requestId)
            ? context.requestId
            : randomUUID(),
      },
      events,
    },
    async () => {
      try {
        return await run();
      } finally {
        if (events.length) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              persist(events),
              new Promise<never>((_, reject) => {
                timer = setTimeout(
                  () => reject(Error("TELEMETRY_TIMEOUT")),
                  1200,
                );
              }),
            ]);
          } catch {
            // Observable loss, without logging a provider error or health content.
            console.warn("generation_telemetry_unavailable");
          } finally {
            if (timer) clearTimeout(timer);
          }
        }
      }
    },
  );
}

export type CaptureCandidate = { name: string; created_at: string };
export function eligibleCaptures(candidates: CaptureCandidate[], now: number) {
  const cutoff = now - 24 * 60 * 60 * 1000;
  return candidates
    .filter((item) => {
      const [owner, file, extra] = item.name.split("/");
      const created = Date.parse(item.created_at);
      return (
        !extra &&
        uuid.test(owner) &&
        /^[0-9a-f-]{36}\.(jpg|png|webp|m4a|webm|ogg|wav)$/i.test(file ?? "") &&
        Number.isFinite(created) &&
        created < cutoff
      );
    })
    .map((item) => item.name);
}

export type MaintenanceServices = { maintenance: () => Promise<unknown> };
/** Independent of user login and preview cookies, but never independent of authentication. */
export async function handleMaintenance(
  req: IncomingMessage,
  res: ServerResponse,
  secret: string | undefined,
  services: MaintenanceServices,
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const provided = req.headers.authorization ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const suppliedBytes = Buffer.from(provided),
    expectedBytes = Buffer.from(expected);
  const authorized =
    !!secret &&
    secret.length >= 32 &&
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes);
  if (!authorized) {
    res.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }
  if (req.method !== "GET") {
    res.writeHead(405).end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  try {
    const result = await services.maintenance();
    res.writeHead(200).end(JSON.stringify({ ok: true, result }));
  } catch {
    console.error("maintenance_failed");
    res
      .writeHead(503)
      .end(JSON.stringify({ error: "Maintenance unavailable" }));
  }
}
