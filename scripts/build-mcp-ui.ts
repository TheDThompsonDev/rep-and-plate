import { mkdirSync, writeFileSync } from 'node:fs';
import { coachingAppHtml } from '../server/agents/coaching-app.ts';
import { spotAppHtml } from '../server/agents/spot-app.ts';

// Static renderer code only. Account records arrive later through the existing MCP bridge.
mkdirSync('public/mcp', { recursive: true });
writeFileSync('public/mcp/coaching.html', coachingAppHtml);
writeFileSync('public/mcp/spot.html', spotAppHtml);
console.log('MCP presentation views generated.');
