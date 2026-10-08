import {seed,publicCatalog,validateCatalog} from './catalog.js';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export default {async fetch(request,env){
 const url=new URL(request.url);
 const response=url.pathname.startsWith('/api/')?await env.STORE.get(env.STORE.idFromName('aurion-catalog')).fetch(request):await env.ASSETS.fetch(request);
 const headers=new Headers(response.headers);
 headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 if(url.pathname.includes('admin')||url.pathname.includes('setup'))headers.set('Cache-Control','no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}};
export class AurionStore {
 constructor(ctx,env){this.ctx=ctx;this.env=env}
 async fetch(request){try{return await this.handle(request)}catch(e){console.error('Request failed:',e.name);return json({error:'Interner Fehler. Bitte erneut versuchen.'},500)}}
 async alarm(){const now=Date.now();const sessions=await this.ctx.storage.list({prefix:'session:'});for(const [key,value] of sessions)if(value.expires<=now)await this.ctx.storage.delete(key);const limits=await this.ctx.storage.list({prefix:'limit:'});for(const [key,value] of limits)if(value.until<=now)await this.ctx.storage.delete(key);await this.ctx.storage.setAlarm(now+3600000)}
 async handle(request){
  const url=new URL(request.url),path=url.pathname,storage=this.ctx.storage;
  const catalog=()=>storage.get('catalog').then(c=>c||structuredClone(seed));
  const mediaId=path.match(/^\/api\/media\/([a-f0-9-]{36})$/)?.[1];
  if(mediaId&&['GET','HEAD'].includes(request.method)){
   const meta=await storage.get('media:'+mediaId);if(!meta)return json({error:'Bild nicht gefunden'},404);
   const headers={'Content-Type':meta.type,'Content-Length':String(meta.size),'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'};
   if(request.method==='HEAD')return new Response(null,{headers});
   const chunks=await Promise.all(Array.from({length:meta.chunks},(_,i)=>storage.get('image:'+mediaId+':'+i)));
   if(chunks.some(c=>!c))return json({error:'Bild nicht verfügbar'},500);
   return new Response(new Blob(chunks,{type:meta.type}),{headers});
  }
  if(path==='/api/public/catalog'&&request.method==='GET')return json(publicCatalog(await catalog()));
  if(!path.startsWith('/api/admin/'))return json({error:'Nicht gefunden'},404);
  if(!/^[a-f0-9]{64}$/.test(this.env.ADMIN_PASSWORD_HASH||''))return json({error:'Admin-Login noch nicht eingerichtet. ADMIN_PASSWORD_HASH in Cloudflare hinterlegen.'},503);
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==url.origin)return json({error:'Anfrageherkunft abgelehnt'},403);
  let body=null;if(['POST','PUT'].includes(request.method)&&path!=='/api/admin/images'){if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON erforderlich'},415);if(Number(request.headers.get('Content-Length')||0)>1000000)return json({error:'Anfrage zu groß'},413);const raw=await request.text();if(raw.length>1000000)return json({error:'Anfrage zu groß'},413);try{body=JSON.parse(raw)}catch{return json({error:'Ungültiges JSON'},400)}}
  if(path==='/api/admin/login'&&request.method==='POST'){
   const ip=request.headers.get('CF-Connecting-IP')||'unknown';const key='limit:'+await hash(ip);const now=Date.now();
   const blocked=await storage.transaction(async tx=>{let limit=await tx.get(key);if(!limit||limit.until<=now)limit={attempts:0,until:now+900000};if(limit.attempts>=5)return true;limit.attempts++;await tx.put(key,limit);return false});
   await storage.setAlarm(now+3600000);if(blocked)return json({error:'Zu viele Anmeldeversuche. Bitte nach 15 Minuten erneut versuchen.'},429);
   if(typeof body?.password!=='string'||body.password.length>256||body.username!==(this.env.ADMIN_USERNAME||'admin')||!equal(await hash(body.password),this.env.ADMIN_PASSWORD_HASH))return json({error:'Benutzername oder Passwort falsch'},401);
   await storage.delete(key);const token=crypto.randomUUID()+crypto.randomUUID();const csrf=crypto.randomUUID();const expires=now+8*3600000;await storage.put('session:'+await hash(token),{csrf,expires,credential:this.env.ADMIN_PASSWORD_HASH});
   return json({csrf},200,{'Set-Cookie':`aurion_session=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`});
  }
  const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)aurion_session=([a-f0-9-]{72})/)?.[1];const key=token?'session:'+await hash(token):null;const session=key?await storage.get(key):null;
  if(!session||session.expires<=Date.now()||session.credential!==this.env.ADMIN_PASSWORD_HASH)return json({error:'Bitte anmelden'},401);
  if(request.method!=='GET'&&request.headers.get('X-CSRF-Token')!==session.csrf)return json({error:'Sicherheitsprüfung fehlgeschlagen'},403);
  if(path==='/api/admin/images'&&request.method==='POST'){
   const type=request.headers.get('Content-Type')?.split(';')[0];
   if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'Bitte JPG, PNG oder WebP verwenden.'},415);
   const max=2*1024*1024;if(Number(request.headers.get('Content-Length')||0)>max)return json({error:'Bild darf maximal 2 MB groß sein.'},413);
   if(!request.body)return json({error:'Bild fehlt'},400);
   const reader=request.body.getReader(),parts=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();return json({error:'Bild darf maximal 2 MB groß sein.'},413)}parts.push(value)}
   const bytes=new Uint8Array(await new Blob(parts).arrayBuffer());
   const isJpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
   const isPng=[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
   const isWebp=new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
   if(size<12||!({'image/jpeg':isJpeg,'image/png':isPng,'image/webp':isWebp}[type]))return json({error:'Die Datei ist kein gültiges Bild dieses Formats.'},400);
   const id=crypto.randomUUID(),chunkSize=60000,chunks=Math.ceil(size/chunkSize);
   await storage.transaction(async tx=>{for(let i=0;i<chunks;i++)await tx.put('image:'+id+':'+i,bytes.slice(i*chunkSize,(i+1)*chunkSize).buffer);await tx.put('media:'+id,{type,size,chunks})});
   return json({url:'/api/media/'+id},201);
  }
  if(path==='/api/admin/session'&&request.method==='GET')return json({csrf:session.csrf});
  if(path==='/api/admin/logout'&&request.method==='POST'){await storage.delete(key);return json({ok:true},200,{'Set-Cookie':'aurion_session=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0'})}
  if(path==='/api/admin/catalog'&&request.method==='GET')return json(await catalog());
  if(path==='/api/admin/catalog'&&request.method==='PUT'){
   let validated;try{validated=validateCatalog(body)}catch(e){return json({error:e.message},400)}
   const result=await storage.transaction(async tx=>{const old=await tx.get('catalog')||seed;if(validated.revision!==old.revision)return false;validated.revision++;await tx.put('catalog',validated);return true});
   return result?json(validated):json({error:'Der Katalog wurde inzwischen geändert. Bitte neu laden.'},409);
  }return json({error:'Nicht gefunden'},404);
 }
}
