import OpenAI from "openai";
import type { AutoParseableTextFormat } from "openai/lib/parser";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type { Config } from "./ai.ts";

export const QWEN_BASE_URL = "https://maas.qwencloudapi.com/compatible-mode/v1";
export const QWEN_MODEL = "qwen3.5-flash";

export function generationAvailable(config: Config) {
  return config.provider === "qwen" ? !!config.qwenKey : !!config.openaiKey;
}

type StructuredRequest<T> = Omit<ResponseCreateParamsNonStreaming, "text"> & {
  max_tool_calls?: number;
  text: { format: AutoParseableTextFormat<T> };
};

/** One provider per request. A failure must never trigger an unbudgeted fallback. */
export function createGenerationClient(config: Config, timeout: number) {
  if (!generationAvailable(config)) throw new Error("AI_NOT_CONFIGURED");
  const qwen = config.provider === "qwen";
  const client = new OpenAI({
    apiKey: qwen ? config.qwenKey : config.openaiKey,
    ...(qwen ? { baseURL: config.qwenBaseUrl || QWEN_BASE_URL } : {}),
    maxRetries: 0,
    timeout,
  });
  return {
    responses: {
      async parse<T>(
        params: StructuredRequest<T>,
        options: { signal: AbortSignal },
      ) {
        options.signal.throwIfAborted();
        if (!qwen) return client.responses.parse(params, options);

        // Qwen 3.5 does not enforce Responses text.format JSON schemas. Supply the
        // schema as instructions and run the SAME Zod parser locally before use.
        // Responses is required here: Chat Completions does not return search sources.
        const format = params.text.format;
        const response = await client.responses.create(
          {
            model: config.model,
            store: false,
            reasoning: { effort: "none" },
            instructions: `${params.instructions ?? ""}\nReturn only one JSON object matching this JSON Schema. No Markdown fences or commentary outside JSON. Use null only where allowed.\n${JSON.stringify(format.schema)}`,
            input: params.input,
            max_output_tokens: params.max_output_tokens,
            ...(params.tools?.length
              ? { tools: [{ type: "web_search" as const }] }
              : {}),
          },
          options,
        );
        options.signal.throwIfAborted();
        if (response.status !== "completed" || !response.output_text)
          throw new Error("AI_INCOMPLETE");
        // Includes bounds/refinements, not just JSON syntax or TypeScript assertions.
        const parsed = format.$parseRaw(response.output_text);
        return { ...response, output_parsed: parsed };
      },
    },
  };
}
