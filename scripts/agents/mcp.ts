import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { agentMealSchema, type AgentRequest } from '../../src/features/connections/contracts';
import { createAgentClient, safeError, type AgentClient } from './client';

export async function createAgentMcpServer(client: AgentClient) {
  const capabilities = await client.request({ operation: 'capabilities' });
  const operations = Array.isArray(capabilities.operations) ? capabilities.operations : [];
  const server = new McpServer({ name: 'rep-and-plate', version: '1.0.0' });
  const call = async (request: AgentRequest) => {
    try {
      const result = await client.request(request);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    } catch (error) {
      const result = safeError(error);
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    }
  };
  const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  server.registerTool('capabilities', { description: 'Discover granted access and supported operations for this connection.', inputSchema: z.object({}).strict(), annotations: readAnnotations }, () => call({ operation: 'capabilities' }));
  if (operations.includes('context.read')) server.registerTool('read_context', {
    description: 'Read permitted health context from an account or explicitly published snapshot. Check freshness and missing data before advising; this is not live device data.',
    inputSchema: z.object({}).strict(), annotations: readAnnotations,
  }, () => call({ operation: 'context.read' }));
  if (operations.includes('meals.propose')) server.registerTool('propose_meal', {
    description: 'Propose a meal log for a meal the user reports eating, with nutrition estimates for their described portion. This NEVER logs food automatically: the user must select Log this meal in Connections. Do not use this for future meal planning. Generate a UUID requestId before the first call; reuse it with the identical meal on every retry.',
    inputSchema: z.object({ requestId: z.string().uuid(), meal: agentMealSchema }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ requestId, meal }) => call({ operation: 'meals.propose', requestId, meal }));
  if (operations.includes('actions.get')) server.registerTool('get_action', {
    description: 'Retrieve the status of a meal log proposal made by this connection. Accepted means the user explicitly logged it on their reviewing device; cloud synchronization is separate. No pantry ingredients are deducted.',
    inputSchema: z.object({ actionId: z.string().uuid() }).strict(), annotations: readAnnotations,
  }, ({ actionId }) => call({ operation: 'actions.get', actionId }));
  return server;
}

async function main() {
  try {
    const server = await createAgentMcpServer(createAgentClient());
    await server.connect(new StdioServerTransport());
  } catch (error) {
    process.stderr.write(`${JSON.stringify(safeError(error))}\n`);
    process.exitCode = 1;
  }
}

await main();
