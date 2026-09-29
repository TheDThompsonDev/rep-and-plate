import { afterEach, describe, expect, it, vi } from "vitest";
import { checkIntent } from "./ai";
import { transcribeAudio } from "./voice";
import { withGenerationTelemetry, type GenerationEvent } from "./operations";
import { tokenCost } from "./operations-services";

afterEach(() => vi.restoreAllMocks());
const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
describe("intent and transcription telemetry", () => {
  it("records Jev checks with the same request metadata and returned usage", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        answers: { record_type: { choice: "meal", confidence: 0.9 } },
        usage: { input_tokens: 12, output_tokens: 3 },
      }),
    );
    const events: GenerationEvent[] = [];
    const result = await withGenerationTelemetry(
      { userId, operation: "/api/chat" },
      async (rows) => {
        events.push(...rows);
      },
      () =>
        checkIntent(
          {
            model: "qwen3.5-flash",
            jevModel: "jev-latest",
            jevKey: "private-key",
          },
          { text: "private meal details" },
          new AbortController().signal,
        ),
    );
    expect(result).toMatchObject({ choice: "meal" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      provider: "jev",
      model: "jev-latest",
      outcome: "success",
      input_tokens: 12,
      output_tokens: 3,
    });
    expect(JSON.stringify(events)).not.toMatch(
      /private-key|private meal|confidence|record_type/,
    );
  });
  it("records rejected Jev calls without persisting provider error text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "sensitive error" }, { status: 503 }),
    );
    const events: GenerationEvent[] = [];
    await expect(
      withGenerationTelemetry(
        { userId, operation: "/api/chat" },
        async (rows) => {
          events.push(...rows);
        },
        () =>
          checkIntent(
            {
              model: "qwen3.5-flash",
              jevModel: "jev-latest",
              jevKey: "private-key",
            },
            {},
            new AbortController().signal,
          ),
      ),
    ).rejects.toThrow("JEV_503");
    expect(events[0]).toMatchObject({
      provider: "jev",
      outcome: "error",
      error_code: "HTTP_503",
      input_tokens: null,
    });
    expect(JSON.stringify(events)).not.toContain("sensitive");
  });
  it("records audio token usage without recording audio or the transcript, and requires an audio input rate", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        text: "private transcript",
        usage: {
          type: "tokens",
          input_tokens: 120,
          output_tokens: 30,
          input_token_details: { audio_tokens: 100, text_tokens: 20 },
        },
      }),
    );
    const events: GenerationEvent[] = [];
    const result = await withGenerationTelemetry(
      { userId, operation: "/api/voice" },
      async (rows) => {
        events.push(...rows);
      },
      () =>
        transcribeAudio(
          {
            bytes: Buffer.from("private audio"),
            mime: "audio/wav",
            extension: "wav",
          },
          "private-key",
          new AbortController().signal,
        ),
    );
    expect(result).toBe("private transcript");
    expect(events[0]).toMatchObject({
      provider: "openai",
      model: "gpt-4o-mini-transcribe",
      input_tokens: 120,
      input_audio_tokens: 100,
      output_tokens: 30,
      outcome: "success",
    });
    expect(JSON.stringify(events)).not.toMatch(
      /private transcript|private audio|private-key/,
    );
    const rates = {
      "openai:gpt-4o-mini-transcribe": { input: 1, cachedInput: 0, output: 2 },
    };
    expect(tokenCost(events[0], rates)).toBeNull();
    expect(
      tokenCost(events[0], {
        "openai:gpt-4o-mini-transcribe": {
          ...rates["openai:gpt-4o-mini-transcribe"],
          inputAudio: 4,
        },
      }),
    ).toBeCloseTo(0.00048);
  });
  it("keeps duration-only audio usage visible without pretending it is token usage", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        text: "hello",
        usage: { type: "duration", seconds: 7.5 },
      }),
    );
    const events: GenerationEvent[] = [];
    await withGenerationTelemetry(
      { userId, operation: "/api/voice" },
      async (rows) => {
        events.push(...rows);
      },
      () =>
        transcribeAudio(
          { bytes: Buffer.from("audio"), mime: "audio/wav", extension: "wav" },
          "key",
          new AbortController().signal,
        ),
    );
    expect(events[0]).toMatchObject({
      audio_seconds: 7.5,
      input_tokens: null,
      output_tokens: null,
    });
    expect(tokenCost(events[0], {})).toBeNull();
  });
});
