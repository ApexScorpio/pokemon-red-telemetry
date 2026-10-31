'use strict';
// Index ALL physically decoded WRAM-bit operations from map ASM handlers,
// not just the 8 cross-object SET/TEST candidate links. Opcode presence is
// NOT evidence of executed behaviour, saved-state progress or causal effects.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {lookupRomReference}=require('./romReferenceSemantics');
const {inferBitOpcodeSemantics}=require('./romBitOpcodeSemantics');
const KINDS=new Set(['NPC','TRAINER','ITEM','STATIC_POKEMON','SIGN']);
const DOMAINS=Object.freeze({
 WORLD_EVENT_BIT:{bits:2560,base:0xd747},
 HIDDEN_ITEM_BIT:{bits:112,base:0xd6f0},
 HIDDEN_COIN_BIT:{bits:16,base:0xd6fe}
});
const OPS=new Set(['BIT_TEST','SET_BIT','RESET_BIT']);
const fail=reason=>({verified:false,reason,operations:[],perMap:[],
 totalPhysicallyDecodedOperations:0,executedOperationsCertified:0});
function buildGlobalFlagOperationCatalogue({atlas}={}){
 const sha=String(atlas?.romSha256||'').toLowerCase();
 if(atlas?.verified!==true||!isKnownAuditedRomSha(sha)||
    atlas?.summary?.referencedInteractions!==1126||
    !Array.isArray(atlas?.maps)||atlas.maps.length!==248)
  return fail('ROM or complete 248-map interaction atlas not verified');
 if(atlas.maps.some((m,id)=>m?.mapId!==id||
     !Array.isArray(m.interactions)))return fail('Map interaction order invalid');
 const all=atlas.maps.flatMap(m=>m.interactions);
 if(all.length!==1126)return fail('Expected 1126 ROM object references');
 const byPhysical=new Map(),mapIndexes=Array.from({length:248},(_,mapId)=>({
  mapId,operationReferences:0,uniquePhysicalOperationIds:new Set(),actors:new Set()
 }));
 const seenActorPatterns=new Set(),seenHandlers=new Set();
 const handlerOperations={BIT_TEST:0,SET_BIT:0,RESET_BIT:0};
 let references=0,asmReferences=0,handlerBranches=0,handlerDualTexts=0;
 for(const row of all){
  if(!Number.isInteger(row?.mapId)||row.mapId<0||row.mapId>=248||
     !Number.isInteger(row?.ordinal)||row.ordinal<=0||
     !KINDS.has(row.kind)||row.asmMemoryEffectExecuted!==false)
   return fail('Actor metadata not ROM-verified');
  if(row.scriptCommand!=='TX_START_ASM')continue;
  asmReferences++;
  const handler=row.asmCandidate;
  if(handler?.verified!==true||
     handler.txAsmFileOffset!==row.scriptFileOffset||
     !Array.isArray(handler.adjacentRomFlagBitPatterns)||
     handler.adjacentRomFlagBitInstructionsExecuted!==false)
   return fail('ASM handler operation evidence malformed');
  const actorKey=row.mapId+':'+row.kind+':'+row.ordinal;
  const newHandler=!seenHandlers.has(row.scriptFileOffset);
  for(const p of handler.adjacentRomFlagBitPatterns){
   if(!OPS.has(p.operation)||!Object.hasOwn(DOMAINS,p.domain)||
      !Number.isInteger(p.bitIndex)||p.bitIndex<0||
      p.bitIndex>=DOMAINS[p.domain].bits||
      !Number.isInteger(p.offset)||p.offset<0||p.offset>=1048576||
      !Number.isInteger(p.secondOffset)||p.secondOffset!==p.offset+3||
      !Number.isInteger(p.bank)||p.bank<0||p.bank>=64||
      !Number.isInteger(p.cpu)||p.cpu<0||p.cpu>=0x8000||
      p.offset!==(p.cpu<0x4000?p.cpu:
       p.bank*0x4000+p.cpu-0x4000)||
      !Number.isInteger(p.address)||
      p.address!==DOMAINS[p.domain].base+Math.floor(p.bitIndex/8)||
      !Number.isInteger(p.bitNumber)||p.bitNumber!==p.bitIndex%8||
      p.secondOpcode!==0xcb||
      !Number.isInteger(p.cbOpcode)||
      (p.operation==='BIT_TEST'?
       p.cbOpcode<0x40||p.cbOpcode>=0x80:
       p.operation==='SET_BIT'?
        p.cbOpcode<0xc0:p.cbOpcode<0x80||p.cbOpcode>=0xc0)||
      ![0xfa,0x21].includes(p.firstOpcode)||
      (p.operation!=='BIT_TEST'&&p.firstOpcode!==0x21)||
      (p.cbOpcode&7)!==(p.firstOpcode===0xfa?7:6)||
      ((p.cbOpcode>>3)&7)!==p.bitNumber||
      p.operandsAndAdjacencyVerified!==true||
      p.instructionSequenceExecuted!==false||
      p.eventBitValueKnown!==false||p.eventOutcomeCertified!==false)
    return fail('Physical flag opcode insufficiently verified');
   if(newHandler){
    handlerOperations[p.operation]++;
    if(p.operation==='BIT_TEST'&&p.staticConditionalBranch?.verified===true)
     handlerBranches++;
    if(p.staticDualTextChoice?.alternativeTextScriptsStaticallyProven===true)
     handlerDualTexts++;
   }
   const key=p.offset+':'+p.secondOffset+':'+p.operation;
   const actorPatternKey=key+':'+actorKey;
   if(seenActorPatterns.has(actorPatternKey))
    return fail('Same actor operation duplicate');
   seenActorPatterns.add(actorPatternKey);
   references++;
   const map=mapIndexes[row.mapId];
   map.operationReferences++;
   map.uniquePhysicalOperationIds.add(key);
   map.actors.add(actorKey);
   let entry=byPhysical.get(key);
   if(!entry){
    const label=p.domain==='WORLD_EVENT_BIT'?
      lookupRomReference({romSha256:sha,mapId:row.mapId,
       eventBitIndex:p.bitIndex}):null;
    if(label&&label.verified!==true)
     return fail('Pinned external event reference invalid');
    const gate=p.staticConditionalBranch?.verified===true?
      p.staticConditionalBranch:null;
    if(gate&&gate.branchActuallyTaken!==null)
     return fail('Static branch falsely marked executed');
    const dual=p.staticDualTextChoice?.verified===true?
      p.staticDualTextChoice:null;
    const semantics=inferBitOpcodeSemantics({
     operation:p.operation,bitNumber:p.bitNumber,
     register:p.firstOpcode===0xfa?'A':'HL_INDIRECT',
     operandAddress:p.address,bitIndex:p.bitIndex,cbOpcode:p.cbOpcode
    });
    if(semantics.verified!==true||
       semantics.instructionActuallyExecuted!==false||
       semantics.scriptRewardVerified!==false)
     return fail('LR35902 conditional semantics not provable: '+semantics.reason);
    entry={
     physicalOperationId:key,opcodeFileOffset:p.offset,
     bitInstructionFileOffset:p.secondOffset,
     romBank:p.bank,romCpu:p.cpu,
     domain:p.domain,bitIndex:p.bitIndex,
     operandAddress:p.address,bitNumber:p.bitNumber,
     operation:p.operation,
     ifExecuted:semantics,
     externalEventLabel:label?.referenceEventName||null,
     externalLabelSource:label?'pret/pokered':null,
     labelIntrinsicToRom:false,
     conditionalBranch:gate,dualTextChoice:dual,
     invokedBy:[],bitValueInCurrentSave:null,
     instructionExecuted:false,causalEffectVerified:false,
     source:'ROM_PHYSICAL_LR35902_PAIR_FROM_MAP_SCRIPT'
    };
    byPhysical.set(key,entry);
   }else if(entry.domain!==p.domain||
       entry.bitIndex!==p.bitIndex||entry.operation!==p.operation||
       entry.operandAddress!==p.address)
    return fail('Conflicting reference to identical physical ROM opcode');
   entry.invokedBy.push({mapId:row.mapId,kind:row.kind,
    ordinal:row.ordinal,asmHandlerFileOffset:row.scriptFileOffset,
    actorId:actorKey,
    scriptExecuted:false,interactionEffectVerified:false});
  }
  seenHandlers.add(row.scriptFileOffset);
 }
 const operations=[...byPhysical.values()].sort((a,b)=>
  a.opcodeFileOffset-b.opcodeFileOffset||
  a.bitInstructionFileOffset-b.bitInstructionFileOffset||
  a.operation.localeCompare(b.operation));
 const counts={
  BIT_TEST:operations.filter(x=>x.operation==='BIT_TEST').length,
  SET_BIT:operations.filter(x=>x.operation==='SET_BIT').length,
  RESET_BIT:operations.filter(x=>x.operation==='RESET_BIT').length
 };
 const s=atlas.summary;
 if(asmReferences!==626||seenHandlers.size!==516||
    handlerOperations.BIT_TEST!==90||
    handlerOperations.SET_BIT!==41||handlerOperations.RESET_BIT!==4||
    s.uniqueAsmFlagBitTestCandidates!==90||
    s.uniqueAsmFlagBitSetCandidates!==41||
    s.uniqueAsmFlagBitResetCandidates!==4)
  return fail('Handler-scoped operation evidence differs from audited ROM');
 const branches=operations.filter(x=>
  x.operation==='BIT_TEST'&&x.conditionalBranch?.verified===true).length;
 const textChoices=operations.filter(x=>
  x.dualTextChoice?.alternativeTextScriptsStaticallyProven===true).length;
 if(handlerBranches!==88||handlerDualTexts!==16||
    s.uniqueAsmFlagConditionalBranchGates!==88||
    s.uniqueAsmFlagDualTextAlternatives!==16)
  return fail('Handler-scoped branch or alternative-text counts mismatch');
 const perMap=mapIndexes.map(row=>({
  mapId:row.mapId,operationReferences:row.operationReferences,
  uniquePhysicalOperationCount:row.uniquePhysicalOperationIds.size,
  actorCount:row.actors.size
 }));
 return {verified:true,romSha256:sha,operations,perMap,
  totalPhysicallyDecodedOperations:operations.length,
  totalHandlerScopedOperations:135,
  operationReferences:references,
  distinctHandlerRefs:seenHandlers.size,asmActorReferences:asmReferences,
  operationCounts:counts,handlerScopedOperationCounts:handlerOperations,
  conditionalBitBranches:branches,dualTextChoices:textChoices,
  handlerScopedBitBranches:handlerBranches,
  handlerScopedDualTextChoices:handlerDualTexts,
  conditionalMemoryWritesIfExecuted:operations.filter(x=>
   x.ifExecuted.memoryBitWriteIfExecuted===true).length,
  handlerScopedWritesIfExecuted:handlerOperations.SET_BIT+
   handlerOperations.RESET_BIT,
  unconditionalGameplayEffectsCertified:0,
  mapsWithBitOperations:perMap.filter(x=>x.operationReferences>0).length,
  eventNamedOperations:operations.filter(x=>
   x.domain==='WORLD_EVENT_BIT'&&x.externalEventLabel!==null).length,
  executedOperationsCertified:0,causalEffectsCertified:0,
  currentFlagValuesKnown:false,
  note:'Every operation is a ROM opcode candidate; no save RAM read, branch taken, dialogue shown or reward proved'};
}
function getMapFlagOperationCandidates({atlas,mapId}={}){
 if(!Number.isInteger(mapId)||mapId<0||mapId>=248)
  return {verified:false,mapId,reason:'Map ID out of range',operations:[]};
 const world=buildGlobalFlagOperationCatalogue({atlas});
 if(world.verified!==true)
  return {verified:false,mapId,reason:world.reason,operations:[]};
 const operations=world.operations.flatMap(op=>
  op.invokedBy.filter(actor=>actor.mapId===mapId).map(actor=>({
   physicalOperationId:op.physicalOperationId,
   opcodeFileOffset:op.opcodeFileOffset,
   bitInstructionFileOffset:op.bitInstructionFileOffset,
   domain:op.domain,bitIndex:op.bitIndex,operation:op.operation,
   ifExecuted:op.ifExecuted,
   externalEventLabel:op.externalEventLabel,
   externalLabelSource:op.externalLabelSource,
   labelIntrinsicToRom:false,
   actorKind:actor.kind,actorOrdinal:actor.ordinal,
   actorId:actor.actorId,asmHandlerFileOffset:actor.asmHandlerFileOffset,
   conditionalBranch:op.conditionalBranch,
   dualTextChoice:op.dualTextChoice,
   instructionExecuted:false,causalEffectVerified:false,
   bitValueInCurrentSave:null,
   interactionEffectVerified:false
  })));
 return {verified:true,mapId,romSha256:world.romSha256,operations,
  operationReferences:operations.length,
  worldUniquePhysicalOperations:world.totalPhysicallyDecodedOperations,
  worldHandlerScopedOperations:world.totalHandlerScopedOperations,
  worldActorOperationReferences:world.operationReferences,
  worldMapsWithOperations:world.mapsWithBitOperations,
  currentProgressKnown:false,eventsExecutedVerified:0,
  source:'ROM_STATIC_GLOBAL_FLAG_OPERATIONS'};
}
module.exports={buildGlobalFlagOperationCatalogue,getMapFlagOperationCandidates};
