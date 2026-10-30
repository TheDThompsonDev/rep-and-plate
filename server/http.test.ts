import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { createApi, readConfig } from "./http.ts";
import type { AIResult } from "../src/ai-contract.ts";
import { requestFixture, resultFixture } from "../tests/ai-fixtures.ts";

// Providers are never called: the runner is a vi.fn, exactly as server/ai.test.ts drives createApi.
const config = {
  openaiKey: "test-key-not-real",
  jevKey: "test-jev-not-real",
  model: "gpt-5-mini",
  jevModel: "jev-latest",
};
type Api = ReturnType<typeof createApi>;
type Raw = { status: number; headers: Record<string, string | string[] | undefined>; body: string };

async function serve(api: Api, run: (url: string, port: number) => Promise<void>) {
  const server = createServer((req, res) => {
    void api(req, res, () => res.writeHead(404).end("fallthrough"));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`, port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
function raw(
  port: number,
  options: { path: string; method?: string; headers?: Record<string, string | number>; body?: Buffer | string },
) {
  return new Promise<Raw>((resolve, reject) => {
    const request = httpRequest(
      { hostname: "127.0.0.1", port, path: options.path, method: options.method ?? "GET", headers: options.headers },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk.toString()));
        response.on("end", () => resolve({ status: response.statusCode!, headers: response.headers, body }));
      },
    );
    request.on("error", reject);
    request.end(options.body);
  });
}
const chat = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
/** A runner whose completion the test controls, so in-flight states can be observed. */
function gate() {
  const waiting = new Map<string, () => void>();
  const runner = vi.fn(
    (request: { requestId: string }) =>
      new Promise<AIResult>((resolve) => waiting.set(request.requestId, () => resolve(resultFixture(request.requestId)))),
  );
  return {
    runner,
    release: (id: string) => waiting.get(id)?.(),
    releaseAll: () => waiting.forEach((release) => release()),
  };
}
afterEach(() => vi.restoreAllMocks());

describe("createApi request boundary", () => {
  it("hands non-API paths to the next handler without touching headers", async () => {
    await serve(createApi(config, vi.fn()), async (url) => {
      const response = await fetch(url + "/index.html");
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("fallthrough");
      expect(response.headers.get("cache-control")).toBeNull();
    });
  });
  it("rejects foreign and unparsable hosts and cross-origin browsers, but allows the loopback origin", async () => {
    await serve(createApi(config, vi.fn()), async (url, port) => {
      const foreign = await raw(port, { path: "/api/status", headers: { Host: "attacker.example" } });
      expect(foreign.status).toBe(403);
      expect(JSON.parse(foreign.body).error).toContain("local requests only");
      const unparsable = await raw(port, { path: "/api/status", headers: { Host: "bad host" } });
      expect(unparsable.status).toBe(403);
      expect(JSON.parse(unparsable.body)).toEqual({ error: "Invalid host." });
      const crossOrigin = await fetch(url + "/api/status", { headers: { Origin: "https://attacker.example" } });
      expect(crossOrigin.status).toBe(403);
      expect((await crossOrigin.json()).error).toContain("origin");
      const sameOrigin = await fetch(url + "/api/status", { headers: { Origin: url } });
      expect(sameOrigin.status).toBe(200);
      expect(sameOrigin.headers.get("cache-control")).toBe("no-store");
      expect(sameOrigin.headers.get("x-content-type-options")).toBe("nosniff");
    });
  });
  it("reports status from configuration without leaking any key", async () => {
    await serve(createApi(config, vi.fn()), async (url) => {
      const response = await fetch(url + "/api/status");
      expect(await response.json()).toEqual({ available: true, provider: "openai", jev: true, model: "gpt-5-mini", usda: false });
    });
    await serve(createApi(readConfig({ QWEN_API_KEY: "qwen-test-not-real", FOODDATA_GOV_API: "usda-test" }), vi.fn()), async (url) => {
      const text = await fetch(url + "/api/status").then((r) => r.text());
      expect(JSON.parse(text)).toEqual({ available: true, provider: "qwen", jev: false, model: "qwen3.5-flash", usda: true });
      expect(text).not.toContain("qwen-test-not-real");
      expect(text).not.toContain("usda-test");
    });
    await serve(createApi(readConfig({}), vi.fn()), async (url) => {
      expect(await fetch(url + "/api/status").then((r) => r.json())).toEqual({
        available: false,
        provider: "openai",
        jev: false,
        model: "gpt-5-mini",
        usda: false,
      });
    });
  });
  it("answers cloud config as unavailable unless a publishable key and URL are configured", async () => {
    await serve(createApi(readConfig({}), vi.fn()), async (url) => {
      expect(await fetch(url + "/api/cloud/config").then((r) => r.json())).toEqual({ available: false });
    });
    await serve(
      createApi(readConfig({ SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_PUBLISHABLE_KEY: "eyJ-legacy-anon-key" }), vi.fn()),
      async (url) => {
        const text = await fetch(url + "/api/cloud/config").then((r) => r.text());
        expect(JSON.parse(text)).toEqual({ available: false });
        expect(text).not.toContain("eyJ");
      },
    );
    await serve(
      createApi(readConfig({ SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key_0001" }), vi.fn()),
      async (url) => {
        expect(await fetch(url + "/api/cloud/config").then((r) => r.json())).toEqual({
          available: true,
          url: "https://fixture.supabase.co",
          publishableKey: "sb_publishable_fixture_key_0001",
        });
      },
    );
  });
  it("answers unknown API routes with a JSON 404", async () => {
    await serve(createApi(config, vi.fn()), async (url) => {
      for (const path of ["/api/nope", "/api/products/unknown", "/api/chat/extra"]) {
        const response = await fetch(url + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        expect(response.status, path).toBe(404);
        expect(await response.json()).toEqual({ error: "Not found." });
      }
    });
  });
  it("answers a known route with the wrong method as 405, naming the allowed method", async () => {
    await serve(createApi(config, vi.fn()), async (url) => {
      const chatGet = await fetch(url + "/api/chat");
      expect(chatGet.status).toBe(405);
      expect(chatGet.headers.get("allow")).toBe("POST");
      const statusPost = await fetch(url + "/api/status", { method: "POST" });
      expect(statusPost.status).toBe(405);
      expect(statusPost.headers.get("allow")).toBe("GET");
    });
  });
  it("uses a pre-parsed body instead of reading the stream when the caller supplies one", async () => {
    const runner = vi.fn(async (request: { requestId: string }) => resultFixture(request.requestId));
    const api = createApi(config, runner);
    const request = requestFixture();
    const seen: import("node:http").IncomingMessage[] = [];
    await serve(
      (req, res, next) => {
        seen.push(req);
        return api(req, res, next, "local", { body: request });
      },
      async (url) => {
        // The wire body is not even JSON: only the supplied object is used and the stream stays unread.
        const response = await chat(url, "{this is not json");
        expect(response.status).toBe(200);
        expect(await response.text()).toContain('"type":"result"');
        expect(runner).toHaveBeenCalledTimes(1);
        // Node dumps the unconsumed request after the response, so the proof is the 200 above:
        // the wire body would have been a 400 had createApi parsed the stream.
        expect(seen).toHaveLength(1);
      },
    );
  });
  it("answers local account deletion with 501 and hosted-only copy", async () => {
    await serve(createApi(config, vi.fn()), async (url) => {
      const response = await fetch(url + "/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE", password: "x" }),
      });
      expect(response.status).toBe(501);
      expect((await response.json()).error).toContain("hosted account connection");
      const maintenance = await fetch(url + "/api/maintenance");
      expect(maintenance.status).toBe(501);
      expect((await maintenance.json()).error).toContain("hosted Rep & Plate service");
    });
  });
});

describe("createApi chat body handling", () => {
  it("requires JSON, rejects unreadable and schema-invalid bodies, and never calls the provider for them", async () => {
    const runner = vi.fn();
    await serve(createApi(config, runner), async (url) => {
      const text = await fetch(url + "/api/chat", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hello" });
      expect(text.status).toBe(415);
      const unreadable = await chat(url, "{not json");
      expect(unreadable.status).toBe(400);
      expect((await unreadable.json()).error).toContain("could not be read");
      const invalid = await chat(url, { requestId: "not-a-uuid" });
      expect(invalid.status).toBe(400);
      expect((await invalid.json()).error).toContain("invalid");
      expect(runner).not.toHaveBeenCalled();
    });
  });
  it("stops reading a body above the local limit with 413", async () => {
    const runner = vi.fn();
    await serve(createApi(config, runner), async (url) => {
      const oversized = `{"text":"${"a".repeat(5_000_001)}"}`;
      const response = await chat(url, oversized);
      expect(response.status).toBe(413);
      expect((await response.json()).error).toContain("too large");
      expect(runner).not.toHaveBeenCalled();
    });
  });
  it("answers 503 when no provider key is configured, before any provider call", async () => {
    const runner = vi.fn();
    await serve(createApi(readConfig({}), runner), async (url) => {
      const response = await chat(url, requestFixture());
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain("isn’t configured");
      expect(runner).not.toHaveBeenCalled();
    });
  });
});

describe("createApi admission and replay", () => {
  it("answers 409 while the same request is in flight, replays the result for ten minutes, then runs again", async () => {
    const { runner, release } = gate();
    await serve(createApi(config, runner), async (url) => {
      const request = requestFixture();
      const first = chat(url, request);
      await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(1));
      const duplicate = await chat(url, request);
      expect(duplicate.status).toBe(409);
      expect((await duplicate.json()).error).toContain("already being processed");
      release(request.requestId);
      const stream = await (await first).text();
      expect(stream).toContain('"type":"result"');
      const replay = await chat(url, request);
      expect(replay.headers.get("content-type")).toBe("application/x-ndjson");
      expect(await replay.text()).toBe(stream.slice(stream.indexOf('{"type":"result"')));
      expect(runner).toHaveBeenCalledTimes(1);
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now + 600_001);
      const expired = chat(url, request);
      await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(2));
      release(request.requestId);
      expect(await (await expired).text()).toContain('"type":"result"');
    });
  });
  it("answers 429 once two captures are active locally", async () => {
    const { runner, releaseAll } = gate();
    await serve(createApi(config, runner), async (url) => {
      const pending = [chat(url, requestFixture()), chat(url, requestFixture())];
      await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(2));
      const limited = await chat(url, requestFixture());
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
      expect((await limited.json()).error).toContain("handling a few captures");
      releaseAll();
      for (const response of await Promise.all(pending)) expect(await response.text()).toContain('"type":"result"');
      expect(runner).toHaveBeenCalledTimes(2);
    });
  });
  it("aborts the provider request when the client disconnects mid-stream", async () => {
    let aborted = false;
    const runner = vi.fn(
      (request: { requestId: string }, _config: unknown, _progress: unknown, signal: AbortSignal, deadline?: number) =>
        new Promise<AIResult>((resolve) => {
          expect(deadline).toBeGreaterThan(Date.now());
          signal.addEventListener(
            "abort",
            () => {
              aborted = true;
              resolve(resultFixture(request.requestId));
            },
            { once: true },
          );
        }),
    );
    await serve(createApi(config, runner), async (_url, port) => {
      const body = JSON.stringify(requestFixture());
      await new Promise<void>((resolve, reject) => {
        const request = httpRequest(
          { hostname: "127.0.0.1", port, path: "/api/chat", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": body.length } },
          (response) => {
            expect(response.statusCode).toBe(200);
            request.destroy();
            resolve();
          },
        );
        request.on("error", reject);
        request.end(body);
      });
      await vi.waitFor(() => expect(aborted).toBe(true));
    });
  });
  it("uses the hosted cache instead of local dedupe when hosted", async () => {
    const claim = vi.fn();
    const finish = vi.fn(async () => {});
    const fail = vi.fn(async () => {});
    const runner = vi.fn(async (request: { requestId: string }) => resultFixture(request.requestId));
    const api = createApi(config, runner, { cache: { claim, finish, fail } });
    await serve(api, async (url, port) => {
      const request = requestFixture();
      const cached = resultFixture(request.requestId);
      claim.mockResolvedValueOnce({ status: "cached", result: cached });
      const hit = await raw(port, { path: "/api/chat", method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      expect(hit.status).toBe(200);
      expect(JSON.parse(hit.body.trim())).toEqual({ type: "result", result: cached });
      claim.mockResolvedValueOnce({ status: "busy" });
      expect((await chat(url, request)).status).toBe(409);
      claim.mockResolvedValueOnce({ status: "mismatch" });
      const mismatch = await chat(url, request);
      expect(mismatch.status).toBe(409);
      expect((await mismatch.json()).error).toContain("changed");
      claim.mockResolvedValueOnce({ status: "new", lease: "lease-1" });
      expect(await (await chat(url, request)).text()).toContain('"type":"result"');
      expect(runner).toHaveBeenCalledTimes(1);
      expect(finish).toHaveBeenCalledWith("local", request.requestId, "lease-1", expect.objectContaining({ requestId: request.requestId }));
      claim.mockResolvedValueOnce({ status: "new", lease: "lease-2" });
      expect(await (await chat(url, request)).text()).toContain('"type":"result"');
      expect(runner).toHaveBeenCalledTimes(2);
      expect(claim.mock.calls.every(([user]) => user === "local")).toBe(true);
    });
  });
});
