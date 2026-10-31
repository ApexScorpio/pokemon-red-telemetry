'use strict';
// Per-map candidate bindings between 507 pinned event names, ROM actor/handler
// evidence, and independently corroborated RAM flag bits. A script reference
// is not proof the action happens here, is accessible, or has executed.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const refuse=reason=>({verified:false,reason,events:[],summary:null,
  actionsObserved:false,gameplayCompletionCertified:false});
const goodMap=n=>Number.isInteger(n)&&n>=0&&n<248;
function buildMapNamedEventEvidence({ledger,worldEventAtlas,mapId}={}){
 const sha=String(ledger?.romSha256||'').toLowerCase();
 if(!goodMap(mapId)||ledger?.verified!==true||
    !isKnownAuditedRomSha(sha)||
    worldEventAtlas?.verified!==true||
    String(worldEventAtlas.romSha256||'').toLowerCase()!==sha||
    ledger.summary?.namedReferenceEvents!==507||
    worldEventAtlas.summary?.namedEventBits!==507||
    !Array.isArray(ledger.flags)||ledger.flags.length!==507||
    !Array.isArray(worldEventAtlas.events)||worldEventAtlas.events.length!==507)
  return refuse('ROM, mapa, catálogo de 507 eventos ou flags RAM não corroborados');
 const byBit=new Map();
 for(const row of worldEventAtlas.events){
  if(!Number.isInteger(row?.eventBitIndex)||row.eventBitIndex<0||
     row.eventBitIndex>=2560||typeof row.name!=='string'||
     typeof row.flagSet!=='boolean'||byBit.has(row.eventBitIndex))
   return refuse('Identificador de bit duplicado ou sem leitura RAM');
  byBit.set(row.eventBitIndex,row);
 }
 const events=[];
 const allNames=new Set();
 for(const row of ledger.flags){
  if(!Number.isInteger(row?.bitIndex)||row.bitIndex<0||row.bitIndex>=2560||
     typeof row.referenceEventName!=='string'||
     allNames.has(row.bitIndex))
   return refuse('Índice de evento ROM duplicado ou inválido');
  allNames.add(row.bitIndex);
  const live=byBit.get(row.bitIndex);
  if(!live||live.name!==row.referenceEventName)
   return refuse('Os nomes de evento não coincidem com os bits RAM');
  if(!Array.isArray(row.boundActorReferences)||
     !Array.isArray(row.readerPhysicalOpcodes)||
     !Array.isArray(row.writerSetPhysicalOpcodes)||
     !Array.isArray(row.writerResetPhysicalOpcodes))
   return refuse('Provas de atores/handlers ROM incompletas');
  const actors=[];
  for(const actor of row.boundActorReferences){
   if(!goodMap(actor?.mapId)||!Number.isInteger(actor.ordinal)||
      actor.ordinal<1||typeof actor.kind!=='string')
    return refuse('Associação a ator ROM malformada');
   if(actor.mapId===mapId)actors.push({
    kind:actor.kind,ordinal:actor.ordinal,
    scriptExecuted:false,bitBindingEvidence:actor.bitBindingEvidence
   });
  }
  const physical=[];
  for(const op of [...row.readerPhysicalOpcodes,
      ...row.writerSetPhysicalOpcodes,...row.writerResetPhysicalOpcodes]){
   if(!Array.isArray(op?.referencedMaps)||
      op.referencedMaps.some(id=>!goodMap(id))||
      !Number.isInteger(op.opcodeFileOffset)||op.opcodeFileOffset<0)
    return refuse('Evidência de opcode ROM com mapa desconhecido');
   if(op.referencedMaps.includes(mapId))physical.push({
    operation:op.operation,opcodeFileOffset:op.opcodeFileOffset,
    instructionExecuted:false,gameplayEffectVerified:false
   });
  }
  if(!actors.length&&!physical.length)continue;
  events.push({
   name:row.referenceEventName,eventBitIndex:row.bitIndex,
   flagSet:live.flagSet,
   localEvidence:actors.length&&physical.length?'ACTOR_AND_OPCODE':
     actors.length?'ACTOR_HEADER_ONLY':'OPCODE_HANDLER_ONLY',
   actorReferences:actors,romOpcodeReferences:physical,
   exactEventLocationProven:false,scriptExecuted:false,
   eventCompleted:false,playerActionConfirmed:false,
   resultOrRewardCertified:false
  });
 }
 if(allNames.size!==507||byBit.size!==507)
  return refuse('Catálogo 507/507 incompleto');
 events.sort((a,b)=>a.eventBitIndex-b.eventBitIndex);
 return {verified:true,mapId,romSha256:sha,events,
  summary:{
   namedReferenceEvents:507,
   mapEventBitCandidates:events.length,
   flagsSet:events.filter(e=>e.flagSet).length,
   flagsClear:events.filter(e=>!e.flagSet).length,
   actorBound:events.filter(e=>e.actorReferences.length>0).length,
   opcodeBound:events.filter(e=>e.romOpcodeReferences.length>0).length
  },
  actionsObserved:false,gameplayCompletionCertified:false,
  source:'AUDITED_ROM_MAP_ACTOR_OR_HANDLER + PINNED_EVENT_NAMES + REPEATED_RAM',
  warning:'Associação a ator/handler não é o local exato do evento, não prova acesso, interação, recompensa ou conclusão'};
}
module.exports={buildMapNamedEventEvidence};
