import { type IncomingMessage, type ServerResponse } from "node:http";
import {
  aiRequestSchema,
  aiResultSchema,
  type AIResult,
} from "../src/ai-contract.ts";
import { CHAT_DEADLINE_MS, runAI, type Config } from "./ai.ts";
import { CHAT_POLICY_VERSION } from './chat-boundaries.ts';
import { createProductSearchApi } from "./products/search.ts";
import { createProductApi } from "./products/http.ts";
import { createPlanApi } from "./plans.ts";
import { createVoiceApi } from "./voice.ts";
import { enrichReceipt } from "./products/enrich.ts";
import { createShoppingApi } from "./shopping.ts";
import { createHash } from "node:crypto";
import type { ChatCache } from "./chat-cache.ts";
import { generationAvailable, QWEN_BASE_URL, QWEN_MODEL } from "./generation.ts";
import { createAgentHandler } from './agents/http.ts';
import { AGENT_ROUTE_PREFIX, BODY_LIMITS, cloudConfigResponse, readJsonBody, routeFor } from "./routes.ts";

export const readConfig = (
  env: Record<string, string | undefined>,
): Config => ({
  provider: env.QWEN_API_KEY ? "qwen" : "openai",
  qwenKey: env.QWEN_API_KEY,
  qwenBaseUrl: env.QWEN_BASE_URL || QWEN_BASE_URL,
  fallbackEnabled: env.AI_FALLBACK_ENABLED !== "false",
  fallbackModel: env.AI_FALLBACK_MODEL || "gpt-5-mini",
  openaiKey: env.OPENAI_API_KEY,
  jevKey: env.JEV_API_KEY,
  usdaKey: env.FOODDATA_GOV_API || env.USDA_API_KEY,
  supabaseUrl: env.SUPABASE_URL,
  supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
  model: env.QWEN_API_KEY ? env.QWEN_MODEL || QWEN_MODEL : env.OPENAI_MODEL || "gpt-5-mini",
  jevModel: env.JEV_MODEL || "jev-latest",
});
const errors: Record<string, string> = {
  AI_BOUNDARY_UNAVAILABLE:
    "I couldn’t complete the response check, so I haven’t shown an answer or changed your records. Please retry. For a personal medical concern, contact a qualified clinician; for immediate danger, call your local emergency number.",
  AI_NOT_CONFIGURED:
    "AI isn’t configured on the server yet. Your message is still here.",
  AI_INCOMPLETE:
    "I couldn’t finish that response. Your capture is saved here; please try again.",
  AI_BOUNDARY_TIMEOUT_INPUT:
    "The question check ran out of time before it finished, so I haven’t shown an answer or changed your records. Please retry.",
  AI_BOUNDARY_TIMEOUT_OUTPUT:
    "The answer took too long to generate, which left no time for the final response check. I haven’t shown it or changed your records. Please retry, perhaps with a shorter message or a smaller image.",
};
export function publicError(error: unknown) {
  const e = error as {
    message?: string;
    status?: number;
    name?: string;
    code?: string;
  };
  if (e.status === 401 || e.status === 403)
    return "The AI service could not authenticate. Check the server’s provider key, endpoint and model access.";
  if (e.status === 429)
    return "The AI service is at its usage limit. Check its billing or limits, then retry.";
  if (
    e.name === "AbortError" ||
    e.name === "TimeoutError" ||
    e.name === "APIConnectionTimeoutError"
  )
    return "That took longer than expected. Your capture is still here; please retry.";
  return (
    errors[e.message ?? ""] ??
    "I couldn’t reach the AI service or read its response. Your capture is still here; please retry."
  );
}
/** A body the caller already parsed (the hosted boundary reads it once for ownership checks). */
export type ApiInput = { body: unknown };
export function createApi(
  config: Config,
  runner = runAI,
  hosted?: { cache: ChatCache },
) {
  const productApi = createProductApi(config);
  const productSearchApi = createProductSearchApi(config);
  const planApi = createPlanApi(config);
  const voiceApi = createVoiceApi(config);
  const shoppingApi = createShoppingApi(config);
  let agents: Promise<ReturnType<typeof createAgentHandler>> | undefined;
  const completed = new Map<string, { at: number; result: AIResult }>();
  const running = new Set<string>();
  let active = 0;
  let attempts: number[] = [];
  return async function api(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
    user = "local",
    input?: ApiInput,
  ) {
    const path = (req.url ?? "").split("?")[0];
    if (!path.startsWith("/api/")) return next();
    if (!hosted && path.startsWith(AGENT_ROUTE_PREFIX)) {
      try {
        agents ??= import('./agents/sqlite.ts').then(({ SqliteAgentStore }) => createAgentHandler({ store: new SqliteAgentStore() }));
        return await (await agents)(req, res);
      } catch {
        agents = undefined;
        res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Connections storage is unavailable.', retryable: true } }));
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    };
    try {
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(
          new URL(`http://${req.headers.host}`).hostname,
        )
      )
        return json(403, { error: "This server accepts local requests only." });
    } catch {
      return json(403, { error: "Invalid host." });
    }
    // This local server is deliberately loopback-only; reject cross-origin browser calls.
    if (
      req.headers.origin &&
      req.headers.origin !== `http://${req.headers.host}`
    )
      return json(403, { error: "Request origin is not allowed." });
    const route = routeFor(path);
    if (!route) return json(404, { error: "Not found." });
    // Hosted-only routes need credentials this loopback server never holds (see routes.ts).
    if (route.scope === "hosted-only")
      return json(501, { error: route.hostedOnly });
    if (req.method !== route.method) {
      res.setHeader("Allow", route.method);
      return json(405, { error: "Method not allowed." });
    }
    switch (route.path) {
      case "/api/status":
        return json(200, {
          available: generationAvailable(config),
          provider: config.provider || "openai",
          jev: !!config.jevKey,
          model: config.model,
          usda: !!config.usdaKey,
        });
      case "/api/cloud/config":
        // This response intentionally excludes all service-role/secret credentials.
        return json(200, cloudConfigResponse({ url: config.supabaseUrl, publishableKey: config.supabasePublishableKey }));
      case "/api/products/search":
        return productSearchApi(req, res);
      case "/api/products/lookup":
      case "/api/products/label":
        return productApi(req, res);
      case "/api/plans/workout":
      case "/api/plans/meals":
        return planApi(req, res);
      case "/api/voice":
        return voiceApi(req, res);
      case "/api/shopping/prices":
        return shoppingApi(req, res);
      case "/api/chat":
        break;
      default:
        return json(404, { error: "Not found." });
    }
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return json(415, { error: "Send JSON." });
    let body: unknown;
    if (input) body = input.body;
    else {
      const read = await readJsonBody(req, BODY_LIMITS.localChat);
      if (!read.ok)
        return read.reason === "too-large"
          ? json(413, { error: "This capture is too large. Use a smaller image." })
          : json(400, { error: "The request could not be read." });
      body = read.body;
    }
    const parsed = aiRequestSchema.safeParse(body);
    if (!parsed.success)
      return json(400, {
        error:
          "Some capture details are invalid. Please send a shorter message or a JPG, PNG, or WebP image.",
      });
    const request = parsed.data;
    const now = Date.now();
    for (const [key, value] of completed)
      if (now - value.at > 600000) completed.delete(key);
    const cacheKey = `${user}:${request.requestId}`;
    const cached = !hosted && completed.get(cacheKey);
    if (cached) {
      res.setHeader("Content-Type", "application/x-ndjson");
      return res.end(
        JSON.stringify({ type: "result", result: cached.result }) + "\n",
      );
    }
    if (running.has(cacheKey))
      return json(409, {
        error:
          "This capture is already being processed. Wait a moment before retrying.",
      });
    attempts = attempts.filter((t) => now - t < 60000);
    if (!hosted && (active >= 2 || attempts.length >= 12)) {
      // Two captures finish within seconds; the per-minute window opens when its oldest attempt ages out.
      const retryAfter = active >= 2 ? 5 : Math.max(1, Math.ceil((60000 - (now - attempts[0])) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return json(429, {
        error:
          "Rep & Plate is handling a few captures. Please try again in a moment.",
      });
    }
    if (!generationAvailable(config))
      return json(503, { error: errors.AI_NOT_CONFIGURED });
    let lease: string | undefined;
    if (hosted) {
      const claim = await hosted.cache.claim(
        user,
        request.requestId,
        createHash("sha256").update(`${CHAT_POLICY_VERSION}:${JSON.stringify(request)}`).digest("hex"),
      );
      if (claim.status === "cached") {
        res.setHeader("Content-Type", "application/x-ndjson");
        return res.end(
          JSON.stringify({ type: "result", result: claim.result }) + "\n",
        );
      }
      if (claim.status !== "new")
        return json(409, {
          error:
            claim.status === "mismatch"
              ? "This capture changed. Send it as a new message."
              : "This capture is already being processed. Retry in a moment.",
        });
      lease = claim.lease;
    }
    active++;
    attempts.push(now);
    running.add(cacheKey);
    const controller = new AbortController();
    const deadline = Date.now() + CHAT_DEADLINE_MS;
    const timeout = setTimeout(() => controller.abort(), CHAT_DEADLINE_MS);
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const emit = (event: unknown) => {
      if (!res.destroyed && !res.writableEnded)
        res.write(JSON.stringify(event) + "\n");
    };
    try {
      const result = aiResultSchema.parse(
        await enrichReceipt(
          await runner(
            request,
            config,
            (text) => emit({ type: "progress", text }),
            controller.signal,
            deadline,
          ),
          config.usdaKey,
          controller.signal,
        ),
      );
      if (completed.size >= 100)
        completed.delete(completed.keys().next().value!);
      if (hosted && lease)
        await hosted.cache.finish(user, request.requestId, lease, result);
      else completed.set(cacheKey, { at: Date.now(), result });
      emit({ type: "result", result });
    } catch (error) {
      emit({ type: "error", error: publicError(error) });
    } finally {
      clearTimeout(timeout);
      active--;
      running.delete(cacheKey);
      if (hosted && lease)
        await hosted.cache.fail(user, request.requestId, lease).catch(() => {});
      res.end();
    }
  };
}
