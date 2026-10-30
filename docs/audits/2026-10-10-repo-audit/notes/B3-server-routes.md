# B3-server-routes — findings Q6 (+ server half of Q5)

## Plan (written before editing)

Goal: stop the hosted (`server/beta.ts` → `createApi`) and local (`createApi` alone) pipelines drifting: one body parse hosted, one body-limit module, one route table consumed by both entry points, and `/api/cloud/config` computed the same way on both.
Done when: `server/http.test.ts` characterizes `createApi` and passes on the current code first; after the refactor every existing route answers identically through `server/index.ts`/vite (local) and `server/vercel-entry.ts`/`api/health.mjs` (hosted); a test walks `ROUTES` through both entry points; `npx tsc --noEmit`, `npx vitest run src server`, `npx vitest run scripts/agents`, `npm run build`, and the two named Playwright specs pass.

Approach: extend in place. `createApi` keeps its signature (`api(req,res,next,user)`) and gains an optional fifth argument carrying a pre-parsed body; new small module `server/routes.ts` (route table + body limits + shared JSON reader + cloud-config shape) is consumed by `http.ts`, `beta.ts`, `vercel-entry.ts`, `agents/http.ts`.
Context: `docs/context/beta-hosting.md` (hosted boundary, `/api/cloud/config` public bootstrap) and `operations.md:53` (`/api/maintenance` cron) describe the hosted routes but no table exists in code. Ledger: CHAT-PIPELINE-002 (A3) added the local 501 for `/api/account/delete` and the deadline passthrough in `http.ts` — keep both. TYPE-SAFETY-20261010 (A5) added `captureSchema` parsing in `beta.ts` — keep. No ledger entry for the double parse or the route drift.

Change:
- `server/http.test.ts` (new) → characterization of `createApi`: next() passthrough, host/origin 403s, `/api/status` + `/api/cloud/config` shapes, unknown 404, 415/400/413, 503 unconfigured, 409 in-flight, 10-minute replay then re-run, 429 at two active captures, abort on client close, 501 delete, hosted cache branches. Must be green before any source edit.
- `server/routes.ts` (new) → `ROUTES` (path, method, scope shared|hosted-only|local-only, handler api|agents|maintenance, costly), `AGENT_ROUTE_PREFIX`, `BODY_LIMITS` with one comment per limit, `readJsonBody(req, limit)`, `cloudConfigResponse()`.
- `server/http.ts` → dispatch from `ROUTES` instead of the if-chain; hosted-only routes answer 501 locally; chat reads the body through `readJsonBody` or takes the pre-parsed body; `Retry-After` on the local 429 (hosted and agents already send it).
- `server/beta.ts` → route/costly sets derived from `ROUTES`; `readJsonBody` for delete and POST bodies with `BODY_LIMITS`; `/api/chat` passes the parsed body straight to `createApi` (no re-serialize/re-parse); other POST routes still get a `Readable` because their handlers (`server/products/*`, `plans.ts`, `voice.ts`, `shopping.ts`) read the stream themselves and are outside this scope; `/api/cloud/config` goes through `cloudConfigResponse` with a comment on why it is always available hosted.
- `server/vercel-entry.ts` → maintenance path and agents prefix from `routes.ts`; behavior unchanged.
- `server/agents/http.ts` → `BODY_LIMITS.agents` replaces `1_000_000` (limits only).
- `server/routes.test.ts` (new) → walks `ROUTES` through `createApi` (local), `betaHandler` (hosted) and `vercel-entry` (hosted entry, with `beta-services`/`agents/hosted` mocked) and asserts each is reachable (never 404) or is explicitly entry-specific.
- `docs/context/beta-hosting.md`, `docs/context/operations.md` → one paragraph each pointing at the route table.

Keep consistent: `vite.config.ts` and `server/index.ts` call `createApi(config)` and `api(req,res,next)` — signature stays compatible. `tests/ai-fixtures.ts` runner mocks — untouched. `server/ai.test.ts` HTTP tests (501, dedupe, cloud config) — must stay green. `server/beta.test.ts` (UTF-8 across chunks for delete, 401/403/429/503 ordering, capture ownership) — must stay green; `readJsonBody` must concatenate buffers before decoding. `scripts/agents/client.ts` uses `/api/agents/v1` — path unchanged. `src/features/cloud/client.ts` reads `/api/cloud/config` `{available,url,publishableKey,supportUrl?}` — shape unchanged. `mobile/src/api.ts` reads `value.error` — unchanged.

Test: red → green for `Retry-After` on local 429 and for the route walk (hosted `routes` set deliberately missing an entry would 404). Everything else is characterization (green before and after).
Open: local wrong-method on `createApi`'s own routes is 404 today and 405 hosted; I align local to 405 (hosted copy) and record it. Local `/api/maintenance` is 404 today; hosted-only routes now answer 501 locally with hosted-only copy (nothing calls it locally; cron is Vercel-only).

## Reproduction (red first)

Characterization: `npx vitest run server/http.test.ts` on the unmodified code (wave A state) → 13 passed. These pin the current `createApi` contract before any refactor: next() passthrough, Host/Origin 403s, `/api/status` and `/api/cloud/config` exact shapes, unknown 404, 415/400/413 (5,000,001-byte body), 503 unconfigured, 409 in flight, ten-minute replay then re-run (via a `Date.now` spy at +600,001 ms), 429 at two active captures, provider abort when the client disconnects mid-stream, local 501 delete, hosted cache branches (cached/busy/mismatch/new + `finish` lease).

Red → green slices, each shown red against the real defect by temporarily reverting the fix (files restored and re-verified byte-identical):
- `Retry-After` on the local 429: removing `res.setHeader("Retry-After", ...)` in `server/http.ts` → `answers 429 once two captures are active locally` fails (`expected NaN to be greater than 0`). The old code sent 429 with no `Retry-After` while hosted (`beta.ts`) and agents already sent one.
- Route-table drift: filtering `/api/voice` out of the hosted map in `server/beta.ts` (the exact failure mode the audit describes: a route added locally and forgotten hosted) → `server/routes.test.ts` fails twice: `betaHandler serves each api route ...` (404 for `/api/voice`) and `dispatches ... through server/vercel-entry.ts`.

Not reproduced as a failing test (structural): the double parse. Its proof is `uses a pre-parsed body instead of reading the stream`: the wire body is `{this is not json` and the response is still a 200 result stream, which is only possible when `createApi` used the supplied object instead of parsing the stream.

## Change and mechanism

- `server/routes.ts` (new) — `ROUTES`: path, method, `scope` (`shared | hosted-only | local-only`), `handler` (`api | agents | maintenance`), `costly`, `public`, `hostedOnly` copy. Hosted-only allow-list is `/api/account/delete` and `/api/maintenance`; local-only is empty with a comment on where it goes. `hostedApiRoutes` (handler `api`, not local-only), `routeFor`, `AGENT_ROUTE_PREFIX`, `MAINTENANCE_ROUTE`. `BODY_LIMITS` holds the four hand-maintained ceilings with one comment each (`localChat` 5,000,000; `hostedPost` 4,000,000; `agents` 1,000,000; `accountDelete` 2,048 — values unchanged). `readJsonBody(req, limit)` concatenates buffers before decoding (keeps the UTF-8-across-chunks guarantee `beta.test.ts` asserts) and returns `too-large | unreadable` instead of throwing. `cloudConfigResponse()` is the one `/api/cloud/config` body.
- `server/http.ts:19,71-72,93,132-170,184-193,204-212` — `api(req,res,next,user,input?)`; dispatch is `routeFor(path)` → 404 / 501 (hosted-only, route copy) / 405 with `Allow` / `switch` on the route path. The chat body is `input.body` when supplied, else `readJsonBody(req, BODY_LIMITS.localChat)`. Local 429 now sends `Retry-After` (5 s when two captures are active; otherwise the seconds until the oldest attempt leaves the 60 s window). `ACCOUNT_HOSTED_ONLY` moved from the `errors` map onto the route (no other reader; `publicError` never received it). Wave A's `CHAT_DEADLINE_MS` passthrough and stage-timeout copy are intact.
- `server/beta.ts:2-3,9,29-30,59-66,77-79,81,91-100,134-145,151` — `routes` is a `Map` built from `hostedApiRoutes`; method and admission cost come from the entry. Delete and POST bodies go through `readJsonBody` with `BODY_LIMITS`. For `/api/chat` the verified, capture-rehydrated object is handed to `createApi` as `parsed` and the original `req` (headers scrubbed as before) is passed as the stream — nothing is re-serialized or re-parsed. Product, plan, voice and shopping handlers still receive a `Readable` because they read their own stream and are outside this scope (comment in code). `/api/cloud/config` returns `cloudConfigResponse(services.publicConfig)` with a comment on why hosted is always available (`betaServices` validates and throws `BETA_CONFIG` at startup). Wave A's `captureSchema` parsing is intact.
- `server/vercel-entry.ts:8,16,20,29` — `MAINTENANCE_ROUTE` and `AGENT_ROUTE_PREFIX` replace the three string literals; dispatch order unchanged (maintenance → preview → agents → beta).
- `server/agents/http.ts:5,68` — `BODY_LIMITS.agents` replaces `1_000_000`; message unchanged.
- `server/routes.test.ts` (new) — table partition (unique paths, scopes, the two hosted-only paths, empty local-only, agents prefix, single public route), `BODY_LIMITS` literal values, `cloudConfigResponse` cases; then walks `ROUTES` through (a) `createApi` locally (SQLite store mocked to `:memory:` so the test never touches `.fuel-data`), (b) `betaHandler` with fixture services (also asserts each route's admission `expensive` flag equals `costly` and wrong-method → 405; agents/maintenance correctly 404 at this layer), (c) `server/vercel-entry.ts` with `beta-services.ts` and `agents/hosted.ts` mocked (maintenance → 401 from `handleMaintenance`, agents → stub, api → betaHandler, `?endpoint=` rewrite). Hosted `available:false` is proven with a non-publishable key in `publicConfig`.
- `docs/context/beta-hosting.md:14`, `docs/context/operations.md:53` — route-table paragraphs.

Behavior changes (local only; hosted answers are byte-identical for every existing route):
- Wrong method on a known local route: was 404, now 405 with `Allow` (hosted already answered 405). Unknown paths stay 404 "Not found.", including `/api/products/<unknown>`.
- Local `/api/maintenance`: was 404, now 501 with hosted-only copy (nothing calls it locally; cron is Vercel-only).
- Local 429 adds `Retry-After`.
- Hosted `POST /api/cloud/config`: was 404, now 405 (route exists, method is GET). No client sends it.

## Consumers checked

- `vite.config.ts`, `server/index.ts`: call `createApi(config)` and `api(req,res,next)`; new fifth parameter is optional — compiles and the shared dev server on 5173 served both Playwright specs after Vite's own config-dependency reload.
- `server/beta.test.ts` (UTF-8 split across chunks for delete, 401/403/429/503 ordering, lease release, capture ownership): 9 passed unchanged.
- `server/ai.test.ts` HTTP section (501 delete, origin/body/dedupe, cloud config): passed unchanged.
- `server/agents/*.test.ts`: passed; `scripts/agents/client.ts` uses `/api/agents/v1`, which is still `AGENT_ROUTE_PREFIX`-dispatched on both sides.
- `src/features/cloud/client.ts` reads `{available,url,publishableKey,supportUrl?}` — `cloudConfigResponse` emits exactly that (supportUrl only when present, as before).
- `mobile/src/api.ts` reads `value.error` on non-OK — unchanged shape.
- `api/health.mjs` ← `.generated/health.mjs`: `node scripts/build-api.mjs` bundles (235,772 bytes) and the bundle contains the route table.

## Commands run

| Command | Result |
| --- | --- |
| `npx vitest run server/http.test.ts` (before any source edit) | 13 passed |
| red proofs (see Reproduction) | 1 failed / 2 failed as expected; files restored byte-identical |
| `npx vitest run server` (final) | 24 files, 207 passed |
| `npx vitest run src server` | 78 files passed, 1 failed: `src/features/cloud/media.test.ts` (3 tests; `initialState().messages[0]` is undefined — Q1 `src/domain.ts` work by another agent; no import of my modules) |
| `npx vitest run scripts/agents` | 1 file, 8 passed |
| `npx tsc --noEmit` | 16 errors, all in `src/App.tsx`, `src/ai-client.ts`, `src/day.test.ts`, `src/features/onboarding/*`, `src/features/progress/fitness-goal.test.ts` (other agents); zero in `server/**`, `vite.config.ts` |
| `npm run build` | its `tsc` step fails on the `src/**` errors above; run separately: `npx vite build` built, `node scripts/build-api.mjs` "Hosted API bundled for Node 24." |
| `npx playwright test tests/account-security.spec.ts tests/ai-cancellation.spec.ts --workers 2` | 4 passed (desktop + mobile) against the shared 5173 server |

## Not checked

- No deployed Vercel request; `vercel-entry.ts` is exercised in-process with `beta-services`/`agents/hosted` mocked. Identical hosted behavior is established by `beta.test.ts` plus the route walk, not by a live smoke test.
- Per-route caps inside `server/products/*`, `plans.ts`, `voice.ts`, `shopping.ts` (4,500,000 / 4,096 / 100,000 / 45,000 / voice `MAX_BODY`) and the media caps in `beta.ts` (3.3 MB image, 6 MiB audio) remain where they were — outside this scope; `BODY_LIMITS` documents that they exist.
- `mobile/e2e` not run (Metro). No live provider call.

## Ledger-ready paragraph

ROUTES-DRIFT-001 — Hosted/local API drift (2026-10-10, audit Q6 + server half of Q5). `server/beta.ts` kept its own `routes`/`costly` sets beside the if-chain in `server/http.ts`, parsed every POST body, re-serialized it into a `Readable` and let `createApi` parse it again (up to 4 MB twice), carried four hand-maintained body limits across three files, and hard-coded `/api/cloud/config` as `available:true`. `server/routes.ts` now owns `ROUTES` (scope, handler, method, admission cost; explicit hosted-only allow-list `/api/account/delete`, `/api/maintenance`; empty local-only list), `BODY_LIMITS` with a comment per limit, `readJsonBody` and `cloudConfigResponse`; `createApi`, `betaHandler`, `vercel-entry.ts` and the agents handler consume it. `createApi` accepts a pre-parsed body, so hosted chat is parsed once; other hosted POST handlers still receive a re-serialized stream because they read it themselves. Local 429 gained `Retry-After`; local wrong-method answers 405 like hosted; local `/api/maintenance` answers 501. `server/http.test.ts` characterizes `createApi` (13 branches, green before and after); `server/routes.test.ts` walks the table through all three entry points and goes red when a route is dropped from the hosted map. Pre-existing unrelated failures at the time: `src/features/cloud/media.test.ts` and 16 `tsc` errors in `src/**` from concurrent Q1/onboarding work.
