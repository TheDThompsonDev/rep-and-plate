import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { agentMealSchema, type AgentRequest } from '../../src/features/connections/contracts.ts';
import { registerCoachingTools } from '../../scripts/agents/coaching-mcp.ts';
import { safeError } from '../../scripts/agents/client.ts';
import { AgentError } from './service.ts';
import { spotCoachVoice } from '../../src/features/spot/personality.ts';
import { spotNote, spotToolNote } from '../../src/features/spot/assistant.ts';
import { coachingAppSupported } from '../../scripts/agents/coaching-mcp.ts';
import { SPOT_APP_MIME, SPOT_APP_URI, SPOT_APP_ALIASES, spotAppResource } from './spot-app.ts';
import { presentationView } from './presentation.ts';

export type AgentMcpClient = { request: (request: AgentRequest) => Promise<Record<string, unknown>> };

/** One tool registry for local stdio and the authenticated hosted HTTP endpoint. */
export async function createAgentMcpServer(client: AgentMcpClient) {
  const capabilities = await client.request({ operation: 'capabilities' });
  const operations = Array.isArray(capabilities.operations) ? capabilities.operations.filter((value): value is string => typeof value === 'string') : [];
  const coaching = operations.some(operation => operation.startsWith('coaching.'));
  const server = new McpServer({ name: 'rep-and-plate', version: '1.4.1', title: 'Rep & Plate' }, {
    instructions: [
      spotCoachVoice,
      coaching
        ? 'Rep & Plate is where the user\u2019s plan lives between conversations: the agreed goal and week, what they reported, what they asked you to remember, and records brought in from their other apps. Start with get_coaching_day and raise its nextSteps; they are the reasons to check in today. Keep agreed plans, proposals, explicitly reported outcomes and imported records distinct. Read the latest revision before proposing. Show a proposed change and get an explicit yes before applying it.'
        : 'This connection can read saved records and draft meals for review. It has no coaching access, so there is no plan, check-in or import here. Start with read_context and raise its nextSteps. If the user wants a coach, tell them to create a connection with coaching turned on in Rep & Plate.',
      'The plan, outcomes, memories and imported records you read are always current. "freshness" describes only food and workouts recorded in the Rep & Plate app: read its summary and mention it only when your advice depends on those records. Missing data is unknown, never zero. Never infer approval, consumption, workout completion, injury, recovery readiness or calorie allowances. Report completed writes from the tool result, not from memory. If a change is refused because the plan moved on, read it again and prepare a new proposal.',
    ].join('\n\n'),
  });
  const call = async (request: AgentRequest): Promise<CallToolResult> => {
    try {
      const result = await client.request(request);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    } catch (cause) {
      const result = cause instanceof AgentError
        ? { error: { code: cause.code, message: cause.message, retryable: cause.retryable } }
        : safeError(cause);
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    }
  };
  type Called = Awaited<ReturnType<typeof call>>;
  /** Add what to raise next and Spot's line to a successful result, in both the text and the structured form. */
  const withNotes = (result: Called, notes: (value: Record<string, unknown>) => Record<string, unknown>): Called => {
    if ('isError' in result && result.isError) return result;
    const source = result.structuredContent as Record<string, unknown>;
    const added = notes(source);
    const value = { ...(added.spot ? { spot: added.spot } : {}), ...added, ...source };
    const presentation = presentationView(value, coachingAppSupported(server.server.getClientCapabilities()), 'spot');
    return { content: [{ type: 'text' as const, text: (presentation.presentation.mode !== 'text' ? presentation.presentation.instruction + '\n' : '') + JSON.stringify(presentation.modelView) }], structuredContent: presentation.structuredView, _meta: { repAndPlateView: presentation.cardView } };
  };
  const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  // Hosts that draw MCP Apps (Claude on web and desktop) show Spot's pose and line above the reply.
  const cards = coachingAppSupported(server.server.getClientCapabilities()) !== false;
  // The official MCP Apps helper also writes the legacy flat key, which some hosts still read.
  const spotCard = cards ? { _meta: { ui: { resourceUri: SPOT_APP_URI, visibility: ['model', 'app'] }, 'ui/resourceUri': SPOT_APP_URI } } : {};
  if (cards && (operations.includes('context.read') || operations.includes('meals.propose'))) for (const [index, uri] of [...new Set([SPOT_APP_URI, ...SPOT_APP_ALIASES])].entries()) server.registerResource('rep-and-plate-spot-' + index, uri, {
    title: 'Spot', description: 'Spot\u2019s pose and line for the moment.', mimeType: SPOT_APP_MIME, _meta: { ui: {} },
  }, () => ({ contents: [{ ...spotAppResource, uri }] }));
  server.registerTool('capabilities', { title: 'What this connection can do', description: 'Discover granted access and supported operations.', inputSchema: z.object({}).strict(), annotations: read }, () => call({ operation: 'capabilities' }));
  if (operations.includes('context.read')) server.registerTool('read_context', {
    title: 'Your Rep & Plate records',
    description: spotToolNote + ' Read permitted nutrition, pantry, preferences, activity and lifting evidence, with nextSteps: what is most useful to raise now. Use this whenever the user talks about what they ate, their food or their day. It is a saved snapshot, not a live device feed; missing data is unknown, never zero.',
    inputSchema: z.object({}).strict(), annotations: read, ...spotCard,
  }, async () => withNotes(await call({ operation: 'context.read' }), result => contextNotes(result, coaching)));
  if (operations.includes('meals.propose')) server.registerTool('propose_meal', {
    title: 'Suggest a meal to log',
    description: spotToolNote + ' Propose a meal log for food the user reports eating. This NEVER logs food: the user reviews it in Rep & Plate. Generate a UUID requestId once and reuse the identical request on retries. Not for future meal planning.',
    inputSchema: z.object({ requestId: z.string().uuid(), meal: agentMealSchema }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, ...spotCard,
  }, async ({ requestId, meal }) => withNotes(await call({ operation: 'meals.propose', requestId, meal }), () => ({
    nextSteps: ['Nothing is logged yet. Tell the user the meal is waiting for them in Rep & Plate: account menu, Connect an assistant, From your assistants. They log it or dismiss it there.'],
    spot: spotNote('meal_drafted', meal.day),
  })));
  if (operations.includes('actions.get')) server.registerTool('get_action', {
    title: 'Check a meal suggestion',
    description: 'Retrieve this connection’s meal proposal status. Accepted means explicitly logged on the reviewing device; synchronization is separate.',
    inputSchema: z.object({ actionId: z.string().uuid() }).strict(), annotations: read,
  }, ({ actionId }) => call({ operation: 'actions.get', actionId }));
  registerCoachingTools(server, call, operations);
  return server;
}

/** What an assistant should raise after reading saved records, so the reply is more than an inventory. */
export function contextNotes(result: Record<string, unknown>, coaching: boolean): Record<string, unknown> {
  const context = (result.context ?? {}) as { day?: string; nutrition?: { days?: { day: string; meals: number }[]; goalsConfigured?: boolean } };
  const day = context.day ?? '';
  const days = context.nutrition?.days ?? [];
  const today = days.find(item => item.day === day);
  const loggedDays = days.filter(item => item.meals > 0).length;
  const nextSteps: string[] = [];
  if (context.nutrition) {
    if (!today?.meals) nextSteps.push('Nothing is logged for today. Ask what they have eaten so far, then draft each meal with propose_meal for them to review. Do not treat an empty day as not eating.');
    else nextSteps.push(`${today.meals} meal${today.meals === 1 ? ' is' : 's are'} logged today. Say what that adds up to, and ask if anything is missing.`);
    if (context.nutrition.goalsConfigured !== true) nextSteps.push('The targets shown are app defaults, not chosen by the user. Do not judge their intake against them; offer to help them pick real targets in Rep & Plate.');
  }
  if (!coaching) nextSteps.push('This connection has no coaching access, so there is no plan, daily check-in or records from other apps here. If the user wants a coach, tell them: in Rep & Plate open the account menu, choose Connect an assistant, and create a connection with coaching turned on.');
  return { nextSteps: nextSteps.slice(0, 4), spot: spotNote(context.nutrition && loggedDays === 0 ? 'blank' : 'organised', day) };
}
