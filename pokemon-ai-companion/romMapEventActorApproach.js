'use strict';
// Only a possible *adjacent tile* approach to an actor whose coordinates
// exist in SHA-audited ROM headers. Never assert current visibility,
// an interaction trigger, available-now access, or story completion.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {planItemAccess}=require('./romItemReachability');
const refuse=(reason)=>({verified:false,reason,entries:[],
 accessibilityCertified:false,interactionExecuted:false,
 eventCompleted:null,atomicSnapshotVerified:false});
const byte=n=>Number.isInteger(n)&&n>=0&&n<=255;
const LIMIT=96;
function planEventActorApproaches({
 namedEventMap,terrain,romSha256,mapId,position,
 mapSnapshotVerified=false,positionVerified=false,latePositionVerified=false,
 modeByte=null,spritesVerified=false,mapEntities=[],canCut=null,canSurf=null
}={}){
 const sha=String(romSha256||'').toLowerCase();
 if(!isKnownAuditedRomSha(sha)||!byte(mapId)||mapId>=248||
    namedEventMap?.verified!==true||namedEventMap.romSha256!==sha||
    namedEventMap.mapId!==mapId||
    !Array.isArray(namedEventMap.events)||
    namedEventMap.summary?.mapEventBitCandidates!==namedEventMap.events.length||
    mapSnapshotVerified!==true||positionVerified!==true||
    latePositionVerified!==true||terrain?.mapId!==mapId)
  return refuse('Identidade ROM, mapa, coordenadas finais ou catálogo de eventos não corroborados');
 const targets=[],seen=new Set();
 for(const event of namedEventMap.events){
  if(!byte(event?.eventBitIndex)&&
     !(Number.isInteger(event?.eventBitIndex)&&
       event.eventBitIndex>=256&&event.eventBitIndex<2560))
   return refuse('Bit do evento inválido');
  if(typeof event.name!=='string'||typeof event.flagSet!=='boolean'||
     !Array.isArray(event.actorReferences))
   return refuse('Referência nomeada inválida');
  for(const actor of event.actorReferences){
   if(!byte(actor?.x)||!byte(actor?.y)||
      actor.coordinatesFromRomHeader!==true||
      !Number.isInteger(actor.ordinal)||actor.ordinal<1||
      typeof actor.kind!=='string')
    return refuse('Coordenadas de ator sem proveniência do cabeçalho ROM');
   const id=event.eventBitIndex+':'+actor.kind+':'+actor.ordinal+':'+
     actor.x+':'+actor.y;
   if(seen.has(id))return refuse('Ator ROM duplicado ou associação ambígua');
   seen.add(id);
   targets.push({
    id,name:event.name,eventBitIndex:event.eventBitIndex,
    flagSet:event.flagSet,kind:actor.kind,
    ordinal:actor.ordinal,x:actor.x,y:actor.y
   });
   if(targets.length>LIMIT)
    return refuse('Número de atores excede orçamento do planeador');
  }
 }
 if(!targets.length)
  return {verified:true,mapId,romSha256:sha,entries:[],
   candidateActors:0,accessibilityCertified:false,interactionExecuted:false,
   eventCompleted:null,atomicSnapshotVerified:false,
   warning:'Sem objetos de cabeçalho associados a eventos neste mapa'};
 const items=targets.map(t=>({
  name:t.name,x:t.x,y:t.y,type:'visible',
  romItemCoordinatesVerified:true
 }));
 const planned=planItemAccess({
  terrain,romSha256:sha,position,items,
  mapSnapshotVerified:true,positionVerified:true,modeByte,
  spritesVerified,mapEntities,canCut,canSurf
 });
 if(planned.verified!==true||planned.mapId!==mapId||
    planned.romSha256!==sha||!Array.isArray(planned.results)||
    planned.results.length!==targets.length)
  return refuse(planned.reason||'Planeador de terreno não verificado');
 const entries=targets.map((t,index)=>{
  const route=planned.results[index];
  if(route?.index!==index||route.x!==t.x||route.y!==t.y||
     typeof route.accessStatus!=='string')
   return null;
  return {...t,accessStatus:route.accessStatus,
   conditionalRoute:route.route||null,
   reason:route.reason||null,accessibleNow:null,
   actorVisibleNow:null,interactionTriggerVerified:false,
   eventCompleted:null,scriptExecutedObserved:false
  };
 });
 if(entries.some(e=>e===null))
  return refuse('Associação coordenada/resultado do planeador mudou');
 return {verified:true,mapId,romSha256:sha,entries,
  candidateActors:entries.length,
  accessibilityCertified:false,interactionExecuted:false,
  eventCompleted:null,atomicSnapshotVerified:false,
  proof:'STATIC_ROM_ACTOR_COORDINATES + ROM_TERRAIN_HASH + CORROBORATED_RAM_POSITION',
  warning:'Geometria aproximada para chegar ao lado do objeto. Cut/Surf/Strength, visibilidade e eventos dinâmicos não são garantidos'};
}
module.exports={planEventActorApproaches};
