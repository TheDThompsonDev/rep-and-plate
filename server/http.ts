import { type IncomingMessage, type ServerResponse } from "node:http";
import {
  aiRequestSchema,
  aiResultSchema,
  type AIResult,
} from "../src/ai-contract.ts";
import { runAI, type Config } from "./ai.ts";

export const readConfig = (
  env: Record<string, string | undefined>,
): Config => ({
  openaiKey: env.OPENAI_API_KEY,
  jevKey: env.JEV_API_KEY,
  model: env.OPENAI_MODEL || "gpt-5-mini",
  jevModel: env.JEV_MODEL || "jev-latest",
});
const errors: Record<string, string> = {
  OPENAI_NOT_CONFIGURED:
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
    return "The AI service could not authenticate. Check the server’s OpenAI key and project access.";
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
export function createApi(config: Config, runner = runAI) {
  const completed = new Map<string, { at: number; result: AIResult }>();
  const running = new Set<string>();
  let active = 0;
  let attempts: number[] = [];
  return async function api(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
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
    // This local server is deliberately loopback-only; reject cross-origin browser calls.
    if (
      req.headers.origin &&
      req.headers.origin !== `http://${req.headers.host}`
    )
      return json(403, { error: "Request origin is not allowed." });
    if (path === "/api/status" && req.method === "GET")
      return json(200, {
        available: !!config.openaiKey,
        jev: !!config.jevKey,
        model: config.model,
      });
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
    const cached = completed.get(request.requestId);
    if (cached) {
      res.setHeader("Content-Type", "application/x-ndjson");
      return res.end(
        JSON.stringify({ type: "result", result: cached.result }) + "\n",
      );
    }
    if (running.has(request.requestId))
      return json(409, {
        error:
          "This capture is already being processed. Wait a moment before retrying.",
      });
    attempts = attempts.filter((t) => now - t < 60000);
    if (active >= 2 || attempts.length >= 12)
      return json(429, {
        error: "Fuel is handling a few captures. Please try again in a moment.",
      });
    if (!config.openaiKey)
      return json(503, { error: errors.OPENAI_NOT_CONFIGURED });
    active++;
    attempts.push(now);
    running.add(request.requestId);
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
        await runner(
          request,
          config,
          (text) => emit({ type: "progress", text }),
          controller.signal,
        ),
      );
      if (completed.size >= 100)
        completed.delete(completed.keys().next().value!);
      completed.set(request.requestId, { at: Date.now(), result });
      emit({ type: "result", result });
    } catch (error) {
      emit({ type: "error", error: publicError(error) });
    } finally {
      clearTimeout(timeout);
      active--;
      running.delete(request.requestId);
      res.end();
    }
  };
}
