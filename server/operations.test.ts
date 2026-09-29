import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import {
  eligibleCaptures,
  handleMaintenance,
  recordGenerationAttempt,
  withGenerationTelemetry,
  type GenerationEvent,
} from "./operations";
import { tokenCost } from "./operations-services";

afterEach(() => vi.restoreAllMocks());
const user = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const request = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const attempt = {
  provider: "qwen" as const,
  model: "qwen3.5-flash",
  fallback: false,
  outcome: "success" as const,
  error_code: null,
  duration_ms: 10,
  input_tokens: 1000,
  cached_input_tokens: 200,
  output_tokens: 100,
};

describe("private generation metadata", () => {
  it("persists only allowlisted metadata and isolates concurrent accounts", async () => {
    const saved: GenerationEvent[] = [];
    const persist = async (events: GenerationEvent[]) => {
      saved.push(...events);
    };
    await Promise.all(
      [user, request].map((userId) =>
        withGenerationTelemetry(
          { userId, operation: "/api/chat", requestId: request },
          persist,
          async () => {
            await Promise.resolve();
            recordGenerationAttempt({
              ...attempt,
              prompt: "secret health text",
              response: "private reply",
            } as typeof attempt);
            return "ok";
          },
        ),
      ),
    );
    expect(saved).toHaveLength(2);
    expect(saved.map((event) => event.user_id)).toEqual([user, request]);
    expect(JSON.stringify(saved)).not.toMatch(
      /secret health|private reply|prompt|response/,
    );
    expect(saved[0].request_id).toBe(request);
  });
  it("does not let failed metadata persistence turn a successful generation into a failed request", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      withGenerationTelemetry(
        { userId: user, operation: "/api/chat" },
        async () => {
          throw Error("database secret");
        },
        async () => {
          recordGenerationAttempt(attempt);
          return "answer";
        },
      ),
    ).resolves.toBe("answer");
    expect(console.warn).toHaveBeenCalledWith(
      "generation_telemetry_unavailable",
    );
  });
  it("preserves the original error and persists its bounded outcome", async () => {
    const sink = vi.fn(async (_events: GenerationEvent[]) => {});
    await expect(
      withGenerationTelemetry(
        { userId: user, operation: "/api/chat" },
        sink,
        async () => {
          recordGenerationAttempt({
            ...attempt,
            outcome: "error",
            error_code: "HTTP_503",
          });
          throw Error("original");
        },
      ),
    ).rejects.toThrow("original");
    expect(sink.mock.calls[0][0][0]).toMatchObject({ outcome: "error" });
  });
  it("does not record unapproved operations or free text as correlation IDs", async () => {
    const sink = vi.fn(async (_events: GenerationEvent[]) => {});
    await withGenerationTelemetry(
      { userId: user, operation: "/api/chat", requestId: "my private message" },
      sink,
      async () => recordGenerationAttempt(attempt),
    );
    expect(sink.mock.calls[0][0][0].request_id).not.toBe("my private message");
    sink.mockClear();
    await withGenerationTelemetry(
      { userId: user, operation: "/private-health-data" },
      sink,
      async () => recordGenerationAttempt(attempt),
    );
    expect(sink).not.toHaveBeenCalled();
  });
  it("leaves unpriced and incomplete usage unknown and prices cache tokens separately", () => {
    const event = { ...attempt } as GenerationEvent;
    expect(tokenCost(event, {})).toBeNull();
    const rates = {
      "qwen:qwen3.5-flash": { input: 1, cachedInput: 0.5, output: 2 },
    };
    expect(tokenCost(event, rates)).toBeCloseTo(0.0011);
    expect(tokenCost({ ...event, input_tokens: null }, rates)).toBeNull();
    expect(
      tokenCost({ ...event, cached_input_tokens: 2000 }, rates),
    ).toBeNull();
  });
});

describe("bounded temporary capture maintenance", () => {
  it("only selects old UUID-owned temporary capture names, excluding fresh, invalid and traversal paths", () => {
    const now = Date.parse("2026-09-29T12:00:00Z");
    const old = "2026-09-28T11:59:59Z";
    const name = `${user}/${request}.jpg`;
    expect(
      eligibleCaptures(
        [
          { name, created_at: old },
          {
            name: `${user}/${request}.png`,
            created_at: "2026-09-28T12:00:00Z",
          },
          { name: `../${request}.jpg`, created_at: old },
          { name: `${user}/../${request}.jpg`, created_at: old },
          { name: `${user}/${request}.svg`, created_at: old },
          { name, created_at: "invalid" },
        ],
        now,
      ),
    ).toEqual([name]);
  });
  it("requires the server cron secret, allows no mutations for a user bearer, and reports failure without details", async () => {
    const maintenance = vi.fn(async () => ({ capturesDeleted: 2 }));
    const secret = "c".repeat(48);
    const server = createServer(
      (req, res) => void handleMaintenance(req, res, secret, { maintenance }),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      for (const headers of [
        {},
        { authorization: "Bearer user-jwt" },
        { authorization: `Bearer ${"é".repeat(48)}` },
      ] as Record<string, string>[]) {
        expect((await fetch(base, { headers })).status).toBe(401);
      }
      expect(maintenance).not.toHaveBeenCalled();
      expect(
        (
          await fetch(base, {
            method: "POST",
            headers: { authorization: `Bearer ${secret}` },
          })
        ).status,
      ).toBe(405);
      const valid = await fetch(base, {
        headers: { authorization: `Bearer ${secret}` },
      });
      expect(valid.status).toBe(200);
      expect(valid.headers.get("cache-control")).toBe("no-store");
      expect(await valid.json()).toMatchObject({
        ok: true,
        result: { capturesDeleted: 2 },
      });
      maintenance.mockRejectedValueOnce(Error("private database details"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const failed = await fetch(base, {
        headers: { authorization: `Bearer ${secret}` },
      });
      expect(failed.status).toBe(503);
      expect(await failed.text()).not.toContain("private");
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
