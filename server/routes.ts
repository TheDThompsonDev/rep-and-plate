import type { IncomingMessage } from "node:http";

/**
 * The one description of every API route. Both servers derive their dispatch from it:
 * local `createApi` (`server/index.ts`, `vite.config.ts`) and hosted `betaHandler` +
 * `server/vercel-entry.ts` (bundled into `api/health.mjs`). A route added here is served by
 * both, so the hosted table cannot silently fall behind the local if-chain again.
 * `server/routes.test.ts` walks this list through each entry point.
 */
export type RouteScope = "shared" | "hosted-only" | "local-only";
export type RouteHandler = "api" | "agents" | "maintenance";
export type Route = {
  path: string;
  method: "GET" | "POST";
  /** Which entry points serve the route. The local server answers a hosted-only route with 501. */
  scope: RouteScope;
  /**
   * Which handler family answers it: `api` is `createApi` (wrapped by `betaHandler` hosted),
   * `agents` the connections handler (own auth, dispatched before `api` on both sides),
   * `maintenance` the cron endpoint `vercel-entry.ts` serves before everything else.
   */
  handler: RouteHandler;
  /** Hosted admission counts the request against the expensive (provider-call) quota. */
  costly: boolean;
  /** Hosted serves it without a bearer token; only the sign-in bootstrap qualifies. */
  public?: boolean;
  /** Copy the local server returns with 501 for a hosted-only route. */
  hostedOnly?: string;
};
const shared = (path: string, method: Route["method"], costly: boolean, handler: RouteHandler = "api"): Route => ({
  path,
  method,
  scope: "shared",
  handler,
  costly,
});
export const ROUTES: readonly Route[] = [
  shared("/api/status", "GET", false),
  { ...shared("/api/cloud/config", "GET", false), public: true },
  shared("/api/chat", "POST", true),
  shared("/api/products/search", "POST", false),
  shared("/api/products/lookup", "POST", false),
  shared("/api/products/label", "POST", true),
  shared("/api/plans/workout", "POST", true),
  shared("/api/plans/meals", "POST", true),
  shared("/api/voice", "POST", true),
  shared("/api/shopping/prices", "POST", true),
  shared("/api/agents/v1", "POST", false, "agents"),
  shared("/api/agents/manage", "POST", false, "agents"),
  // Hosted-only allow-list. Deletion needs the Supabase admin credentials and maintenance the
  // cron secret; the loopback server holds neither, so it answers 501 with the copy below.
  {
    path: "/api/account/delete",
    method: "POST",
    scope: "hosted-only",
    handler: "api",
    costly: false,
    hostedOnly:
      "Account deletion runs on the hosted Rep & Plate service, not this local server. Use your hosted account connection to manage your account.",
  },
  {
    path: "/api/maintenance",
    method: "GET",
    scope: "hosted-only",
    handler: "maintenance",
    costly: false,
    hostedOnly: "Scheduled maintenance runs on the hosted Rep & Plate service, not this local server.",
  },
  // Local-only allow-list: none today. A route that must never reach the hosted service goes
  // here with scope "local-only"; `betaHandler` then answers it 404.
];
/** `createApi` routes the hosted boundary forwards (local-only routes answer 404 hosted). */
export const hostedApiRoutes: readonly Route[] = ROUTES.filter(
  (route) => route.handler === "api" && route.scope !== "local-only",
);
export const routeFor = (path: string) => ROUTES.find((route) => route.path === path);
/** Connections handler prefix; both entry points dispatch it before the main API. */
export const AGENT_ROUTE_PREFIX = "/api/agents/";
export const MAINTENANCE_ROUTE = "/api/maintenance";

/**
 * Request-body ceilings in bytes. Each handler reads its stream once against exactly one of
 * these. (Product, plan, voice and shopping handlers keep their own smaller per-route caps.)
 */
export const BODY_LIMITS = {
  /**
   * Local `/api/chat`: captures travel inline on the loopback server, so the JSON carries a
   * base64 JPG/PNG/WebP (3.3 MB raw is about 4.4 MB encoded) plus text, history and context.
   */
  localChat: 5_000_000,
  /**
   * Hosted POST routes: the client body is read once here, before any stored capture is
   * rehydrated server-side. Smaller than local because large media belongs in private
   * capture storage, and the 413 copy says so.
   */
  hostedPost: 4_000_000,
  /** Agent connection requests (`/api/agents/*`): structured JSON operations, never media. */
  agents: 1_000_000,
  /** `/api/account/delete`: a confirmation word and a password; anything larger is not a deletion. */
  accountDelete: 2048,
} as const;

export type JsonBody = { ok: true; body: unknown } | { ok: false; reason: "too-large" | "unreadable" };
/**
 * Reads a JSON body once, stopping at `limit` bytes. Chunks are concatenated before decoding so
 * a multi-byte character split across TCP chunks survives (see `server/beta.test.ts`).
 */
export async function readJsonBody(req: IncomingMessage, limit: number): Promise<JsonBody> {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const part of req) {
      const chunk = Buffer.from(part);
      size += chunk.length;
      if (size > limit) return { ok: false, reason: "too-large" };
      chunks.push(chunk);
    }
    return { ok: true, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}

/**
 * The `/api/cloud/config` body both servers return. It is the sign-in bootstrap and never
 * includes service-role or secret credentials. Availability is computed from configuration on
 * both sides; hosted is always available because `betaServices` validates the same values at
 * startup and refuses to start otherwise.
 */
export function cloudConfigResponse(config: { url?: string; publishableKey?: string; supportUrl?: string }) {
  if (!config.url || !config.publishableKey?.startsWith("sb_publishable_")) return { available: false as const };
  return {
    available: true as const,
    url: config.url,
    publishableKey: config.publishableKey,
    ...(config.supportUrl ? { supportUrl: config.supportUrl } : {}),
  };
}
