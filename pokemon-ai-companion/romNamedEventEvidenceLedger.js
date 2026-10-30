'use strict';
// Map the 507 named Gen I event bits to exact ROM operation candidates and
// actor/header bindings. A name is NOT a resolved script or a completed event.
// This is a coverage ledger, not a percentage of campaign completion.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {buildGlobalFlagOperationCatalogue}=require('./romGlobalFlagOperationCatalogue');
const names=require('./data/gen1EventNamesPret.json');
const fail=reason=>({verified:false,reason,flags:[],summary:null,
 semanticallyComplete:false});
const KINDS=new Set(['NPC','SIGN','TRAINER','ITEM','STATIC_POKEMON']);
function buildNamedEventEvidenceLedger({atlas}={}){
 const sha=String(atlas?.romSha256||'').toLowerCase();
 if(atlas?.verified!==true||!isKnownAuditedRomSha(sha)||
    !Array.isArray(atlas.maps)||atlas.maps.length!==248||
    atlas.summary?.referencedInteractions!==1126||
    names?.sourceCommit!=='171e2c204f9c1ff8e577ca387a4bbb009e130843'||
    names.namedBitCount!==507||names.totalWEventFlagsBits!==2560||
    Object.keys(names.eventNamesByBit||{}).length!==507)
  return fail('ROM atlas or pinned event constants are unverified');
 const catalogue=buildGlobalFlagOperationCatalogue({atlas});
 if(catalogue.verified!==true)
  return fail('Physical opcode catalogue incomplete: '+catalogue.reason);
 const flags=Object.entries(names.eventNamesByBit).map(([index,name])=>({
  bitIndex:Number(index),referenceEventName:name,
  source:'pret/pokered',nameIntrinsicToRom:false,
  readerPhysicalOpcodes:[],writerSetPhysicalOpcodes:[],
  writerResetPhysicalOpcodes:[],boundActorReferences:[],
  gameFlagSetInCurrentSave:null,
  eventActuallyTriggered:null,eventCompleted:null,
  semanticCausalChainCertified:false
 })).sort((a,b)=>a.bitIndex-b.bitIndex);
 const index=new Map(flags.map(x=>[x.bitIndex,x]));
 if(index.size!==507||flags.some(x=>!Number.isInteger(x.bitIndex)||
    x.bitIndex<0||x.bitIndex>=2560||
    !/^EVENT_[A-Z0-9_]+$/.test(x.referenceEventName)))
  return fail('Invalid external event-name index');
 for(const op of catalogue.operations){
  if(op.domain!=='WORLD_EVENT_BIT')continue;
  const row=index.get(op.bitIndex);
  if(!row)continue; // Unnamed ROM events retain no invented name.
  if(op.externalEventLabel!==row.referenceEventName||
     op.externalLabelSource!=='pret/pokered'||
     op.instructionExecuted!==false||
     op.ifExecuted?.verified!==true)
   return fail('Literal ROM opcode and event reference disagree');
  const origin={
   physicalOperationId:op.physicalOperationId,
   opcodeFileOffset:op.opcodeFileOffset,
   operation:op.operation,
   evidenceIfExecuted:op.ifExecuted.effectIfInstructionExecuted,
   referencedMaps:[...new Set(op.invokedBy.map(a=>a.mapId))].sort((a,b)=>a-b),
   actorCount:op.invokedBy.length,
   instructionExecuted:false,gameplayEffectVerified:false
  };
  if(op.operation==='BIT_TEST')row.readerPhysicalOpcodes.push(origin);
  else if(op.operation==='SET_BIT')row.writerSetPhysicalOpcodes.push(origin);
  else if(op.operation==='RESET_BIT')row.writerResetPhysicalOpcodes.push(origin);
  else return fail('Unsupported event bit opcode');
 }
 let boundActorCount=0;
 for(const [mapId,map] of atlas.maps.entries()){
  if(map?.mapId!==mapId||!Array.isArray(map.interactions))
   return fail('Invalid compact world map data');
  for(const actor of map.interactions){
   if(actor?.eventBitBindingVerified!==true)continue;
   if(!Number.isInteger(actor.eventBitIndex)||
      actor.eventBitIndex<0||actor.eventBitIndex>=2560||
      !KINDS.has(actor.kind)||!Number.isInteger(actor.ordinal)||
      actor.ordinal<1||actor.mapId!==mapId||
      typeof actor.eventBitBindingSource!=='string'||
      !actor.eventBitBindingSource.length)
    return fail('Invalid ROM object/header event-bit association');
   const row=index.get(actor.eventBitIndex);
   if(!row)continue;
   boundActorCount++;
   row.boundActorReferences.push({
    mapId,kind:actor.kind,ordinal:actor.ordinal,
    bitBindingEvidence:actor.eventBitBindingSource,
    scriptExecuted:false,eventCompleted:null,
    actorCompletionVerified:false
   });
  }
 }
 const reasonCounts={
  BOTH_OPCODE_AND_HEADER:0,ROM_OPCODE_ONLY:0,
  HEADER_BINDING_ONLY:0,NO_DIRECT_EVIDENCE:0
 };
 for(const row of flags){
  row.readerPhysicalOpcodes.sort((a,b)=>a.opcodeFileOffset-b.opcodeFileOffset);
  row.writerSetPhysicalOpcodes.sort((a,b)=>a.opcodeFileOffset-b.opcodeFileOffset);
  row.writerResetPhysicalOpcodes.sort((a,b)=>a.opcodeFileOffset-b.opcodeFileOffset);
  row.boundActorReferences.sort((a,b)=>a.mapId-b.mapId||
    a.ordinal-b.ordinal);
  const codeCount=row.readerPhysicalOpcodes.length+
   row.writerSetPhysicalOpcodes.length+row.writerResetPhysicalOpcodes.length;
  const boundCount=row.boundActorReferences.length;
  const category=codeCount>0&&boundCount>0?'BOTH_OPCODE_AND_HEADER':
   codeCount>0?'ROM_OPCODE_ONLY':
   boundCount>0?'HEADER_BINDING_ONLY':'NO_DIRECT_EVIDENCE';
  row.evidenceCategory=category;reasonCounts[category]++;
  row.romOpcodeCount=codeCount;
  row.romHeaderActorCount=boundCount;
  row.fullScriptCausalityVerified=false;
  row.conditionalInstructionEffectsProven=codeCount>0;
  row.actualGameplayOutcomeProven=false;
 }
 const withOpcodes=reasonCounts.BOTH_OPCODE_AND_HEADER+
  reasonCounts.ROM_OPCODE_ONLY;
 const withHeader=reasonCounts.BOTH_OPCODE_AND_HEADER+
  reasonCounts.HEADER_BINDING_ONLY;
 const noEvidence=reasonCounts.NO_DIRECT_EVIDENCE;
 if(Object.values(reasonCounts).reduce((n,x)=>n+x,0)!==507||
    withOpcodes+reasonCounts.HEADER_BINDING_ONLY+noEvidence!==507)
  return fail('Named event coverage categories incomplete');
 // Exact, reproducible engineering backlog. These are reference labels
 // lacking *direct ROM evidence*, not uncompleted gameplay events.
 const noDirectEvidenceFlags=flags.filter(x=>
  x.evidenceCategory==='NO_DIRECT_EVIDENCE').map(x=>({
   bitIndex:x.bitIndex,referenceEventName:x.referenceEventName,
   romOpcodeCount:0,romHeaderActorCount:0,
   eventCompleted:null,source:'pret/pokered'
  }));
 const headerOnlyFlags=flags.filter(x=>
  x.evidenceCategory==='HEADER_BINDING_ONLY').map(x=>({
   bitIndex:x.bitIndex,referenceEventName:x.referenceEventName,
   romOpcodeCount:0,romHeaderActorCount:x.romHeaderActorCount,
   eventCompleted:null,source:'pret/pokered'
  }));
 if(noDirectEvidenceFlags.length!==noEvidence||
    headerOnlyFlags.length!==reasonCounts.HEADER_BINDING_ONLY||
    noDirectEvidenceFlags.some(x=>x.eventCompleted!==null)||
    headerOnlyFlags.some(x=>x.eventCompleted!==null))
  return fail('Reference flag evidence gap ledger inconsistent');
 return {verified:true,romSha256:sha,flags,
  unresolvedNamedFlagEvidence:{
   noDirectEvidenceFlags,headerOnlyFlags,
   noDirectEvidenceCount:noDirectEvidenceFlags.length,
   headerOnlyCount:headerOnlyFlags.length,
   gameplayCompletionEvidence:false,
   source:'PINNED_EXTERNAL_EVENT_LABELS_NO_DIRECT_ROM_EVIDENCE'
  },
  summary:{totalEventFlagBitSlots:2560,namedReferenceEvents:507,
   unnamedOrReservedBitSlots:2053,
   namedBitsWithRomOpcode:withOpcodes,
   namedBitsWithActorHeaderBinding:withHeader,
   namedBitsWithoutAnyDirectEvidence:noEvidence,
   namedActorHeaderReferences:boundActorCount,
   physicalRomFlagOperations:catalogue.totalPhysicallyDecodedOperations,
   physicalEventOpReferencesToNamedFlags:flags.reduce((n,x)=>
    n+x.romOpcodeCount,0),
   categories:reasonCounts,
   fullyExplainedNamedEvents:0,
   eventCompletionsObserved:0},
  referenceSource:'pret/pokered',
  flagsCurrentValuesObserved:false,
  semanticallyComplete:false,
  campaignProgressVerified:false,
  note:'507 labels do not mean 507 events mapped; ROM event opcode and header references are partial static evidence only'};
}
module.exports={buildNamedEventEvidenceLedger};
