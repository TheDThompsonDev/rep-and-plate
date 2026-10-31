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
export const corruptRecordsPrefix=`${activeKey}.corrupt-`;
const corruptCopies=3;
/** A copy belongs to the archive it was taken from. Guest copies keep the
 * plain `<prefix><stamp>` form; an account's copies end with its encoded
 * owner, like `health.account.<owner>`, so account cleanup can match them by
 * the same `:<userId>` suffix and never touch a guest's or another account's. */
export const corruptRecordsKey=(owner:string|null,stamp:string)=>owner?`${corruptRecordsPrefix}${stamp}.${encodeURIComponent(owner)}`:`${corruptRecordsPrefix}${stamp}`;
/** `null` for a guest copy, the owner for an account's copy, `undefined` when the key is not a copy. */
export function corruptRecordsOwner(key:string):string|null|undefined{
 if(!key.startsWith(corruptRecordsPrefix))return undefined;
 const match=/^(\d+(?:-\d+)?)(?:\.(.+))?$/.exec(key.slice(corruptRecordsPrefix.length));
 if(!match)return undefined;
 if(match[2]===undefined)return null;
 try{return decodeURIComponent(match[2]);}catch{return undefined;}
}
export type UnreadableReason='invalid'|'unsupported-version';
export type UnreadableRecords={reason:UnreadableReason;copy:'pending'|'kept'|'failed';key:string|null};
type PreservedRecords=UnreadableRecords&{raw:string;preserved:Promise<string>};
let unreadable:PreservedRecords|null=null;
const noticeListeners=new Set<()=>void>();
export const unreadableBrowserRecords=():UnreadableRecords|null=>unreadable&&{reason:unreadable.reason,copy:unreadable.copy,key:unreadable.key};
export function onBrowserRecordNotice(fn:()=>void){noticeListeners.add(fn);return()=>{noticeListeners.delete(fn);};}
/** Copy a snapshot the app could not read to a sibling key before anything can
 * replace it. The copy rides the shared write queue, so it lands ahead of any
 * later save or account switch. Idempotent per blob: a re-render adds nothing,
 * and a later session that meets the same blob reuses its earlier copy. */
export function preserveUnreadableBrowserRecords(raw:string,reason:UnreadableReason):Promise<string>{
 if(unreadable&&unreadable.raw===raw)return unreadable.preserved;
 // The same owner marker hydrateBrowserRecords read the blob under.
 const owner=localStorage.getItem('health.records.owner');
 const preserved=browserRecordTransaction(async()=>{
  const existing=(await browserKeys()).filter(key=>corruptRecordsOwner(key)===owner).sort();
  for(const key of [...existing].reverse())if(await browserGet(key)===raw)return key;
  let key=corruptRecordsKey(owner,String(Date.now()));
  for(let n=1;existing.includes(key);n++)key=corruptRecordsKey(owner,`${Date.now()}-${n}`);
  await browserSet(key,raw);
  for(const old of existing.slice(0,Math.max(0,existing.length+1-corruptCopies)))await browserRemove(old);
  return key;
 });
 const entry:PreservedRecords={reason,copy:'pending',key:null,raw,preserved};
 unreadable=entry;
 preserved.then(key=>{entry.copy='kept';entry.key=key;},()=>{entry.copy='failed';}).then(()=>{for(const fn of noticeListeners)fn();});
 return preserved;
}
export function unreadableRecordsMessage(notice:UnreadableRecords):string|null{
 if(notice.copy==='pending')return null;
 const opened=notice.reason==='unsupported-version'?'Your saved records were written by a newer version of Rep & Plate and could not be opened here.':'Your saved records on this device could not be opened.';
 return notice.copy==='kept'?`${opened} Nothing was replaced. A copy was kept on this device.`:`${opened} Nothing was replaced, but a copy could not be kept. Free up device storage before saving new records.`;
}
/** A snapshot that could not be read is replaced only once its copy exists. */
async function guardUnreadableRecords(){
 const pending=unreadable;
 if(!pending||await browserGet(activeKey)!==pending.raw)return;
 try{await pending.preserved;}catch{throw Error('Your earlier records could not be opened or copied, so they were left in place. Free up device storage and try again.');}
}
export async function persistBrowserRecords(state:unknown){
 const raw=JSON.stringify(state);const owner=localStorage.getItem('health.records.owner');
 const journal=pendingKey(owner);
 try{localStorage.setItem(journal,raw);}catch{/* Large records use IndexedDB. */}
 return browserRecordTransaction(async()=>{
  if(owner!==localStorage.getItem('health.records.owner'))throw Error('Your account changed before saving.');
  await guardUnreadableRecords();
  if(owner)await browserSet(`health.account.${encodeURIComponent(owner)}`,raw);
  await browserSet(activeKey,raw);cachedRaw=raw;
  if(localStorage.getItem(journal)===raw)localStorage.removeItem(journal);
 });
}
