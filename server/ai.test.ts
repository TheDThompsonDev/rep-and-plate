import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import {
  collectSources,
  modelAnswerSchema,
  normalizeAnswer,
  checkIntent,
} from "./ai";
import { createApi, publicError } from "./http";
import { requestFixture, resultFixture } from "../tests/ai-fixtures";
const config = {
  openaiKey: "test-key-not-real",
  jevKey: "test-jev-not-real",
  model: "gpt-5-mini",
  jevModel: "jev-latest",
};
function modelFixture() {
  const r = resultFixture(crypto.randomUUID());
  return modelAnswerSchema.parse({
    reply: r.reply,
    intent: "grocery",
    store: "Kroger",
    receiptNote: "",
    items: r.receipt!.items,
    meal: null,
    sources: r.sources,
  });
}
afterEach(() => vi.restoreAllMocks());
describe("AI grounding and boundaries", () => {
  it("does not accept a model-invented URL as retrieval evidence", () => {
    const answer = modelFixture();
    const result = normalizeAnswer(
      answer,
      requestFixture(),
      collectSources({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify(answer),
                annotations: [],
              },
            ],
          },
        ],
      }),
    );
    expect(result.receipt?.items[0].nutrition).toBeNull();
    expect(result.receipt?.items[0].match).toBe("unresolved");
    expect(result.sources).toEqual([]);
  });
  it("retains per-serving nutrition only with a retrieved source; leaves unknown values blank", () => {
    const answer = modelFixture();
    const retrieved = collectSources({
      output: [
        { type: "web_search_call", action: { sources: answer.sources } },
      ],
    });
    const result = normalizeAnswer(answer, requestFixture(), retrieved);
    expect(result.receipt?.items[0].nutrition?.calories).toBe(150);
    expect(result.receipt?.items[1].nutrition).toBeNull();
    expect(result.receipt?.items[1].servingsPurchased).toBeNull();
  });
  it("holds records when JEV disagrees; groceries cannot also create a meal", () => {
    const answer = modelFixture();
    answer.meal = {
      ...resultFixture("x").receipt!.items[0].nutrition!,
      title: "Milk",
      category: "Snack",
      portion: "1 cup",
      note: "",
      sources: [],
    };
    expect(
      normalizeAnswer(answer, requestFixture(), new Map()).meal,
    ).toBeNull();
    const held = normalizeAnswer(answer, requestFixture(), new Map(), {
      choice: "conversation",
      confidence: 0.9,
    });
    expect(held.receipt).toBeNull();
    expect(held.meal).toBeNull();
    expect(held.decision).toBe("conversation");
    expect(held.warnings).toEqual([]);
    const conflicting = normalizeAnswer(answer, requestFixture(), new Map(), {
      choice: "meal",
      confidence: 0.9,
    });
    expect(conflicting.decision).toBe("uncertain");
    expect(conflicting.receipt).toBeNull();
    expect(conflicting.meal).toBeNull();
  });
  it("discloses receipt truncation instead of silently dropping lines", () => {
    const answer = modelFixture();
    answer.items = Array.from({ length: 41 }, () => answer.items[0]);
    const result = normalizeAnswer(answer, requestFixture(), new Map());
    expect(result.receipt?.items).toHaveLength(40);
    expect(result.receipt?.note).toContain(
      "Only the first 40 items were saved",
    );
  });
  it("calls only the official JEV endpoint and validates its decision", async () => {
    const mocked = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: { record_type: { choice: "grocery", confidence: 0.9 } },
        }),
        { status: 200 },
      ),
    );
    expect(
      await checkIntent(
        config,
        { currentMessage: "I bought milk" },
        new AbortController().signal,
      ),
    ).toEqual({ choice: "grocery", confidence: 0.9 });
    expect(mocked.mock.calls[0][0]).toBe(
      "https://api.typesafe.ai/v1/systemone",
    );
  });
  it("never sends raw upstream errors or credentials to the browser", () => {
    expect(
      publicError({ message: "SECRET_KEY in request body" }),
    ).not.toContain("SECRET_KEY");
    expect(publicError({ status: 401, message: "secret" })).toContain(
      "authenticate",
    );
  });
});
describe("HTTP API", () => {
  it("validates origin/body and deduplicates a completed request without a second provider call", async () => {
    const runner = vi.fn(async (req) => resultFixture(req.requestId));
    const api = createApi(config, runner);
    const server = createServer((req, res) => {
      void api(req, res, () => res.writeHead(404).end());
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const address = server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    try {
      const status = await fetch(url + "/api/status").then((r) => r.text());
      expect(status).not.toContain("test-key");
      const bad = await fetch(url + "/api/chat", {
        method: "POST",
        headers: {
          Origin: "https://attacker.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      expect(bad.status).toBe(403);
      const invalid = await fetch(url + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(invalid.status).toBe(400);
      const req = requestFixture();
      const post = () =>
        fetch(url + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        }).then((r) => r.text());
      expect(await post()).toContain('"type":"result"');
      expect(await post()).toContain('"type":"result"');
      expect(runner).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});
