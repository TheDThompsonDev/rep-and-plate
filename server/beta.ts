import type { IncomingMessage, ServerResponse } from "node:http";
import { createApi, type ApiInput } from "./http.ts";
import { captureSchema } from "../src/ai-contract.ts";
import type { Config } from "./ai.ts";
import type { ChatCache } from "./chat-cache.ts";
import { Readable } from "node:stream";
import {AccountError} from './account.ts';
import {withGenerationTelemetry,type GenerationEvent} from './operations.ts';
import { BODY_LIMITS, cloudConfigResponse, hostedApiRoutes, readJsonBody } from "./routes.ts";

export type BetaServices = {
  config: Config;
  origin: string;
  publicConfig: { url: string; publishableKey: string;supportUrl?:string };
  authenticate: (token: string) => Promise<string | null>;
  admit: (
    user: string,
    expensive: boolean,
  ) => Promise<{ allowed: boolean; lease: string }>;
  release: (lease: string) => Promise<void>;
  chatCache: ChatCache;
  deleteAccount?:(token:string,input:unknown)=>Promise<{deleted:true}>;
  recordGeneration?:(events:GenerationEvent[])=>Promise<void>;
  readCapture?: (
    user: string,
    path: string,
  ) => Promise<{ bytes: Buffer; mime: string }>;
};
// Method and admission cost come from the shared route table; nothing is listed twice.
const routes = new Map(hostedApiRoutes.map((route) => [route.path, route] as const));
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
    const route = routes.get(path);
    if (!route) return json(404, { error: "Not found." });
    if (req.method !== route.method)
      return json(405, { error: "Method not allowed." });
    // Public bootstrap is necessary to sign in; it contains no service credentials. Availability is
    // computed exactly as the local server computes it; it is always true here because
    // `betaServices` validated `publicConfig` at startup and throws BETA_CONFIG otherwise.
    if (route.public) return json(200, cloudConfigResponse(services.publicConfig));
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ") || authorization.length > 8192)
      return json(401, { error: "Sign in to continue." });
    let lease: string | undefined;
    try {
      const user = await services.authenticate(authorization.slice(7));
      if (!user)
        return json(401, { error: "Your session expired. Sign in again." });
      if(path==='/api/account/delete'){
        if(!services.deleteAccount)return json(503,{error:'Account management is unavailable. Please retry later.'});
        const read=await readJsonBody(req,BODY_LIMITS.accountDelete);
        if(!read.ok)return read.reason==='too-large'?json(413,{error:'Account request is too large.'}):json(400,{error:'Check the account request.'});
        return json(200,await services.deleteAccount(authorization.slice(7),read.body));
      }
      const admission = await services.admit(user, route.costly);
      if (!admission.allowed) {
        res.setHeader("Retry-After", "60");
        return json(429, {
          error:
            "Beta access is unavailable or your usage limit was reached. Please try later.",
        });
      }
      lease = admission.lease;
      let input = req;
      let parsed: ApiInput | undefined;
      let requestId:string|undefined;
      if (req.method === "POST") {
        const read = await readJsonBody(req, BODY_LIMITS.hostedPost);
        if (!read.ok)
          return read.reason === "too-large"
            ? json(413, { error: "Upload large photos and recordings through private capture storage." })
            : json(400, { error: "The capture could not be read." });
        if (!read.body || typeof read.body !== "object" || Array.isArray(read.body))
          return json(400, { error: "Send a JSON object." });
        const body = read.body as Record<string, unknown>;
        requestId=typeof body.requestId==='string'?body.requestId:undefined;
        if (body.capture) {
          const parsedCapture = captureSchema.safeParse(body.capture);
          if (!parsedCapture.success)
            return json(400, { error: "The capture could not be read." });
          const capture = parsedCapture.data;
          if (!services.readCapture || !capture.path.startsWith(user + "/"))
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
        if (path === "/api/chat") parsed = { body };
        else {
          // Product, plan, voice and shopping handlers read their own request stream, so they
          // still receive the verified body re-serialized; chat above is parsed exactly once.
          input = Readable.from([
            Buffer.from(JSON.stringify(body)),
          ]) as IncomingMessage;
          input.headers = { ...req.headers };
          input.method = req.method;
          input.url = req.url;
          delete input.headers["content-length"];
        }
      }
      // Only this verified boundary can reach the loopback-only domain handlers.
      input.headers.host = "localhost";
      delete input.headers.origin;
      delete input.headers.authorization;
      const run=()=>api(input,res,()=>json(404,{error:'Not found.'}),user,parsed);
      if(services.recordGeneration)await withGenerationTelemetry({userId:user,operation:path,requestId},services.recordGeneration,run);
      else await run();
    } catch(error) {
      if(error instanceof AccountError)return json(error.status,{error:error.message});
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
