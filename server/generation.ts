import OpenAI from "openai";
import type { AutoParseableTextFormat } from "openai/lib/parser";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type { Config } from "./ai.ts";
import { ZodError } from "zod";
import { recordGenerationAttempt } from "./operations.ts";

export const QWEN_BASE_URL = "https://maas.qwencloudapi.com/compatible-mode/v1";
export const QWEN_MODEL = "qwen3.5-flash";

export function generationAvailable(config: Config) {
  return config.provider === "qwen" ? !!config.qwenKey : !!config.openaiKey;
}

type StructuredRequest<T> = Omit<ResponseCreateParamsNonStreaming, "text"> & {
  max_tool_calls?: number;
  text: { format: AutoParseableTextFormat<T> };
};

function canRecover(error: unknown) {
  if (error instanceof OpenAI.APIConnectionError) return true;
  if (error instanceof OpenAI.APIError)
    return (
      [408, 409, 429].includes(error.status ?? 0) || (error.status ?? 0) >= 500
    );
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" ||
      ["AI_INCOMPLETE", "AI_INVALID_RESPONSE"].includes(error.message))
  );
}

async function tracked<T>(
  provider: "qwen" | "openai",
  model: string,
  fallback: boolean,
  signal: AbortSignal,
  run: (usage: (response: { usage?: unknown }) => void) => Promise<T>,
) {
  const started = Date.now();
  let usage: Record<string, unknown> | undefined;
  let outcome: "success" | "error" | "cancelled" | "timeout" = "success";
  let errorCode: string | null = null;
  try {
    return await run((response) => {
      if (response.usage && typeof response.usage === "object")
        usage = response.usage as Record<string, unknown>;
    });
  } catch (error) {
    const reason = signal.aborted ? signal.reason : error;
    outcome =
      reason instanceof Error && reason.name === "TimeoutError"
        ? "timeout"
        : signal.aborted
          ? "cancelled"
          : "error";
    errorCode =
      error instanceof OpenAI.APIError
        ? `HTTP_${error.status ?? "CONNECTION"}`
        : error instanceof Error &&
            ["AI_INCOMPLETE", "AI_INVALID_RESPONSE", "AI_REFUSED"].includes(
              error.message,
            )
          ? error.message
          : outcome === "timeout"
            ? "TIMEOUT"
            : outcome === "cancelled"
              ? "CANCELLED"
              : "PROVIDER_ERROR";
    throw error;
  } finally {
    const token = (value: unknown) =>
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? value
        : null;
    const details = usage?.input_tokens_details as
      { cached_tokens?: unknown } | undefined;
    recordGenerationAttempt({
      provider,
      model,
      fallback,
      outcome,
      error_code: errorCode,
      duration_ms: Date.now() - started,
      input_tokens: token(usage?.input_tokens),
      cached_input_tokens: token(details?.cached_tokens),
      output_tokens: token(usage?.output_tokens),
    });
  }
}

async function within<T>(
  milliseconds: number,
  parent: AbortSignal,
  run: (signal: AbortSignal) => Promise<T>,
) {
  parent.throwIfAborted();
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException("AI time limit reached", "TimeoutError"),
      ),
    milliseconds,
  );
  const signal = AbortSignal.any([parent, controller.signal]);
  try {
    const result = await run(signal);
    signal.throwIfAborted();
    return result;
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** At most two generation calls, sharing the original deadline and validation. */
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
        options: { signal: AbortSignal; onFallback?: () => void },
      ) {
        return within(timeout, options.signal, async (signal) => {
          if (!qwen)
            return tracked(
              "openai",
              params.model ?? config.model,
              false,
              signal,
              async (usage) => {
                const result = await client.responses.parse(params, { signal });
                usage(result);
                return result;
              },
            );
          const fallback =
            !!config.openaiKey && config.fallbackEnabled !== false;
          try {
            return await within(
              fallback ? Math.min(45000, timeout * 0.4) : timeout,
              signal,
              async (primarySignal) =>
                tracked(
                  "qwen",
                  config.model,
                  false,
                  primarySignal,
                  async (usage) => {
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
                      { signal: primarySignal },
                    );
                    usage(response);
                    primarySignal.throwIfAborted();
                    if (
                      response.incomplete_details?.reason ===
                        "content_filter" ||
                      response.output.some(
                        (item) =>
                          item.type === "message" &&
                          item.content.some((part) => part.type === "refusal"),
                      )
                    )
                      throw new Error("AI_REFUSED");
                    if (
                      response.status !== "completed" ||
                      !response.output_text
                    )
                      throw new Error("AI_INCOMPLETE");
                    // Includes bounds/refinements, not just JSON syntax or TypeScript assertions.
                    let parsed: T;
                    try {
                      parsed = format.$parseRaw(response.output_text);
                    } catch (error) {
                      if (
                        error instanceof SyntaxError ||
                        error instanceof ZodError
                      )
                        throw new Error("AI_INVALID_RESPONSE");
                      throw error;
                    }
                    return { ...response, output_parsed: parsed };
                  },
                ),
            );
          } catch (error) {
            signal.throwIfAborted();
            if (!fallback || !canRecover(error)) throw error;
            options.onFallback?.();
            const backup = new OpenAI({
              apiKey: config.openaiKey,
              maxRetries: 0,
              timeout,
            });
            return tracked(
              "openai",
              config.fallbackModel || "gpt-5-mini",
              true,
              signal,
              async (usage) => {
                const result = await backup.responses.parse(
                  {
                    ...params,
                    model: config.fallbackModel || "gpt-5-mini",
                    store: false,
                    reasoning: { effort: "low" },
                  },
                  { signal },
                );
                usage(result);
                signal.throwIfAborted();
                if (result.status !== "completed" || !result.output_parsed)
                  throw new Error("AI_INCOMPLETE");
                return result;
              },
            );
          }
        });
      },
    },
  };
}
