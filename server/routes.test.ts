import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type RequestListener } from "node:http";
import type { AddressInfo } from "node:net";
import { createApi } from "./http.ts";
import { betaHandler, type BetaServices } from "./beta.ts";
import { AGENT_ROUTE_PREFIX, BODY_LIMITS, MAINTENANCE_ROUTE, ROUTES, cloudConfigResponse, hostedApiRoutes } from "./routes.ts";

// Local agent routes open a SQLite store; keep the test off the developer's .fuel-data file.
vi.mock("./agents/sqlite.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./agents/sqlite.ts")>();
  return { SqliteAgentStore: class extends actual.SqliteAgentStore { constructor() { super(":memory:"); } } };
});
const fixtureServices = (): BetaServices => ({
  config: { openaiKey: "test-key-not-real", jevKey: "test-jev-not-real", model: "gpt-5-mini", jevModel: "jev-latest" },
  origin: "https://health.example",
  publicConfig: { url: "https://test.supabase.co", publishableKey: "sb_publishable_testtesttesttest" },
  authenticate: async (token) => (token === "valid" ? "user-a" : null),
  admit: async () => ({ allowed: true, lease: "lease" }),
  release: async () => {},
  chatCache: { claim: async () => ({ status: "new", lease: "chat" }), finish: async () => {}, fail: async () => {} },
  deleteAccount: async () => ({ deleted: true }),
});
// The hosted entry point reads these lazily; the mocks keep Supabase and the agent store out of the test.
vi.mock("./beta-services.ts", () => ({ betaServices: () => fixtureServices() }));
vi.mock("./agents/hosted.ts", () => ({
  hostedAgentHandler: () => async (_req: unknown, res: import("node:http").ServerResponse) => {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ handler: "agents" }));
  },
}));

async function serve(listener: RequestListener, run: (url: string) => Promise<void>) {
  const server = createServer(listener);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
const call = (url: string, route: { path: string; method: string }, headers: Record<string, string> = {}) =>
  fetch(url + route.path, {
    method: route.method,
    headers: { "Content-Type": "application/json", ...headers },
    body: route.method === "POST" ? "{}" : undefined,
  });

describe("ROUTES table", () => {
  it("lists every route once with an explicit scope and partitions the entry-specific ones", () => {
    expect(new Set(ROUTES.map((route) => route.path)).size).toBe(ROUTES.length);
    for (const route of ROUTES) expect(["shared", "hosted-only", "local-only"]).toContain(route.scope);
    expect(ROUTES.filter((route) => route.scope === "hosted-only").map((route) => route.path)).toEqual([
      "/api/account/delete",
      MAINTENANCE_ROUTE,
    ]);
    expect(ROUTES.filter((route) => route.scope === "local-only")).toEqual([]);
    for (const route of ROUTES.filter((r) => r.scope === "hosted-only")) expect(route.hostedOnly).toMatch(/hosted Rep & Plate service/);
    expect(ROUTES.filter((route) => route.handler === "agents").map((route) => route.path)).toEqual(["/api/agents/v1", "/api/agents/manage"]);
    for (const route of ROUTES.filter((r) => r.handler === "agents")) expect(route.path.startsWith(AGENT_ROUTE_PREFIX)).toBe(true);
    expect(ROUTES.filter((route) => route.public).map((route) => route.path)).toEqual(["/api/cloud/config"]);
    expect(hostedApiRoutes.map((route) => route.path)).toContain("/api/account/delete");
    expect(hostedApiRoutes.some((route) => route.handler !== "api")).toBe(false);
  });
  it("keeps the four body limits in one place with the values each boundary enforced", () => {
    expect(BODY_LIMITS).toEqual({ localChat: 5_000_000, hostedPost: 4_000_000, agents: 1_000_000, accountDelete: 2048 });
  });
  it("computes cloud availability from configuration identically for both servers", () => {
    expect(cloudConfigResponse({})).toEqual({ available: false });
    expect(cloudConfigResponse({ url: "https://x.supabase.co", publishableKey: "eyJ-legacy" })).toEqual({ available: false });
    expect(cloudConfigResponse({ url: "https://x.supabase.co", publishableKey: "sb_publishable_k", supportUrl: "https://s" })).toEqual({
      available: true,
      url: "https://x.supabase.co",
      publishableKey: "sb_publishable_k",
      supportUrl: "https://s",
    });
  });
});

describe("every route is reachable through the local entry point", () => {
  it("serves shared routes, answers hosted-only routes 501, and never 404s a listed path", async () => {
    const api = createApi(fixtureServices().config, vi.fn(async () => { throw Error("no provider in this test"); }));
    await serve((req, res) => void api(req, res, () => res.writeHead(404).end()), async (url) => {
      for (const route of ROUTES) {
        const response = await call(url, route, route.handler === "agents" ? { Authorization: "Bearer token" } : {});
        const body = await response.json();
        expect(response.status, route.path).not.toBe(404);
        expect(response.status, route.path).not.toBe(405);
        if (route.scope === "hosted-only") {
          expect(response.status, route.path).toBe(501);
          expect(body.error, route.path).toBe(route.hostedOnly);
        } else if (route.handler === "agents") expect(body.error?.code, route.path).not.toBe("NOT_FOUND");
        else expect(response.status, route.path).toBeLessThan(500);
      }
    });
  });
});

describe("every route is reachable through the hosted boundary", () => {
  it("betaHandler serves each api route with the method and admission cost the table declares", async () => {
    const services = fixtureServices();
    const admitted: [string, boolean][] = [];
    services.admit = async (user, expensive) => {
      admitted.push([user, expensive]);
      return { allowed: true, lease: "lease" };
    };
    await serve(betaHandler(services), async (url) => {
      for (const route of hostedApiRoutes) {
        const response = await call(url, route, route.public ? {} : { Authorization: "Bearer valid" });
        expect(response.status, route.path).not.toBe(404);
        expect(response.status, route.path).not.toBe(405);
        expect(response.status, route.path).not.toBe(401);
        if (route.public) expect(await response.json()).toEqual(cloudConfigResponse(services.publicConfig));
        else if (route.path !== "/api/account/delete") expect(admitted.at(-1), route.path).toEqual(["user-a", route.costly]);
        const wrongMethod = await fetch(url + route.path, { method: route.method === "GET" ? "POST" : "GET", headers: { Authorization: "Bearer valid" } });
        expect(wrongMethod.status, route.path).toBe(405);
      }
      expect(admitted.some(([, expensive]) => expensive)).toBe(true);
      expect(admitted.some(([, expensive]) => !expensive)).toBe(true);
      const agents = await call(url, { path: "/api/agents/v1", method: "POST" }, { Authorization: "Bearer valid" });
      expect(agents.status).toBe(404);
      const maintenance = await fetch(url + MAINTENANCE_ROUTE, { headers: { Authorization: "Bearer valid" } });
      expect(maintenance.status).toBe(404);
    });
  });
  it("computes hosted cloud availability from the configured public config rather than hard-coding it", async () => {
    const services = fixtureServices();
    services.publicConfig = { url: "https://test.supabase.co", publishableKey: "not-a-publishable-key" };
    await serve(betaHandler(services), async (url) => {
      expect(await fetch(url + "/api/cloud/config").then((r) => r.json())).toEqual({ available: false });
    });
  });
});

describe("every route is reachable through server/vercel-entry.ts", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("PRIVATE_PREVIEW", "off");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("dispatches maintenance, agents and api routes to their handlers and honours ?endpoint=", async () => {
    const { default: health } = await import("./vercel-entry.ts");
    await serve((req, res) => void health(req, res), async (url) => {
      for (const route of ROUTES.filter((r) => r.scope !== "local-only")) {
        const response = await call(url, route, route.public ? {} : { Authorization: "Bearer valid" });
        expect(response.status, route.path).not.toBe(404);
        expect(response.status, route.path).not.toBe(405);
        const body = await response.json();
        if (route.handler === "agents") expect(body, route.path).toEqual({ handler: "agents" });
        else if (route.handler === "maintenance") expect(response.status, route.path).toBe(401);
        else expect(response.status, route.path).toBeLessThan(500);
      }
      const unknown = await fetch(url + "/api/nope", { headers: { Authorization: "Bearer valid" } });
      expect(unknown.status).toBe(404);
      const rewritten = await fetch(url + "/api/health?endpoint=cloud/config");
      expect(await rewritten.json()).toEqual(cloudConfigResponse(fixtureServices().publicConfig));
    });
  });
});
