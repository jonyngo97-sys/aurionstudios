export const seed={revision:1,products:[{id:'aurion-shirt',name:'AURION T-SHIRT',description:'Oversized premium T-shirt crafted from 260 GSM pre-washed cotton. Finished with premium embroidery and HD screen print.',price:5990,images:['/assets/product.webp','/assets/front.webp','/assets/embroidery.webp'],sizes:['XS','S','M','L','XL','XXL'],dropId:'drop-001',status:'published'}],drops:[{id:'drop-001',name:'DROP 001',description:'The first drop. Built on discipline. Driven by purpose. Made for those who earn everything.',status:'published',launchAt:''}],offers:[]};
export function publicCatalog(catalog,now=Date.now()){
 const drops=catalog.drops.filter(d=>d.status==='published'&&(!d.launchAt||Date.parse(d.launchAt)<=now));
 const products=catalog.products.filter(p=>p.status==='published'&&(!p.dropId||drops.some(d=>d.id===p.dropId))).map(p=>{
  let price=p.price;let offerTitle='';
  for(const offer of catalog.offers){if(offer.status!=='published'||(offer.startAt&&Date.parse(offer.startAt)>now)||(offer.endAt&&Date.parse(offer.endAt)<=now))continue;
   if(offer.productId!==p.id&&(!offer.dropId||offer.dropId!==p.dropId))continue;
   const candidate=offer.kind==='percent'?Math.round(p.price*(100-offer.value)/100):offer.value;
   if(candidate<price){price=candidate;offerTitle=offer.name}
  }return {...p,originalPrice:p.price,price,offerTitle};
 });return {revision:catalog.revision,products,drops};
}
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error('Ungültiger Text');return value.trim()}
function status(value){if(!['draft','published'].includes(value))throw new Error('Ungültiger Status');return value}
function date(value){const v=text(value,40);if(v&&!Number.isFinite(Date.parse(v)))throw new Error('Ungültiges Datum');return v}
function image(value){const v=text(value,2000,true);if(/^\/assets\/[a-zA-Z0-9_./-]+$/.test(v)&&!v.includes('..'))return v;const url=new URL(v);if(url.protocol!=='https:')throw new Error('Bild benötigt HTTPS');return v}
function money(value){if(!Number.isInteger(value)||value<0||value>10000000)throw new Error('Ungültiger Preis');return value}
export function validateCatalog(body){
 if(!body||!Number.isInteger(body.revision))throw new Error('Revision fehlt');
 for(const k of ['products','drops','offers'])if(!Array.isArray(body[k])||body[k].length>500)throw new Error('Ungültiger Katalog');
 const ids=new Set();const id=v=>{if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(v)||ids.has(v))throw new Error('Ungültige oder doppelte ID');ids.add(v);return v};
 const drops=body.drops.map(d=>({id:id(d.id),name:text(d.name,150,true),description:text(d.description,5000),status:status(d.status),launchAt:date(d.launchAt)}));
 const products=body.products.map(p=>{if(!Array.isArray(p.images)||!p.images.length||p.images.length>10||!Array.isArray(p.sizes)||!p.sizes.length||p.sizes.length>20)throw new Error('Bilder und Größen fehlen');if(p.dropId&&!drops.some(d=>d.id===p.dropId))throw new Error('Drop existiert nicht');return {id:id(p.id),name:text(p.name,150,true),description:text(p.description,5000),price:money(p.price),images:p.images.map(image),sizes:[...new Set(p.sizes.map(s=>text(s,30,true)))],dropId:text(p.dropId,80),status:status(p.status)}});
 const offers=body.offers.map(o=>{if(!['percent','price'].includes(o.kind))throw new Error('Ungültiges Angebot');if((!!o.productId)===(!!o.dropId))throw new Error('Wähle einen Artikel oder Drop');if(o.productId&&!products.some(p=>p.id===o.productId)||o.dropId&&!drops.some(d=>d.id===o.dropId))throw new Error('Angebotsziel existiert nicht');if(o.kind==='percent'&&(!Number.isInteger(o.value)||o.value<1||o.value>100))throw new Error('Rabatt muss 1–100 % betragen');if(o.kind==='price')money(o.value);const startAt=date(o.startAt),endAt=date(o.endAt);if(startAt&&endAt&&Date.parse(startAt)>=Date.parse(endAt))throw new Error('Ende muss nach Beginn liegen');return {id:id(o.id),name:text(o.name,150,true),description:text(o.description,2000),productId:text(o.productId,80),dropId:text(o.dropId,80),kind:o.kind,value:o.value,startAt,endAt,status:status(o.status)}});
 return {revision:body.revision,products,drops,offers};
}
