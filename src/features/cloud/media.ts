import type {SupabaseClient} from '@supabase/supabase-js';
import {stateSchema,type AppState} from '../../domain';
const prefix='rp-media:';
export async function browserDigest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function walk(value:unknown,transform:(s:string)=>Promise<string>,key?:string):Promise<unknown>{
 if(typeof value==='string')return key==='image'?transform(value):value;
 if(Array.isArray(value)){const result=[];for(const item of value)result.push(await walk(item,transform));return result;}
 if(value&&typeof value==='object'){const result:Record<string,unknown>={};for(const [key,item]of Object.entries(value))result[key]=await walk(item,transform,key);return result;}
 return value;
}
export function recordMedia(client:SupabaseClient,user:string,digest=browserDigest){
 const encoded=new Map<string,string>(),decoded=new Map<string,string>();
 const bucket=client.storage.from('health-record-media');
 return {
  async encode(state:AppState):Promise<AppState>{return stateSchema.parse(await walk(state,async value=>{
   if(value.startsWith(prefix)){if(!value.startsWith(`${prefix}${user}/`))throw Error('A photo belongs to another account.');return value;}
   if(!/^data:image\/(png|jpeg|webp);base64,/.test(value))return value;
   if(encoded.has(value))return encoded.get(value)!;
   const [header,data]=value.split(',');const mime=header.slice(5,header.indexOf(';'));const ext=mime==='image/jpeg'?'jpg':mime.split('/')[1];
   const path=`${user}/${await digest(value)}.${ext}`;
   const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
   if(bytes.length>10_000_000)throw Error('One photo is too large to save. Export a copy and use a smaller photo.');
   const {error}=await bucket.upload(path,bytes.buffer,{contentType:mime,upsert:false});
   if(error&&String((error as {statusCode?:string}).statusCode)!=='409')throw Error('Your photo could not be saved to your account. Your original remains on this device.');
   const ref=prefix+path;encoded.set(value,ref);decoded.set(ref,value);return ref;
  }));},
  async decode(state:AppState):Promise<AppState>{return stateSchema.parse(await walk(state,async value=>{
   if(!value.startsWith(prefix))return value;
   if(!value.startsWith(`${prefix}${user}/`)||!new RegExp(`^rp-media:${user}/[a-f0-9]{64}\\.(jpg|png|webp)$`).test(value))throw Error('A saved photo reference could not be verified.');
   if(decoded.has(value))return decoded.get(value)!;
   const {data,error}=await bucket.download(value.slice(prefix.length));
   if(error||!data)throw Error('A saved photo could not be restored. Your current records have not been replaced.');
   const bytes=new Uint8Array(await data.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
   const result=`data:${value.endsWith('.jpg')?'image/jpeg':value.endsWith('.png')?'image/png':'image/webp'};base64,${btoa(raw)}`;
   encoded.set(result,value);decoded.set(value,result);return result;
  }));}
 };
}
