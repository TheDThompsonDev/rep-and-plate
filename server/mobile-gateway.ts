import { timingSafeEqual, createHash } from 'node:crypto';
import { request, type IncomingMessage, type ServerResponse } from 'node:http';

const webOrigins = new Set(['http://localhost:8081', 'http://127.0.0.1:8081']);
export function authorizeMobile(headers: IncomingMessage['headers'], token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const value=headers.authorization;
  if (typeof value !== 'string' || !/^Bearer [a-f0-9]{64}$/.test(value)) return false;
  return timingSafeEqual(createHash('sha256').update(value.slice(7)).digest(),createHash('sha256').update(token).digest());
}
/** Single-user development bridge only. The upstream target cannot be supplied by the client. */
export function mobileGateway(token:string, upstreamPort=5173) {
  if(!/^[a-f0-9]{64}$/.test(token))throw new Error('A 32-byte pairing token is required.');
  return (req:IncomingMessage,res:ServerResponse)=>{
    const origin=req.headers.origin;
    res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
    if(origin && !webOrigins.has(origin)){res.writeHead(403).end();return;}
    if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
    if(req.method==='OPTIONS'){
      if(!origin){res.writeHead(403).end();return;}
      res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.writeHead(204).end();return;
    }
    if(!authorizeMobile(req.headers,token)){res.writeHead(401,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Pair this device with your development server.'}));return;}
    if(!/^\/api\/[a-zA-Z0-9/?=&%_.-]*$/.test(req.url??'') || !['GET','POST'].includes(req.method??'')){res.writeHead(404).end();return;}
    const forward=request({host:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers:{host:`127.0.0.1:${upstreamPort}`,...(req.headers['content-type']?{'content-type':req.headers['content-type']}:{})}},upstream=>{
      res.writeHead(upstream.statusCode??502,{'Content-Type':upstream.headers['content-type']??'application/json'});
      upstream.pipe(res);
    });
    forward.setTimeout(190000,()=>forward.destroy());
    forward.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Start the local web server before connecting your phone.'}));});
    res.on('close',()=>forward.destroy());
    let bytes=0;req.on('data',chunk=>{bytes+=chunk.length;if(bytes>16*1024*1024){forward.destroy();req.destroy();}});
    req.pipe(forward);
  };
}
