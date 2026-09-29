import { type IncomingMessage, type ServerResponse } from "node:http";
import {
  aiRequestSchema,
  aiResultSchema,
  type AIResult,
} from "../src/ai-contract.ts";
import { runAI, type Config } from "./ai.ts";
import { createProductSearchApi } from "./products/search.ts";
import { createProductApi } from "./products/http.ts";
import { createPlanApi } from "./plans.ts";
import { createVoiceApi } from "./voice.ts";
import { enrichReceipt } from "./products/enrich.ts";
import { createShoppingApi } from "./shopping.ts";
import { createHash } from "node:crypto";
import type { ChatCache } from "./chat-cache.ts";
import { generationAvailable, QWEN_BASE_URL, QWEN_MODEL } from "./generation.ts";

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
  AI_NOT_CONFIGURED:
    "AI isn’t configured on the server yet. Your message is still here.",
  AI_INCOMPLETE:
    "I couldn’t finish that response. Your capture is saved here; please try again.",
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
  const completed = new Map<string, { at: number; result: AIResult }>();
  const running = new Set<string>();
  let active = 0;
  let attempts: number[] = [];
  return async function api(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
    user = "local",
  ) {
    const path = (req.url ?? "").split("?")[0];
    if (!path.startsWith("/api/")) return next();
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
    if (path === "/api/status" && req.method === "GET")
      return json(200, {
        available: generationAvailable(config),
        provider: config.provider || "openai",
        jev: !!config.jevKey,
        model: config.model,
        usda: !!config.usdaKey,
      });
    if (path === "/api/cloud/config" && req.method === "GET") {
      const key = config.supabasePublishableKey;
      // This response intentionally excludes all service-role/secret credentials.
      if (!config.supabaseUrl || !key?.startsWith("sb_publishable_"))
        return json(200, { available: false });
      return json(200, {
        available: true,
        url: config.supabaseUrl,
        publishableKey: key,
      });
    }
    if (path === "/api/products/search") return productSearchApi(req, res);
    if (path.startsWith("/api/products/")) return productApi(req, res);
    if (path === "/api/plans/workout" || path === "/api/plans/meals")
      return planApi(req, res);
    if (path === "/api/voice") return voiceApi(req, res);
    if (path === "/api/shopping/prices") return shoppingApi(req, res);
    if (path !== "/api/chat" || req.method !== "POST")
      return json(404, { error: "Not found." });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return json(415, { error: "Send JSON." });
    let body: unknown;
    try {
      let size = 0;
      const buffers: Buffer[] = [];
      for await (const part of req) {
        const chunk = Buffer.from(part);
        size += chunk.length;
        if (size > 5000000)
          return json(413, {
            error: "This capture is too large. Use a smaller image.",
          });
        buffers.push(chunk);
      }
      body = JSON.parse(Buffer.concat(buffers).toString("utf8"));
    } catch {
      return json(400, { error: "The request could not be read." });
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
    if (!hosted && (active >= 2 || attempts.length >= 12))
      return json(429, {
        error:
          "Rep & Plate is handling a few captures. Please try again in a moment.",
      });
    if (!generationAvailable(config))
      return json(503, { error: errors.AI_NOT_CONFIGURED });
    let lease: string | undefined;
    if (hosted) {
      const claim = await hosted.cache.claim(
        user,
        request.requestId,
        createHash("sha256").update(JSON.stringify(request)).digest("hex"),
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
    const timeout = setTimeout(() => controller.abort(), 180000);
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
