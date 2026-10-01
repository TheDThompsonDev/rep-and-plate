import { readFile } from 'node:fs/promises';
import { agentMealSchema } from '../src/features/connections/contracts';
import { AgentClientError, createAgentClient, safeError } from './agents/client';

const help = `Rep & Plate agent CLI

Set REP_PLATE_URL to the app origin and REP_PLATE_TOKEN to a token created in
the app's Connections page. Tokens belong in environment variables, never arguments.

Usage: npm --silent run health -- <command> [--json]
  doctor                         Check authentication and available operations
  capabilities                   Discover access and supported operations
  context                        Read your permitted, published context
  meals propose --file PATH --request-id UUID
                                 Propose a log for a meal you actually ate
  actions get UUID               Read the status of your own proposal
  help                           Show this help without connecting

Use the same request ID and identical meal when retrying a proposal.
A proposal does not log food eaten automatically. Select Log this meal in the
app only for food actually eaten. No pantry ingredients are deducted.
JSON mode writes one JSON result to stdout, including errors (exit code 1).
Setup and meal format: docs/AGENT_CONNECTIONS.md`;

async function main() {
  const raw = process.argv.slice(2);
  const json = raw.includes('--json');
  const args = raw.filter(arg => arg !== '--json');
  try {
    if (!args.length || (args.length === 1 && ['help', '--help', '-h'].includes(args[0]))) {
      process.stdout.write(json ? `${JSON.stringify({ help })}\n` : `${help}\n`); return;
    }
    let request;
    if (args.length === 1 && ['doctor', 'capabilities', 'context'].includes(args[0])) {
      request = { operation: args[0] === 'context' ? 'context.read' as const : 'capabilities' as const };
    } else if (args.length === 3 && args[0] === 'actions' && args[1] === 'get') {
      request = { operation: 'actions.get' as const, actionId: args[2] };
    } else if (args.length === 6 && args[0] === 'meals' && args[1] === 'propose') {
      const flags = new Map<string, string>();
      for (let i = 2; i < args.length; i += 2) flags.set(args[i], args[i + 1]);
      if (flags.size !== 2 || !flags.get('--file') || !flags.get('--request-id')) throw new AgentClientError('USAGE', 'Provide --file PATH and --request-id UUID.');
      let value;
      try { value = JSON.parse(await readFile(flags.get('--file')!, 'utf8')); }
      catch { throw new AgentClientError('INVALID_FILE', 'Could not read the meal JSON file. Check the path and JSON syntax.'); }
      const meal = agentMealSchema.safeParse(value);
      if (!meal.success) throw new AgentClientError('INVALID_MEAL', meal.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
      request = { operation: 'meals.propose' as const, requestId: flags.get('--request-id')!, meal: meal.data };
    } else throw new AgentClientError('USAGE', 'Unknown command or arguments. Run health help for supported commands.');
    const result = await createAgentClient().request(request);
    process.stdout.write(`${JSON.stringify(result, null, json ? undefined : 2)}\n`);
  } catch (error) {
    const result = safeError(error);
    if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else process.stderr.write(`${result.error.code}: ${result.error.message}\n`);
    process.exitCode = 1;
  }
}

await main();
