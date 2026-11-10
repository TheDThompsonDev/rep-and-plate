import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { agentMealSchema, type AgentRequest } from '../../src/features/connections/contracts.ts';
import { registerCoachingTools } from '../../scripts/agents/coaching-mcp.ts';
import { safeError } from '../../scripts/agents/client.ts';
import { AgentError } from './service.ts';
import { spotCoachVoice } from '../../src/features/spot/personality.ts';

export type AgentMcpClient = { request: (request: AgentRequest) => Promise<Record<string, unknown>> };

/** One tool registry for local stdio and the authenticated hosted HTTP endpoint. */
export async function createAgentMcpServer(client: AgentMcpClient) {
  const capabilities = await client.request({ operation: 'capabilities' });
  const operations = Array.isArray(capabilities.operations) ? capabilities.operations.filter((value): value is string => typeof value === 'string') : [];
  const coaching = operations.some(operation => operation.startsWith('coaching.'));
  const server = new McpServer({ name: 'rep-and-plate', version: '1.2.0', title: 'Rep & Plate' }, {
    instructions: [
      spotCoachVoice,
      coaching
        ? 'Rep & Plate is where the user\u2019s plan lives between conversations: the agreed goal and week, what they reported, what they asked you to remember, and records brought in from their other apps. Start with get_coaching_day and raise its nextSteps; they are the reasons to check in today. Keep agreed plans, proposals, explicitly reported outcomes and imported records distinct. Read the latest revision before proposing. Show a proposed change and get an explicit yes before applying it.'
        : 'Start with capabilities to see what this connection may read or propose.',
      'Check freshness; missing data is unknown, never zero. Never infer approval, consumption, workout completion, injury, recovery readiness or calorie allowances. Report completed writes from the tool result, not from memory. A stale plan must be read and reviewed again.',
    ].join('\n\n'),
  });
  const call = async (request: AgentRequest) => {
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
  const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  server.registerTool('capabilities', { title: 'What this connection can do', description: 'Discover granted access and supported operations.', inputSchema: z.object({}).strict(), annotations: read }, () => call({ operation: 'capabilities' }));
  if (operations.includes('context.read')) server.registerTool('read_context', {
    title: 'Your Rep & Plate records',
    description: 'Read permitted nutrition, pantry, preferences, activity and lifting evidence. Check freshness and missing data before advising; this is a saved snapshot, not a live device feed.',
    inputSchema: z.object({}).strict(), annotations: read,
  }, () => call({ operation: 'context.read' }));
  if (operations.includes('meals.propose')) server.registerTool('propose_meal', {
    title: 'Suggest a meal to log',
    description: 'Propose a meal log for food the user reports eating. This NEVER logs food: the user reviews it in Rep & Plate. Generate a UUID requestId once and reuse the identical request on retries. Not for future meal planning.',
    inputSchema: z.object({ requestId: z.string().uuid(), meal: agentMealSchema }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ requestId, meal }) => call({ operation: 'meals.propose', requestId, meal }));
  if (operations.includes('actions.get')) server.registerTool('get_action', {
    title: 'Check a meal suggestion',
    description: 'Retrieve this connection’s meal proposal status. Accepted means explicitly logged on the reviewing device; synchronization is separate.',
    inputSchema: z.object({ actionId: z.string().uuid() }).strict(), annotations: read,
  }, ({ actionId }) => call({ operation: 'actions.get', actionId }));
  registerCoachingTools(server, call, operations);
  return server;
}
