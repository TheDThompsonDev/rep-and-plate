# AI providers

Qwen 3.5-Flash handles chat, receipt and nutrition-label images, meal and workout drafts, and researched price leads. Web and native clients share these server routes. `QWEN_API_KEY` selects Qwen when present; `QWEN_MODEL` defaults to `qwen3.5-flash` and `QWEN_BASE_URL` to the user-selected `https://maas.qwencloudapi.com/compatible-mode/v1`. Keys remain server-only. Existing installations without a Qwen key retain their OpenAI configuration. A failed Qwen call never retries automatically or switches providers.

`server/generation.ts` centralizes the provider boundary. Qwen Responses supports images and search-source metadata. Its documented API does not promise enforcement of OpenAI `text.format` schemas, so the generated schema is supplied in instructions and the same Zod parser validates the complete response locally. Invalid or truncated responses fail without applying records. This is local validation, not constrained decoding. Do not switch to Chat Completions search without preserving source provenance: QwenCloud documents that endpoint as not returning sources.

`store:false`, non-thinking mode, output-token caps, request cancellation and existing route timeouts are retained. A synthetic live limit test returned `incomplete` at exactly 16 output tokens. Qwen does not document OpenAI's `max_tool_calls` control; the adapter deliberately omits it. Search can perform multiple billable retrievals, so do not describe the old OpenAI tool count as a Qwen spending ceiling. Usage-based pricing estimates must include those calls and rework; this change does not add durable cost accounting.

Jev still checks whether a capture represents purchased groceries, consumed food, conversation or uncertainty. Disagreement holds records; unavailable/uncertain checks retain user review. Jev does not verify nutrition, receipt OCR or recipe safety. Existing source checks, deterministic arithmetic and reviewable draft behavior remain authoritative. OpenAI still provides voice transcription via its separate key and model.

## Verification, 2026-09-29

- Provider regression tests cover Qwen-only status/chat, image forwarding, endpoint/key separation, local schema rejection, truncated output, source provenance, cancellation, no retry/fallback, and legacy OpenAI behavior.
- Live synthetic receipt: two items, USD 5 total, unconfirmed purchase, no consumed meal; unknown nutrition remains blank. Qwen used 4,834 input / 586 output tokens; Jev returned HTTP 200.
- Live seven-day dinner draft: seven meals, passed domain validation; 1,042 input / 1,447 output tokens. These small fixtures are smoke checks, not an accuracy or cost benchmark for real receipts/full-week plans.
- Synthetic nutrition label and workout proposal passed. One earlier label call returned the existing safe 503/manual-entry path; the upstream cause was not captured. A diagnostic repeat succeeded. Do not infer perfect reliability from it.
- Live web search returned seven source URLs; the selected URL was present in actual provider metadata. One search invocation was reported.
- CYC startup hit the existing source-fingerprint size limit. Direct project checks were used without changing verification configuration; no managed-run completion is claimed.

References: [QwenCloud structured output](https://docs.qwencloud.com/developer-guides/text-generation/structured-output), [QwenCloud web search](https://docs.qwencloud.com/developer-guides/tool-calling/web-search).
