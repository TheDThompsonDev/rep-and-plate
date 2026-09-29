import { describe,it,expect } from 'vitest';
import { authorizeMobile,mobileGateway } from './mobile-gateway';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
describe('paired native development access',()=>{
  const token='a'.repeat(64);
  it('never trusts spoofed Host and requires a strong token',()=>{
    expect(authorizeMobile({host:'localhost'},token)).toBe(false);
    expect(authorizeMobile({authorization:`Bearer ${'b'.repeat(64)}`},token)).toBe(false);
    expect(authorizeMobile({authorization:`Bearer ${token}`},token)).toBe(true);
    expect(authorizeMobile({authorization:'Bearer short'},'short')).toBe(false);
    expect(()=>mobileGateway('short')).toThrow();
  });
  it('forwards only authenticated API requests to a fixed local upstream',async()=>{
    let calls=0;
    const upstream=createServer((req,res)=>{calls++;expect(req.headers.origin).toBeUndefined();expect(req.headers.authorization).toBeUndefined();res.end(JSON.stringify({ok:true}));});
    await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
    const bridge=createServer(mobileGateway(token,(upstream.address() as AddressInfo).port));
    await new Promise<void>(resolve=>bridge.listen(0,'127.0.0.1',resolve));
    const url=`http://127.0.0.1:${(bridge.address() as AddressInfo).port}`;
    try{
      expect((await fetch(url+'/api/status')).status).toBe(401);
      expect((await fetch(url+'/api/status',{headers:{Authorization:`Bearer ${token}`,Origin:'https://untrusted.example'}})).status).toBe(403);
      expect((await fetch(url+'/.env',{headers:{Authorization:`Bearer ${token}`}})).status).toBe(404);
      const preflight=await fetch(url+'/api/status',{method:'OPTIONS',headers:{Origin:'http://localhost:8081'}});
      expect(preflight.status).toBe(204);expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8081');
      expect(calls).toBe(0);
      expect(await(await fetch(url+'/api/status',{headers:{Authorization:`Bearer ${token}`,Origin:'http://localhost:8081'}})).json()).toEqual({ok:true});expect(calls).toBe(1);
    }finally{await Promise.all([new Promise<void>(resolve=>bridge.close(()=>resolve())),new Promise<void>(resolve=>upstream.close(()=>resolve()))]);}
  });
});
