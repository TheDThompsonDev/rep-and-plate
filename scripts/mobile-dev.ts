import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { mobileGateway } from '../server/mobile-gateway.ts';
if (process.env.NODE_ENV === 'production') throw new Error('This paired bridge is development-only.');
await mkdir('.local-checks', { recursive: true });
const path='.local-checks/mobile-pairing.json';
let token:string;
try {token=JSON.parse(await readFile(path,'utf8')).token;if(!/^[a-f0-9]{64}$/.test(token))throw new Error();}
catch {token=randomBytes(32).toString('hex');await writeFile(path,JSON.stringify({token}),{mode:0o600});}
const port=5174;
createServer(mobileGateway(token)).listen(port,'0.0.0.0',()=>{
 console.log('Rep & Plate private development bridge. Start npm run dev in another terminal.');
 for(const entries of Object.values(networkInterfaces()))for(const entry of entries??[])if(entry.family==='IPv4'&&!entry.internal)console.log(`Phone server address: http://${entry.address}:${port}`);
 console.log(`Pairing code (enter in the phone app, do not share): ${token}`);
 console.log('Use only on a trusted private network. Stop this process when finished.');
});
