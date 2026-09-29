import type { IncomingMessage, ServerResponse } from "node:http";
import { createApi } from "./http.ts";
import type { Config } from "./ai.ts";
import type { ChatCache } from "./chat-cache.ts";
import { Readable } from "node:stream";

export type BetaServices = {
  config: Config;
  origin: string;
  publicConfig: { url: string; publishableKey: string };
  authenticate: (token: string) => Promise<string | null>;
  admit: (
    user: string,
    expensive: boolean,
  ) => Promise<{ allowed: boolean; lease: string }>;
  release: (lease: string) => Promise<void>;
  chatCache: ChatCache;
  readCapture?: (
    user: string,
    path: string,
  ) => Promise<{ bytes: Buffer; mime: string }>;
};
const routes = new Set([
  "/api/status",
  "/api/chat",
  "/api/products/search",
  "/api/products/lookup",
  "/api/products/label",
  "/api/plans/workout",
  "/api/plans/meals",
  "/api/voice",
  "/api/shopping/prices",
]);
const costly = new Set([
  "/api/chat",
  "/api/products/label",
  "/api/plans/workout",
  "/api/plans/meals",
  "/api/voice",
  "/api/shopping/prices",
]);
export function betaHandler(services: BetaServices) {
  // One handler keeps public USDA caches bounded. Private chat caching is in Postgres.
  const api = createApi(services.config, undefined, {
    cache: services.chatCache,
  });
  return async (req: IncomingMessage, res: ServerResponse) => {
    const json = (status: number, value: unknown) => {
      if (res.writableEnded || res.destroyed) return;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Vary", "Origin");
    const origin = req.headers.origin;
    if (origin && origin !== services.origin)
      return json(403, { error: "Request origin is not allowed." });
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    const path = (req.url ?? "").split("?")[0];
    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.writeHead(204).end();
      return;
    }
    // Public bootstrap is necessary to sign in; it contains no service credentials.
    if (path === "/api/cloud/config" && req.method === "GET")
      return json(200, { available: true, ...services.publicConfig });
    if (!routes.has(path)) return json(404, { error: "Not found." });
    if (req.method !== (path === "/api/status" ? "GET" : "POST"))
      return json(405, { error: "Method not allowed." });
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ") || authorization.length > 8192)
      return json(401, { error: "Sign in to continue." });
    let lease: string | undefined;
    try {
      const user = await services.authenticate(authorization.slice(7));
      if (!user)
        return json(401, { error: "Your session expired. Sign in again." });
      const admission = await services.admit(user, costly.has(path));
      if (!admission.allowed) {
        res.setHeader("Retry-After", "60");
        return json(429, {
          error:
            "Beta access is unavailable or your usage limit was reached. Please try later.",
        });
      }
      lease = admission.lease;
      let input = req;
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const part of req) {
          size += part.length;
          if (size > 4_000_000)
            return json(413, {
              error:
                "Upload large photos and recordings through private capture storage.",
            });
          chunks.push(Buffer.from(part));
        }
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          return json(400, { error: "The capture could not be read." });
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          return json(400, { error: "Send a JSON object." });
        if (body.capture) {
          const capture = body.capture as { path?: string; kind?: string };
          if (
            !services.readCapture ||
            typeof capture.path !== "string" ||
            !capture.path.startsWith(user + "/") ||
            !/^[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp|m4a|webm|ogg|wav)$/.test(
              capture.path,
            )
          )
            return json(400, {
              error: "This capture does not belong to your account.",
            });
          const file = await services.readCapture(user, capture.path);
          if (
            capture.kind === "image" &&
            ["/api/chat", "/api/products/label"].includes(path) &&
            /^image\/(jpeg|png|webp)$/.test(file.mime) &&
            file.bytes.length <= 3_300_000
          )
            body.image = `data:${file.mime};base64,${file.bytes.toString("base64")}`;
          else if (
            capture.kind === "audio" &&
            path === "/api/voice" &&
            /^audio\/(mp4|webm|ogg|wav)$/.test(file.mime) &&
            file.bytes.length <= 6 * 1024 * 1024
          ) {
            body.audio = file.bytes.toString("base64");
            body.mime = file.mime;
          } else
            return json(400, {
              error: "Use a smaller supported photo or recording.",
            });
          delete body.capture;
        }
        input = Readable.from([
          Buffer.from(JSON.stringify(body)),
        ]) as IncomingMessage;
        input.headers = { ...req.headers };
        input.method = req.method;
        input.url = req.url;
        delete input.headers["content-length"];
      }
      // Only this verified boundary can reach the loopback-only domain handlers.
      input.headers.host = "localhost";
      delete input.headers.origin;
      delete input.headers.authorization;
      await api(input, res, () => json(404, { error: "Not found." }), user);
    } catch {
      if (res.headersSent) res.end();
      else
        json(503, {
          error:
            "The service is temporarily unavailable. Your records are still on this device.",
        });
    } finally {
      // Failure leaves a bounded lease; expiry recovers after a killed invocation.
      if (lease) await services.release(lease).catch(() => {});
    }
  };
}
