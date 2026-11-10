# Connect your agents to Rep & Plate

The app provides one authenticated API, a command-line client, and an MCP stdio adapter. Any agent that can run a command or make an authenticated HTTP request can integrate. Agents with local MCP support can discover tools automatically. Compatibility with individual products such as Muse or Grok Bot has not been verified; their available integration methods determine which adapter to use.

## What this release supports

- Discover permissions and available operations.
- Read a limited health context: nutrition summaries, pantry, preferences, and workout history, according to granted scopes.
- Propose a **meal log** for a meal the user reports eating, including estimated nutrition for that portion.
- Retrieve a proposal's status after the user reviews it.
- Read the persistent coaching day/week and propose, explicitly approve or undo
  coaching changes using separately granted coaching permissions.
- Bring activities and daily nutrition totals from other apps into one record
  with `import_records`, and start daily or weekly check-ins from MCP prompts. See the
  [daily coaching guide](COACHING.md) for the remote MCP endpoint and review flow.

A meal proposal stays pending until you select **Log this meal** or dismiss it in Connections. Only log food you actually ate. Accepting a meal proposal saves the meal on the reviewing device; synchronization is separate and pantry stock is unchanged. Coaching proposals follow their own explicit review flow and persist in the shared server record. Automatic pantry updates, external provider synchronization and background event subscriptions are not included.

## Create a connection

1. Open **You → Connections** on the web, or **You → Agent connections** in the native app.
2. Create a separately named connection for each agent, choose its permissions, and copy its token. Access lasts 30 days and the token is displayed only once.
3. Context sharing starts when you create a connection. The hosted backend reads your latest synchronized account snapshot. Local development publishes a limited snapshot while the app is running; reopen Connections after restarting the app to resume publishing. Local connections belong to this browser installation and profile. The native development pairing bridge does not support agent management; use the web app locally or a hosted account on native.
4. Give the agent runtime `REP_PLATE_URL` (the app origin, without a path) and `REP_PLATE_TOKEN` through its environment or secret manager.
5. Run the connection check below. Revoke access from Connections when no longer needed.

Treat the token as a password. Do not paste it into prompts, commit it, put it in command arguments, or share the same token between unrelated agents. Environment setup depends on the agent host. These clients do not load `.env` files or store credentials on disk. The URL must use HTTPS, except for local development on `localhost`, `127.0.0.1`, or `[::1]`. Redirects are refused to avoid forwarding credentials to another destination.

## Terminal agents

Install this repository with Node.js 24 and `npm install`. Set the two environment variables in your agent runtime, then run these commands from the repository root:

```sh
npm --silent run health -- doctor --json
npm --silent run health -- capabilities --json
npm --silent run health -- context --json
npm --silent run health -- help
```

`--json` emits one JSON result on stdout. Failures have an `error` object and exit code 1. `--silent` suppresses npm's script banner. Without `--json`, successful results are formatted JSON and errors go to stderr.

To propose a meal log, copy `docs/agent-meal.example.json`, change the date, portion, and nutrition to match the reported meal, and generate a request ID once:

```sh
node -e "console.log(require('node:crypto').randomUUID())"
npm --silent run health -- meals propose --file docs/agent-meal.example.json --request-id YOUR_UUID --json
npm --silent run health -- actions get ACTION_UUID --json
```

Save the UUID before the first submission. If a request times out, retry with **the same UUID and identical meal**. A new UUID means a new proposal. Reusing an existing UUID with changed meal data is rejected. The response contains the action ID and status. `doctor` checks connectivity, authentication, and capabilities; `context` additionally checks whether readable context exists.

The meal payload requires `title`, calendar `day` (`YYYY-MM-DD`), 24-hour `time` (`HH:mm`), `category` (`Breakfast`, `Lunch`, `Dinner`, or `Snack`), `portion`, numeric `calories`, `protein`, `carbs`, `fat`, and `note`. Nutrients describe the complete stated portion; calories use kcal and macronutrients use grams. Nutrition values are estimates, and the user reviews them before logging.

## MCP agents

The adapter uses the [official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) over stdio. It exposes `capabilities`, `read_context`, `propose_meal`, `get_action`, and the coaching tools (`get_coaching_day`, `propose_coaching_change`, `resolve_coaching_change`, `undo_coaching_change`, `import_records`) according to the connection's permitted operations. It emits only protocol messages on stdout. Runtime errors go to stderr; tool errors include `isError: true` and a structured error body.

Configure your MCP client to start Node with **absolute paths** to this checkout's installed `tsx` executable and adapter. For example, on Windows:

```json
{
  "mcpServers": {
    "rep-and-plate": {
      "command": "node",
      "args": [
        "C:/path/to/fitness/node_modules/tsx/dist/cli.mjs",
        "C:/path/to/fitness/scripts/agents/mcp.ts"
      ],
      "env": {
        "REP_PLATE_URL": "https://your-app.example",
        "REP_PLATE_TOKEN": "YOUR_CONNECTION_TOKEN"
      }
    }
  }
}
```

Replace both paths with your checkout location; macOS/Linux paths use `/absolute/path/to/fitness/...`. If Node is not on the MCP client's PATH, use its absolute executable path as `command`. The enclosing configuration and secret injection mechanism vary by MCP client; prefer its secret store to a plaintext token. The `env` example shows the required names, not a recommendation to commit credentials. Restart the MCP adapter after changing credentials or permissions. Revocation is checked by the server on every request.

For a manual smoke check, `npm --silent run agents:mcp` starts the adapter, but it waits for MCP messages rather than interactive commands. Use your MCP client's tool listing to verify the connection.

### Remote MCP (no checkout required)

The same tool registry is served over stateless MCP HTTP at `https://YOUR_APP_ORIGIN/api/agents/mcp`. It authenticates each request with the connection token as a Bearer credential, so it works in hosts that can send a fixed `Authorization` header. The deployment must include this route; an older deployment answers `404 NOT_FOUND`.

| Host | How to connect | Status |
| --- | --- | --- |
| Codex CLI/app | `codex mcp add rep-and-plate --url https://YOUR_APP_ORIGIN/api/agents/mcp --bearer-token-env-var REP_PLATE_TOKEN` | Flags checked against the installed CLI's help; not exercised against a hosted account. |
| Claude Code | Project `.mcp.json` entry below; the token stays in the environment. | Configuration format only; not exercised against a hosted account. |
| Claude (web/desktop/mobile) | **Add custom connector**, using the address above and the request-headers field for `Authorization: Bearer …` where your account offers it. | Unverified. Some accounts only offer OAuth, which this server does not implement. |
| ChatGPT | Not supported yet. | Custom connectors accept OAuth or no authentication, not a fixed bearer header. |

```json
{
  "mcpServers": {
    "rep-and-plate": {
      "type": "http",
      "url": "https://YOUR_APP_ORIGIN/api/agents/mcp",
      "headers": { "Authorization": "Bearer ${REP_PLATE_TOKEN}" }
    }
  }
}
```

Reaching ChatGPT and OAuth-only Claude accounts needs an OAuth 2.1 authorization flow in front of the same scoped connections. That is not implemented.

## Direct HTTP integrations

Send JSON to `POST /api/agents/v1` on the configured app origin with `Authorization: Bearer <connection token>` and `Content-Type: application/json`:

```json
{ "operation": "capabilities" }
```

```json
{ "operation": "context.read" }
```

```json
{
  "operation": "meals.propose",
  "requestId": "e2a46b4c-7f33-4b5d-8d67-5dc9d7e37132",
  "meal": {
    "title": "Rice bowl", "day": "2026-09-29", "time": "18:30",
    "category": "Dinner", "portion": "1 bowl",
    "calories": 400, "protein": 20, "carbs": 55, "fat": 11,
    "note": "Estimated nutrition for the portion reported eaten."
  }
}
```

```json
{ "operation": "actions.get", "actionId": "ACTION_UUID" }
```

Capabilities returns granted `scopes` and supported `operations`. Context returns permitted fields under `context`, with `publishedAt`, `mode`, `ageSeconds`, `dataUpdatedAt`, `sourceRevision`, and `stale` freshness information. Do not present a snapshot as live device state; missing fields may be outside the connection's permissions. Inspect the freshness metadata before making recommendations and ask the user to sync or publish when needed.

For `nutrition:read`, `nutrition.goalsConfigured` is true only when the user explicitly chose daily targets. False or absent means the numeric `goals` are compatibility defaults, not personal recommendations. Describe recorded totals without calories-left or target-attainment judgments in that case. Older published contexts without this optional flag remain readable.

Proposal and status responses contain `{ "action": { ... }, "reviewUrl": ".../#connections" }`; proposals also indicate `replayed`. Give the user the review link when approval is needed. Status may be `pending`, `accepted`, `dismissed`, `revoked`, or `expired`. Connections can retrieve their own actions. Errors consistently use `{ "error": { "code": "...", "message": "...", "retryable": false } }`. Honor `retryable`; never silently replace a failed proposal's request ID. The adapters use a 15-second network timeout.

## Hosted installation

Local web development initializes `.fuel-data/agents.sqlite` automatically when the agent API is first used. This contains private context, hashed credentials and action receipts; keep it private and out of version control. No provider AI key is needed for these agent operations.

Hosted installations require the existing Supabase account/beta/snapshot setup, the account migration `supabase/migrations/20260929_account.sql`, and then `supabase/migrations/20260929_agents.sql`. The new tables and functions are restricted to the server role. The agent migration and updated bundled API/frontend were deployed to repandplate.com on September 30, 2026. Scoped connection creation, authentication and revocation passed a live synthetic-account check; that account was removed. See the [deployment record](audits/2026-09-30-round-2-remediation/deployment/report.md).

Agent requests have a separate account allowance of 120 requests per minute and 5,000 per UTC day, so inbox refreshes do not consume the app's AI allowance. The inbox refreshes every minute while open and every five minutes while closed, only while the app is in the foreground. Refresh manually when you want an immediate update. Storage retains request identities for safe retries, with a 100-connection / 1,000-action limit and a byte limit; exceeding a limit returns `CAPACITY` instead of discarding old receipts.

If a meal was saved on this device but the acknowledgment failed, refreshing resends the saved receipt. It does not log the meal again. If another device has already dismissed, revoked or expired the proposal, **Recent outcomes** shows the differing result and preserves the local meal for your review. Deleting a logged meal does not erase its application receipt or make an old proposal reusable.

## Verification

```sh
npm run agents:check
npx vitest run scripts/agents
```

The client tests run a local HTTP fixture and exercise the real CLI process and official MCP client/server stdio exchange. Backend authorization, persistence, and idempotency have separate server tests. Live integration with a particular agent product and hosted account requires configuring that deployment and agent.
