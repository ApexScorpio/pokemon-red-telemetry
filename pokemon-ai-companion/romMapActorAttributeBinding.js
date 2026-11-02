'use strict';
// ROM-variant-specific static actor binding for ALL map IDs. No RAM or gameplay
// effect is inferred from the mere existence of a ROM object or script.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const MAPS=248,HEADERS=226,ITEMS=106,STATIONARY=12;
const fail=(reason,mapId=null)=>({verified:false,reason,mapId,
 bindings:[],romSha256:null,summary:null,
 runtimeAccessCertified:false,gameplayCollectionCertified:false});
const byte=x=>Number.isInteger(x)&&x>=0&&x<=255;
const coord=x=>Number.isInteger(x)&&x>=-4&&x<=255;
function bindMapActorAttributes({index,scriptAtlas,mapId}={}){
 if(!Number.isInteger(mapId)||mapId<0||mapId>=MAPS)
  return fail('Invalid map ID',mapId);
 const hash=index?.romSha256;
 if(!isKnownAuditedRomSha(hash)||scriptAtlas?.romSha256!==hash||
    index?.verified!==true||scriptAtlas?.verified!==true||
    index.source!=='SHA_AUDITED_ROM_PROFILE_ALL_MAP_HEADERS_AND_OBJECT_RECORDS'||
    scriptAtlas.source!=='SHA_AUDITED_ROM_ALL_MAP_OBJECT_TEXT_REFERENCES'||
    !Array.isArray(index.maps)||index.maps.length!==MAPS||
    !Array.isArray(scriptAtlas.maps)||scriptAtlas.maps.length!==MAPS)
  return fail('Index and script atlas are not from the same exact ROM',mapId);
 const m=index.maps[mapId],sm=scriptAtlas.maps[mapId];
 if(m?.mapId!==mapId||sm?.mapId!==mapId||
    m.verified!==sm.verified)
  return fail('Map header status differs between two ROM decoders',mapId);
 if(m.verified!==true){
  if(sm.verified!==false||!Array.isArray(sm.interactions)||
     sm.interactions.length!==0)
   return fail('Non-normal map pretends to contain actor references',mapId);
  return {verified:true,mapId,romSha256:hash,hasNormalHeader:false,
   bindings:[],summary:{items:0,stationaryPokemon:0},
   runtimeAccessCertified:false,gameplayCollectionCertified:false};
 }
 if(!m.contents||!Array.isArray(m.contents.visibleItems)||
    !Array.isArray(m.contents.stationaryPokemon)||
    !Array.isArray(sm.interactions))
  return fail('Incomplete actor object lists',mapId);
 const bindings=[],seen=new Set();
 const groups=[
  {name:'visibleItems',kind:'ITEM'},
  {name:'stationaryPokemon',kind:'STATIC_POKEMON'}
 ];
 for(const {name,kind} of groups){
  const content=m.contents[name],scriptRows=sm.interactions.filter(r=>r.kind===kind);
  if(scriptRows.length!==content.length)
   return fail('Map actor/script object count mismatch: '+mapId+':'+kind,mapId);
  for(const obj of content){
   if(obj?.source!=='ROM_MAP_OBJECT_BYTES'||obj.kind!==
      (kind==='ITEM'?'item':'wildPokemon')||
      !Number.isInteger(obj.ordinal)||obj.ordinal<1||
      !coord(obj.x)||!coord(obj.y)||!byte(obj.textId))
    return fail('Physical ROM actor record malformed',mapId);
   const matches=scriptRows.filter(r=>r.ordinal===obj.ordinal&&
    r.x===obj.x&&r.y===obj.y&&r.rawTextId===obj.textId);
   if(matches.length!==1)
    return fail('No unique coordinate+ordinal+text match: '+mapId+':'+kind,mapId);
   const r=matches[0],metadata=r.actorRomMetadata;
   if(r.source!=='SHA_AUDITED_ROM_MAP_OBJECT_AND_TEXT_POINTER'||
      r.textPointerVerified!==true||r.mapId!==mapId||
      r.conditionsFullyDecoded!==false||r.scriptEffectsVerified!==false||
      r.accessibleNow!==null||r.alreadyCompleted!==null)
    return fail('Script reference does not establish a safe physical actor',mapId);
   const actorId=kind+':'+obj.ordinal;
   if(seen.has(actorId))return fail('Duplicate actor ordinal',mapId);
   seen.add(actorId);
   let details=null;
   if(kind==='ITEM'){
    const id=obj.itemOrTrainerId;
    if(!byte(id)||!metadata||!byte(metadata.itemId)||
       metadata.itemId!==id)
     return fail('Item ID differs between independent ROM decoders',mapId);
    details={itemId:id};
   }else{
    const species=obj.wildSpeciesInternalId,level=obj.wildLevel;
    if(!Number.isInteger(species)||species<1||species>190||
       !Number.isInteger(level)||level<1||level>100||
       !metadata||metadata.speciesInternalId!==species||
       metadata.level!==level)
     return fail('Stationary species/level differs between ROM decoders',mapId);
    details={speciesInternalId:species,level};
   }
   bindings.push({mapId,kind,ordinal:obj.ordinal,
    x:obj.x,y:obj.y,textId:obj.textId,
    ...details,
    scriptFileOffset:r.scriptFileOffset,
    romCoordinateAndAttributeVerified:true,
    activeRuntimeActorVerified:false,
    accessibleNow:null,collectedNow:null,completedNow:null,
    source:'SAME_SHA_ROM_MAP_OBJECT_AND_SCRIPT_REFERENCE'});
  }
 }
 return {verified:true,mapId,romSha256:hash,hasNormalHeader:true,
  bindings,summary:{items:bindings.filter(x=>x.kind==='ITEM').length,
   stationaryPokemon:bindings.filter(x=>x.kind==='STATIC_POKEMON').length},
  runtimeAccessCertified:false,gameplayCollectionCertified:false};
}
function auditWorldActorAttributeBindings({index,scriptAtlas}={}){
 const hash=index?.romSha256;
 if(!isKnownAuditedRomSha(hash)||scriptAtlas?.romSha256!==hash)
  return fail('Exact ROM identity required for world actor bindings');
 const byMap=[];let normal=0,items=0,stationary=0;
 for(let mapId=0;mapId<MAPS;mapId++){
  const map=bindMapActorAttributes({index,scriptAtlas,mapId});
  if(map.verified!==true)return fail('Map '+mapId+': '+map.reason,mapId);
  byMap.push(map);
  if(map.hasNormalHeader)normal++;
  items+=map.summary.items;
  stationary+=map.summary.stationaryPokemon;
 }
 if(normal!==HEADERS||items!==ITEMS||stationary!==STATIONARY||
    index.totals?.normalMaps!==HEADERS||
    index.totals?.visibleItems!==ITEMS||
    index.totals?.stationaryPokemon!==STATIONARY)
  return fail('World totals do not reconcile with ROM actor records');
 return {verified:true,romSha256:hash,byMap,
  summary:{mapIds:MAPS,normalHeaders:normal,visibleItems:items,
   stationaryPokemon:stationary,actorBindings:items+stationary,
   unsafeOrContradictoryBindings:0},
  runtimeAccessCertified:false,gameplayCollectionCertified:false,
  warning:'Static version-specific coordinates and attributes cannot prove access, collection or live actor presence.'};
}
module.exports={bindMapActorAttributes,auditWorldActorAttributeBindings};
