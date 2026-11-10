import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createAgentClient, safeError } from './client';
import { createAgentMcpServer } from '../../server/agents/mcp-server';
export { createAgentMcpServer } from '../../server/agents/mcp-server';
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
