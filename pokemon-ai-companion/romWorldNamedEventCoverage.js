'use strict';
// World-wide named event candidate index: 248 IDs, 507 pinned event names,
// exact ROM actor/handler map references and corroborated RAM bit values.
// A bit not set is NOT proof that a game objective remains actionable.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {lookupRomReference}=require('./romReferenceSemantics');
const names=require('./data/gen1EventNamesPret.json');
const fail=reason=>({verified:false,reason,maps:[],unmappedEvents:[],
 summary:null,actionsObserved:false,gameplayComplete:false});
const mapIdOk=id=>Number.isInteger(id)&&id>=0&&id<248;
const coordOk=n=>Number.isInteger(n)&&n>=0&&n<=255;
function buildWorldwideNamedEventCoverage({
 ledger,worldEventAtlas,mapReferences
}={}){
 const sha=String(ledger?.romSha256||'').toLowerCase();
 if(ledger?.verified!==true||!isKnownAuditedRomSha(sha)||
    worldEventAtlas?.verified!==true||
    worldEventAtlas.romSha256!==sha||
    ledger.summary?.namedReferenceEvents!==507||
    worldEventAtlas.summary?.namedEventBits!==507||
    names.sourceCommit!=='171e2c204f9c1ff8e577ca387a4bbb009e130843'||
    !Array.isArray(ledger.flags)||ledger.flags.length!==507||
    !Array.isArray(worldEventAtlas.events)||worldEventAtlas.events.length!==507||
    !Array.isArray(mapReferences)||mapReferences.length!==248)
  return fail('ROM, 507 bits ou catálogo dos 248 mapas incompleto');
 const maps=mapReferences.map((m,mapId)=>{
  // Gen I location labels are external pinned pret/pokered references.
  // ROM headers provide map IDs and objects but not these English names.
  const reference=lookupRomReference({romSha256:sha,mapId});
  return {
   mapId,mapName:reference.verified?reference.referenceMapName:null,
   mapNameOrigin:reference.verified?'pret/pokered':null,
   mapNameIntrinsicToRom:false,
   normalHeaderVerified:m?.valid===true,
   events:[],namedCandidateBits:0,flagSetBits:0,flagClearBits:0,
   actorBoundBits:0,handlerBoundBits:0
  };
 });
 if(maps.some(m=>typeof m.mapName!=='string'||!m.mapName||
   m.mapNameOrigin!=='pret/pokered'))
  return fail('Mapa sem rótulo externo fixado à revisão pret/pokered');
 if(mapReferences.some((m,id)=>m?.mapId!==id||
    typeof m.valid!=='boolean'))
  return fail('IDs dos mapas não correspondem à ROM');
 const live=new Map();
 for(const row of worldEventAtlas.events){
  const bit=row?.eventBitIndex;
  if(!Number.isInteger(bit)||bit<0||bit>=2560||
     typeof row.name!=='string'||typeof row.flagSet!=='boolean'||
     live.has(bit))
   return fail('Bits RAM repetidos ou malformados');
  live.set(bit,row);
 }
 const seen=new Set(),unmappedEvents=[];
 let candidates=0,multiMapBits=0;
 for(const row of ledger.flags){
  const bit=row?.bitIndex,referenceName=row?.referenceEventName;
  if(!Number.isInteger(bit)||bit<0||bit>=2560||
     names.eventNamesByBit?.[bit]!==referenceName||
     seen.has(bit)||live.get(bit)?.name!==referenceName||
     !Array.isArray(row.boundActorReferences)||
     !Array.isArray(row.readerPhysicalOpcodes)||
     !Array.isArray(row.writerSetPhysicalOpcodes)||
     !Array.isArray(row.writerResetPhysicalOpcodes))
   return fail('Nome e bit pret/pokered divergem da ROM ou da RAM');
  seen.add(bit);
  const related=new Map();
  const forMap=id=>{
   if(!related.has(id))related.set(id,{actorReferences:[],handlerReferences:[]});
   return related.get(id);
  };
  for(const actor of row.boundActorReferences){
   if(!mapIdOk(actor?.mapId)||!coordOk(actor.x)||!coordOk(actor.y)||
      actor.coordinatesFromRomHeader!==true||
      typeof actor.kind!=='string'||!Number.isInteger(actor.ordinal)||
      actor.ordinal<1||typeof actor.bitBindingEvidence!=='string')
    return fail('Proveniência ou coordenadas do ator ROM inválidas');
   forMap(actor.mapId).actorReferences.push({
    x:actor.x,y:actor.y,kind:actor.kind,ordinal:actor.ordinal,
    source:actor.bitBindingEvidence,coordinatesFromRomHeader:true
   });
  }
  for(const op of [
   ...row.readerPhysicalOpcodes,...row.writerSetPhysicalOpcodes,
   ...row.writerResetPhysicalOpcodes
  ]){
   if(!['BIT_TEST','SET_BIT','RESET_BIT'].includes(op?.operation)||
      !Number.isInteger(op.opcodeFileOffset)||op.opcodeFileOffset<0||
      !Array.isArray(op.referencedMaps)||op.referencedMaps.length===0||
      op.referencedMaps.some(id=>!mapIdOk(id)))
    return fail('Proveniência de opcode ROM inválida');
   for(const id of new Set(op.referencedMaps)){
    forMap(id).handlerReferences.push({
     operation:op.operation,opcodeFileOffset:op.opcodeFileOffset
    });
   }
  }
  const flagSet=live.get(bit).flagSet;
  if(related.size===0){
   unmappedEvents.push({
    name:referenceName,eventBitIndex:bit,flagSet,
    directRomMapEvidence:false,locationUnknown:true
   });
   continue;
  }
  candidates++;
  if(related.size>1)multiMapBits++;
  for(const [mapId,evidence] of related){
   const m=maps[mapId],actor=evidence.actorReferences.length>0,
    handler=evidence.handlerReferences.length>0;
   m.events.push({
    name:referenceName,eventBitIndex:bit,flagSet,
    actorReferences:evidence.actorReferences,
    handlerReferences:evidence.handlerReferences,
    association:actor&&handler?'ACTOR_AND_OPCODE':
      actor?'ACTOR_HEADER_ONLY':'OPCODE_HANDLER_ONLY',
    exactLocationProven:false,accessibleNow:null,
    scriptExecutedObserved:false,eventCompleted:null,
    rewardConfirmed:false
   });
   m.namedCandidateBits++;
   if(flagSet)m.flagSetBits++;else m.flagClearBits++;
   if(actor)m.actorBoundBits++;
   if(handler)m.handlerBoundBits++;
  }
 }
 if(seen.size!==507||live.size!==507||
    candidates+unmappedEvents.length!==507||
    ledger.summary?.namedBitsWithoutAnyDirectEvidence!==unmappedEvents.length)
  return fail('Cobertura de evidência não explica os 507 bits');
 for(const row of maps)
  row.events.sort((a,b)=>a.eventBitIndex-b.eventBitIndex);
 const mapIdsWithCandidates=maps.filter(m=>m.namedCandidateBits>0).length;
 const worldAssociations=maps.reduce((n,m)=>n+m.namedCandidateBits,0);
 const nonHeaderMapIds=maps.filter(m=>!m.normalHeaderVerified).length;
 return {verified:true,romSha256:sha,maps,unmappedEvents,
  summary:{
   mapIds:248,normalHeaders:248-nonHeaderMapIds,
   mapIdsWithCandidates,mapsWithoutCandidateEvidence:248-mapIdsWithCandidates,
   namedReferenceEvents:507,namedBitsWithMapEvidence:candidates,
   namedBitsWithNoDirectMapEvidence:unmappedEvents.length,
   multiMapReferencedBits:multiMapBits,worldCandidateAssociations:worldAssociations,
   incompleteScriptSemantics:true
  },
  actionsObserved:false,gameplayComplete:false,
  source:'PINNED_PRET_NAMES + SHA_AUDITED_ROM_ACTORS_HANDLERS + SEQUENTIAL_RAM',
  warning:'Associação de script a mapa e bit ativo/inativo não provam ação, acesso, local exato ou conclusão'};
}
module.exports={buildWorldwideNamedEventCoverage};
