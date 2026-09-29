import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { createGenerationClient, generationAvailable } from "./generation";
import { createApi, readConfig } from "./http";
import { createServer } from "node:http";
import { requestFixture, resultFixture } from "../tests/ai-fixtures";
import { collectSources } from "./ai";

afterEach(() => vi.restoreAllMocks());
const schema = z.object({
  count: z.number().int().min(0),
  sources: z.array(z.string()),
});
const params = {
  model: "qwen3.5-flash",
  store: false,
  instructions: "Extract the count.",
  input: [
    {
      role: "user" as const,
      content: [
        {
          type: "input_image" as const,
          image_url: "data:image/png;base64,AAAA",
          detail: "high" as const,
        },
      ],
    },
  ],
  max_output_tokens: 100,
  tools: [
    { type: "web_search" as const, search_context_size: "medium" as const },
  ],
  max_tool_calls: 8,
  include: ["web_search_call.action.sources" as const],
  text: { format: zodTextFormat(schema, "count") },
};
const output = (text: string, status = "completed") =>
  new Response(
    JSON.stringify({
      id: "r",
      object: "response",
      status,
      output: [
        {
          type: "web_search_call",
          status: "completed",
          action: {
            type: "search",
            sources: [{ type: "url", url: "https://example.com/real" }],
          },
        },
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text, annotations: [] }],
        },
      ],
    }),
    { headers: { "Content-Type": "application/json" } },
  );
describe("Qwen generation boundary", () => {
  it("serves chat and status with only a Qwen key, without exposing credentials", async () => {
    const config = readConfig({ QWEN_API_KEY: "qwen-private" });
    const runner = vi.fn(async (request) => resultFixture(request.requestId));
    const api = createApi(config, runner);
    const server = createServer(
      (req, res) => void api(req, res, () => res.writeHead(404).end()),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      const status = await fetch(base + "/api/status").then((r) => r.text());
      expect(JSON.parse(status)).toMatchObject({
        available: true,
        provider: "qwen",
        model: "qwen3.5-flash",
      });
      expect(status).not.toContain("private");
      const response = await fetch(base + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestFixture()),
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('"type":"result"');
      expect(runner).toHaveBeenCalledTimes(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it("preserves the existing OpenAI path when no Qwen key is configured", async () => {
    const config = readConfig({ OPENAI_API_KEY: "openai-private" });
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(output('{"count":2,"sources":[]}'));
    await createGenerationClient(config, 30000).responses.parse(
      { ...params, model: config.model },
      { signal: new AbortController().signal },
    );
    const [url, init] = fetcher.mock.calls[0];
    const request = new Request(url, init);
    expect(request.url).toBe("https://api.openai.com/v1/responses");
    expect((await request.json()).text.format.type).toBe("json_schema");
  });
  it("uses Qwen when its key is configured, independently of the voice key", () => {
    const config = readConfig({
      QWEN_API_KEY: "qwen-private",
      OPENAI_API_KEY: "voice-private",
      OPENAI_MODEL: "gpt-5-mini",
    });
    expect(config).toMatchObject({
      provider: "qwen",
      model: "qwen3.5-flash",
      qwenBaseUrl: "https://maas.qwencloudapi.com/compatible-mode/v1",
    });
    expect(generationAvailable({ ...config, openaiKey: undefined })).toBe(true);
    expect(generationAvailable({ ...config, qwenKey: undefined })).toBe(false);
  });
  it("sends images to the configured endpoint and parses validated output without inventing source evidence", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        output('{"count":2,"sources":["https://example.com/invented"]}'),
      );
    const client = createGenerationClient(
      readConfig({ QWEN_API_KEY: "qwen-private" }),
      30000,
    );
    const result = await client.responses.parse(params, {
      signal: new AbortController().signal,
    });
    expect(result.output_parsed?.count).toBe(2);
    const [url, init] = fetcher.mock.calls[0];
    const request = new Request(url, init);
    expect(request.url).toBe(
      "https://maas.qwencloudapi.com/compatible-mode/v1/responses",
    );
    expect(request.headers.get("authorization")).toBe("Bearer qwen-private");
    const body = await request.json();
    expect(body).toMatchObject({
      model: "qwen3.5-flash",
      store: false,
      reasoning: { effort: "none" },
      tools: [{ type: "web_search" }],
    });
    expect(body.instructions).toContain('"minimum":0');
    expect(body.input[0].content[0].image_url).toContain("data:image/png");
    expect(body).not.toHaveProperty("text");
    expect(body).not.toHaveProperty("max_tool_calls");
    expect([...collectSources(result).keys()]).toEqual([
      "https://example.com/real",
    ]);
  });
  it.each([
    '{"count":-1,"sources":[]}',
    '{"count":"2","sources":[]}',
    "not json",
  ])("rejects invalid model output %s", async (text) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(output(text));
    await expect(
      createGenerationClient(
        readConfig({ QWEN_API_KEY: "q" }),
        30000,
      ).responses.parse(params, { signal: new AbortController().signal }),
    ).rejects.toThrow();
  });
  it("rejects a truncated response even when its JSON looks valid", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      output('{"count":2,"sources":[]}', "incomplete"),
    );
    await expect(
      createGenerationClient(
        readConfig({ QWEN_API_KEY: "q" }),
        30000,
      ).responses.parse(params, { signal: new AbortController().signal }),
    ).rejects.toThrow("AI_INCOMPLETE");
  });
  it("does not retry or fall back to OpenAI after a Qwen error", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      createGenerationClient(
        readConfig({ QWEN_API_KEY: "q", OPENAI_API_KEY: "o" }),
        30000,
      ).responses.parse(params, { signal: new AbortController().signal }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never sends a request after cancellation", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const controller = new AbortController();
    controller.abort();
    await expect(
      createGenerationClient(
        readConfig({ QWEN_API_KEY: "q" }),
        30000,
      ).responses.parse(params, { signal: controller.signal }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
