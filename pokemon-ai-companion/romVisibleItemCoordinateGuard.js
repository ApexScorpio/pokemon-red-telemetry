'use strict';
// A manual location is never promoted to a collectible tile unless this
// exact audited ROM exposes a matching item object in the current map.
// This guards version-specific coordinates (Red/Blue vs Green, maps 226/227)
// without hard-coding their item positions into production.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const coord=n=>Number.isInteger(n)&&n>=-4&&n<=255;
const integerOrNull=n=>n===null||Number.isSafeInteger(n)&&n>=0;
const reference=(item,reason)=>({
 name:typeof item?.name==='string'?item.name:'Item da referência manual',
 source:'MANUAL_COORDINATES_NOT_VERIFIED_FOR_ACTIVE_ROM',
 referenceX:coord(item?.x)?item.x:null,
 referenceY:coord(item?.y)?item.y:null,
 x:null,y:null,romItemCoordinatesVerified:false,
 accessibleNow:null,collected:null,
 reason
});
function reconcileVisibleItemCoordinates({
 mapId,romSha256,romIdentityMatched=false,romAreaEvidence,manualItems=[]
}={}){
 const manual=Array.isArray(manualItems)?manualItems:[];
 const deny=reason=>({
  verified:false,mapId,romSha256:null,
  matchedManualItems:[],remainingRomItems:[],
  unmatchedManualReferences:manual.map(x=>reference(x,reason)),
  reason,romObjectCount:null,gameplayAccessCertified:false
 });
 if(!Array.isArray(manualItems))return deny('Manual visible item catalogue is not an array');
 if(!Number.isInteger(mapId)||mapId<0||mapId>247||
    !isKnownAuditedRomSha(romSha256)||
    romIdentityMatched!==true||
    romAreaEvidence?.verified!==true||
    romAreaEvidence.mapId!==mapId||
    !Array.isArray(romAreaEvidence.items))
  return deny('ROM identity, map or complete visible item list not corroborated');
 const items=romAreaEvidence.items;
 const ordinals=new Set();
 for(const r of items){
  if(!r||r.mapId!==mapId||r.kind!=='item'||
     r.source!=='OBJETO_DEFINIDO_NA_ROM_COM_CRC32_CORRESPONDENTE'||
     r.existsInRom!==true||
     !coord(r.x)||!coord(r.y)||
     !Number.isSafeInteger(r.objectOrdinal)||r.objectOrdinal<1||
     !integerOrNull(r.itemId)||ordinals.has(r.objectOrdinal))
   return deny('Conflicting or incomplete ROM item evidence for map '+mapId);
  ordinals.add(r.objectOrdinal);
 }
 const used=new Set(),matchedManualItems=[],unmatchedManualReferences=[];
 for(const m of manual){
  if(!coord(m?.x)||!coord(m?.y)){
   unmatchedManualReferences.push(reference(m,'Manual coordinates are invalid'));
   continue;
  }
  // Ambiguous coordinates do not identify one particular object.
  const candidates=items.filter(r=>r.x===m.x&&r.y===m.y&&
    (m.itemId===undefined||m.itemId===null||m.itemId===r.itemId));
  const only=candidates.length===1?candidates[0]:null;
  if(!only||used.has(only.objectOrdinal)){
   unmatchedManualReferences.push(reference(m,
     'No unique item object matches the active ROM coordinates and item ID'));
   continue;
  }
  used.add(only.objectOrdinal);
  matchedManualItems.push({...m,
   romItemCoordinatesVerified:true,
   romObjectOrdinal:only.objectOrdinal,
   itemId:only.itemId,
   coordinateSource:'SHA_AUDITED_ACTIVE_ROM_ITEM_OBJECT',
   referenceNameNotVerifiedByRom:true});
 }
 const remainingRomItems=items.filter(r=>!used.has(r.objectOrdinal));
 return {verified:true,mapId,romSha256:romSha256.toLowerCase(),
  matchedManualItems,remainingRomItems,unmatchedManualReferences,
  romObjectCount:items.length,
  pairedBy:'EXACT_COORDINATES_AND_OPTIONAL_ITEM_ID',
  gameplayAccessCertified:false,
  warning:'Static ROM coordinates are verified for this profile, not current item presence, collection or reachability.'};
}
module.exports={reconcileVisibleItemCoordinates};
