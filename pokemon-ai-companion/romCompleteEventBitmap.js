'use strict';
// Evidence inventory for ALL 2,560 bits of D747..D886 (320 bytes).
// Only 507 have pinned external labels. Other slots may be unknown/reserved.
// A RAM bit, opcode or object-header binding is NOT a completed quest.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {buildGlobalFlagOperationCatalogue}=require('./romGlobalFlagOperationCatalogue');
const pinned=require('./data/gen1EventNamesPret.json');
const REFERENCE_SHA='171e2c204f9c1ff8e577ca387a4bbb009e130843';
const HEX=/^[0-9a-f]{2}$/i;
const reject=reason=>({verified:false,reason,bits:[],summary:null,
 allBitPositionsIndexed:false,gameplaySemanticsCertified:false,
 gameplayCompletionCertified:false});
const bitAt=(bytes,index)=>(parseInt(bytes[index>>3],16)&(1<<(index&7)))!==0;
function buildCompleteEventBitmap({
 romSha256,interactionAtlas,namedAtlas,eventFlagsHex,
 globalFlagReadback,romIdentityMatched=false,
 mapPositionVerified=false
}={}){
 const sha=String(romSha256||'').toLowerCase();
 if(!isKnownAuditedRomSha(sha)||romIdentityMatched!==true||
    mapPositionVerified!==true||
    interactionAtlas?.verified!==true||
    String(interactionAtlas.romSha256||'').toLowerCase()!==sha||
    namedAtlas?.verified!==true||namedAtlas.romSha256!==sha||
    namedAtlas.summary?.namedEventBits!==507||
    !Array.isArray(namedAtlas.events)||namedAtlas.events.length!==507||
    globalFlagReadback?.verified!==true||
    globalFlagReadback.worldEventBytesMatched!==320||
    globalFlagReadback.allFlagBytesMatched!==368||
    globalFlagReadback.romAndMapCorroborated!==true||
    globalFlagReadback.snapshotAtomicVerified!==false||
    pinned.sourceCommit!==REFERENCE_SHA||
    pinned.namedBitCount!==507||
    pinned.totalWEventFlagsBits!==2560||
    Object.keys(pinned.eventNamesByBit||{}).length!==507||
    !Array.isArray(eventFlagsHex)||eventFlagsHex.length!==320||
    eventFlagsHex.some(x=>typeof x!=='string'||!HEX.test(x)))
  return reject('Identidade ROM, 320 bytes RAM ou catálogo nomeado não corroborados');
 const named=new Map();
 for(const record of namedAtlas.events){
  const id=record?.eventBitIndex;
  if(!Number.isInteger(id)||id<0||id>=2560||
     typeof record.name!=='string'||typeof record.flagSet!=='boolean'||
     pinned.eventNamesByBit[id]!==record.name||
     bitAt(eventFlagsHex,id)!==record.flagSet||named.has(id))
   return reject('Flag nomeada difere da janela bruta D747 ou da referência');
  named.set(id,record.name);
 }
 if(named.size!==507)return reject('Cobertura de nomes incompleta');
 const catalogue=buildGlobalFlagOperationCatalogue({atlas:interactionAtlas});
 if(catalogue.verified!==true)
  return reject('Evidência do opcode ROM não validada: '+catalogue.reason);
 const byBit=new Map(),ensure=id=>{
  let row=byBit.get(id);
  if(!row){row={opcodes:[],actors:[],maps:new Set()};byBit.set(id,row)}
  return row;
 };
 for(const op of catalogue.operations){
  if(op.domain!=='WORLD_EVENT_BIT')continue;
  if(!Number.isInteger(op.bitIndex)||op.bitIndex<0||op.bitIndex>=2560||
     !['BIT_TEST','SET_BIT','RESET_BIT'].includes(op.operation)||
     !Number.isInteger(op.opcodeFileOffset)||op.opcodeFileOffset<0||
     !Array.isArray(op.invokedBy)||!op.invokedBy.length||
     op.instructionExecuted!==false)
   return reject('Operação física não comprovada');
  const row=ensure(op.bitIndex);
  row.opcodes.push({operation:op.operation,
   offset:op.opcodeFileOffset,executed:false});
  for(const actor of op.invokedBy){
   if(!Number.isInteger(actor?.mapId)||actor.mapId<0||actor.mapId>=248)
    return reject('Mapa do handler inválido');
   row.maps.add(actor.mapId);
  }
 }
 if(!Array.isArray(interactionAtlas.maps)||interactionAtlas.maps.length!==248)
  return reject('Atlas de interações sem os 248 mapas');
 for(const [id,map] of interactionAtlas.maps.entries()){
  if(map?.mapId!==id||!Array.isArray(map.interactions))
   return reject('Mapa de atores ROM inconsistente');
  for(const actor of map.interactions){
   if(actor?.eventBitBindingVerified!==true)continue;
   const bit=actor.eventBitIndex;
   if(!Number.isInteger(bit)||bit<0||bit>=2560||
      !Number.isInteger(actor.ordinal)||actor.ordinal<1||
      !Number.isInteger(actor.x)||actor.x<0||actor.x>255||
      !Number.isInteger(actor.y)||actor.y<0||actor.y>255||
      typeof actor.eventBitBindingSource!=='string'||!actor.eventBitBindingSource)
    return reject('Cabeçalho de ator sem índice ou coordenada ROM validada');
   const row=ensure(bit);
   row.actors.push({mapId:id,kind:actor.kind,ordinal:actor.ordinal,
    x:actor.x,y:actor.y,source:actor.eventBitBindingSource,
    executed:false});
   row.maps.add(id);
  }
 }
 const bits=[];
 let setBits=0,namedSet=0,anonymousWithRomEvidence=0;
 let bitsWithDirectRomEvidence=0;
 for(let bitIndex=0;bitIndex<2560;bitIndex++){
  const flagSet=bitAt(eventFlagsHex,bitIndex);
  const referenceName=named.get(bitIndex)||null;
  const rom=byBit.get(bitIndex),opcodes=rom?.opcodes||[],actors=rom?.actors||[];
  const direct=opcodes.length+actors.length>0;
  if(flagSet){setBits++;if(referenceName)namedSet++}
  if(direct)bitsWithDirectRomEvidence++;
  if(!referenceName&&direct)anonymousWithRomEvidence++;
  bits.push({
   bitIndex,flagSet,referenceName,
   nameComesFromRomBytes:false,
   referenceNameSource:referenceName?'pret/pokered':null,
   opcodeReferences:opcodes,
   actorHeaderReferences:actors,
   candidateMapIds:rom?[...rom.maps].sort((a,b)=>a-b):[],
   semanticMeaningVerified:false,
   actorInteractionObserved:false,
   completed:null,
   availableNow:null
  });
 }
 if(bits.length!==2560||named.size!==507||
    bits.filter(r=>r.referenceName!==null).length!==507||
    setBits!==bits.filter(x=>x.flagSet).length)
  return reject('O inventário perdeu bits RAM');
 return {
  verified:true,romSha256:sha,bits,
  summary:{
   bitPositionsIndexed:2560,ramBytesCorroborated:320,
   namedReferenceBits:507,unnamedOrReservedBits:2053,
   setBits,clearBits:2560-setBits,
   namedSetBits:namedSet,namedClearBits:507-namedSet,
   unnamedSetBits:setBits-namedSet,
   unnamedClearBits:2053-(setBits-namedSet),
   bitPositionsWithDirectRomEvidence:bitsWithDirectRomEvidence,
   unnamedBitPositionsWithDirectRomEvidence:anonymousWithRomEvidence,
   unnamedBitPositionsWithoutDirectRomEvidence:
    2053-anonymousWithRomEvidence
  },
  allBitPositionsIndexed:true,
  gameplaySemanticsCertified:false,gameplayCompletionCertified:false,
  snapshotAtomicVerified:false,playerActionsObserved:false,
  source:'D747_320_BYTES_CORROBORATED + ROM_OPCODE_AND_ACTOR_INDEX + PINNED_507_NAMES',
  warning:'Os 2053 bits sem nomes podem estar reservados ou ter significado desconhecido; nenhum bit prova execução ou conclusão'};
}
module.exports={buildCompleteEventBitmap};
