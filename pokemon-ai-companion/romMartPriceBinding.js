'use strict';
// Cross-reference a ROM script mart only if exact variant, map, and ordered
// item IDs match the already SHA-256 audited economy catalogue. Never live data.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const fail=reason=>({verified:false,reason,offers:[],purchaseObserved:false,
  livePricesVerified:false,liveAccessVerified:false});
function bindMartPrices({romSha256,mapId,itemIds,catalogue}={}){
 const sha=String(romSha256||'').toLowerCase();
 if(!isKnownAuditedRomSha(sha)||!Number.isInteger(mapId)||mapId<0||mapId>=248||
    !Array.isArray(itemIds)||itemIds.length<1||itemIds.length>32||
    !itemIds.every(id=>Number.isInteger(id)&&id>0&&id<255))
   return fail('Identidade da variante, mapa ou IDs de artigos inválidos');
 const e=catalogue?.entries?.[sha];
 if(e?.verified!==true||e.romSha256!==sha||
    e.itemPrices?.verified!==true||e.tmPrices?.verified!==true||
    e.martShops?.verified!==true||!Array.isArray(e.martShops.shops)||
    !Array.isArray(e.itemPrices.items)||!Array.isArray(e.tmPrices.entries))
   return fail('Catálogo de economia SHA auditado indisponível');
 const matches=e.martShops.shops.filter(shop=>
   shop.mapId===mapId&&shop.referencedInCanonicalScript===true&&
   Array.isArray(shop.inventory)&&shop.inventory.length===itemIds.length&&
   shop.inventory.every((v,i)=>v.id===itemIds[i]));
 if(matches.length!==1)return fail('Loja sem ligação única ao catálogo da ROM');
 const offers=[];
 for(const [i,item] of matches[0].inventory.entries()){
   if(typeof item.name!=='string'||!item.name.trim())
     return fail('Nome de artigo ROM por validar');
   const source=itemIds[i]>=201?e.tmPrices.entries:e.itemPrices.items;
   const found=source.filter(v=>(v.itemId??v.id)===itemIds[i]);
   if(found.length!==1||!Number.isInteger(found[0].pricePokedollars)||
      found[0].pricePokedollars<0||
      (itemIds[i]<201&&found[0].priceReadFromRom!==true))
     return fail('Preço-base ROM sem correspondência única');
   const price=found[0].pricePokedollars;
   offers.push({id:itemIds[i],name:item.name,
     baseRomPricePokedollars:price>0?price:null,
     priceIsLive:false,availableNow:null});
 }
 return {verified:true,romSha256:sha,mapId,shopLabel:matches[0].label,
   offers,source:'SHA256_AUDITED_ROM_ECONOMY_AND_MART_MATCH',
   purchaseObserved:false,livePricesVerified:false,liveAccessVerified:false};
}
module.exports={bindMartPrices};
