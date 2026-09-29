// IndexedDB holds full histories/photos; localStorage remains a best-effort
// compatibility mirror for existing installations and older app versions.
let database:Promise<IDBDatabase>|undefined;
let cachedRaw:string|null=null;
let writes:Promise<unknown>=Promise.resolve();
/** Account switches/deletion and ordinary saves share this queue. A slow photo
 * write must finish before the active account is changed. */
export function browserRecordTransaction<T>(work:()=>Promise<T>):Promise<T>{
 const result=writes.then(work,work);writes=result.catch(()=>{});return result;
}
const activeKey='fuel.prototype.v1';
const pendingKey=(owner:string|null)=>`health.pending.${owner?encodeURIComponent(owner):'guest'}`;
function db(){
 if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('rep-and-plate-records',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('records');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>{database=undefined;reject(Error('Device storage is unavailable.'));};
 });return database;
}
export async function browserGet(key:string):Promise<string|null>{
 if(typeof indexedDB!=='undefined'){
  const database=await db();
  const value=await new Promise<string|undefined>((resolve,reject)=>{const tx=database.transaction('records','readonly');const r=tx.objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Your saved records could not be read.'));});
  if(value!==undefined)return value;
 }
 return localStorage.getItem(key);
}
export async function browserSet(key:string,value:string){
 let durable=false;
 if(typeof indexedDB!=='undefined'){
  const database=await db();
  await new Promise<void>((resolve,reject)=>{const tx=database.transaction('records','readwrite');tx.objectStore('records').put(value,key);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(Error('Device storage is full. Export your records before closing.'));});durable=true;
 }
 try{localStorage.setItem(key,value);}catch(e){if(!durable)throw e;}
}
export async function browserRemove(key:string){
 if(typeof indexedDB!=='undefined'){const database=await db();await new Promise<void>((resolve,reject)=>{const tx=database.transaction('records','readwrite');tx.objectStore('records').delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('Device cleanup could not finish.'));});}
 localStorage.removeItem(key);
}
export async function browserKeys():Promise<string[]>{
 const keys=new Set(Object.keys(localStorage));
 if(typeof indexedDB!=='undefined'){
  const database=await db();
  const stored=await new Promise<IDBValidKey[]>((resolve,reject)=>{const r=database.transaction('records','readonly').objectStore('records').getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Device records could not be listed.'));});
  for(const key of stored)if(typeof key==='string')keys.add(key);
 }
 return [...keys];
}
export async function hydrateBrowserRecords(){
 const owner=localStorage.getItem('health.records.owner');
 // The owner marker is the account-switch commit point. If the tab stopped
 // after writing another account's active copy, restore this owner's archive.
 const owned=owner?await browserGet(`health.account.${encodeURIComponent(owner)}`):null;
 // A small synchronous journal covers a refresh immediately after an edit,
 // before IndexedDB finishes. Large photos still use the awaited durable path.
 cachedRaw=localStorage.getItem(pendingKey(owner))??owned??await browserGet(activeKey);
}
export const currentBrowserRaw=()=>cachedRaw??localStorage.getItem(activeKey);
export function forgetBrowserCache(){cachedRaw=null;}
export async function persistBrowserRecords(state:unknown){
 const raw=JSON.stringify(state);const owner=localStorage.getItem('health.records.owner');
 const journal=pendingKey(owner);
 try{localStorage.setItem(journal,raw);}catch{/* Large records use IndexedDB. */}
 return browserRecordTransaction(async()=>{
  if(owner!==localStorage.getItem('health.records.owner'))throw Error('Your account changed before saving.');
  if(owner)await browserSet(`health.account.${encodeURIComponent(owner)}`,raw);
  await browserSet(activeKey,raw);cachedRaw=raw;
  if(localStorage.getItem(journal)===raw)localStorage.removeItem(journal);
 });
}
