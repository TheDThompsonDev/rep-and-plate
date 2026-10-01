import type { IncomingMessage, ServerResponse } from 'node:http';
import { betaHandler } from './beta.ts';
import { betaServices } from './beta-services.ts';
import { handlePreview } from './preview-node.ts';
import {handleMaintenance} from './operations.ts';
import {createOperationsServices} from './operations-services.ts';
import { hostedAgentHandler } from './agents/hosted.ts';
let handler: ReturnType<typeof betaHandler> | undefined;
let agents: ReturnType<typeof hostedAgentHandler> | undefined;
export default async function health(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const endpoint = url.searchParams.get('endpoint');
    if (endpoint) req.url = `/api/${endpoint}`;
    if(req.url?.split('?')[0]==='/api/maintenance'){
      await handleMaintenance(req,res,process.env.CRON_SECRET,{maintenance:()=>createOperationsServices(process.env).maintenance()});return;
    }
    if (await handlePreview(req, res, { ...process.env, VERCEL: '1' })) return;
    if ((req.url ?? '').split('?')[0].startsWith('/api/agents/')) {
      agents ??= hostedAgentHandler(process.env);
      await agents(req, res);
      return;
    }
    handler ??= betaHandler(betaServices(process.env));
    await handler(req, res);
  } catch {
    if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify((req.url ?? '').startsWith('/api/agents/')
      ? { error: { code: 'UNAVAILABLE', message: 'Connections service is not configured yet.', retryable: true } }
      : { error: 'Beta service is not configured yet.' }));
  }
}
