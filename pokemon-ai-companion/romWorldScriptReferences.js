'use strict';
// Full-world interaction-script entry index, from verified Gen I ROM bytes.
// Covers all 1,126 referenced map objects (NPC, trainer, pickup, static
// Pokemon and sign), without treating an entrypoint as understood behavior.
// Every script outcome, RAM requirement and effect is explicitly unverified.
const crypto=require('node:crypto');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {resolveStaticTextPointer}=require('./romTextPointerEvidence');
const {inspectTxAsmHandlerAdaptive}=require('./romTxAsmHandlerAtlas');
const {inspectFixedRom0TargetAdaptive}=require('./romFixedBankReferenceEvidence');
const {SPECIAL_SCRIPT_EVENTS,GUARDED_SPECIAL_BATTLES}=require('./romTrainerEvents');
const MAP_IDS=248,NORMAL_MAPS=226,EXPECTED_REFERENCES=1126;
const BY_KIND=Object.freeze({
 SIGN:'signs',NPC:'npcs',TRAINER:'trainers',
 ITEM:'visibleItems',STATIC_POKEMON:'stationaryPokemon'
});
const invalid=reason=>({verified:false,reason,maps:[],references:[],
  summary:null,scriptEffectsSemanticallyComplete:false});
function auditWorldScriptReferences({rom,profile}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576)
  return invalid('ROM de exatamente 1 MiB nao fornecida');
 const sha=crypto.createHash('sha256').update(rom).digest('hex');
 const maps=profile?.world?.maps;
 if(!isKnownAuditedRomSha(sha)||profile?.hash?.sha256?.toLowerCase()!==sha||
    profile?.unknownLayout===true||maps?.valid!==true||
    maps.validMapHeaders!==NORMAL_MAPS||!Array.isArray(maps.data)||
    maps.data.length!==MAP_IDS||
    maps.data.some((m,i)=>m?.mapId!==i||typeof m.valid!=='boolean')||
    maps.data.filter(m=>m.valid).length!==NORMAL_MAPS)
  return invalid('SHA exato, atlas de 248 IDs e 226 cabecalhos nao concordam');
 const all=[],world=[],bindingConflicts=[],
  byKind=Object.fromEntries(Object.keys(BY_KIND).map(x=>[x,0]));
 const commandCounts={},dispatchClassCounts={},unresolvedReasons={};
 const aggregateAsmCounts=(property)=>{
  const totals={};
  for(const graph of asmEntrypoints.values())
   for(const [kind,n] of Object.entries(graph[property]||{}))
    totals[kind]=(totals[kind]||0)+n;
  return totals;
 };
 const asmEntrypoints=new Map();
 let resolvedTextPointers=0,linearTextPrograms=0,nonLinearOrUnknown=0,
  martInventoryLists=0,mapScriptPointers=0,unresolvedMapIDs=0;
 const push=(map,kind,ordinal,x,y,rawTextId,actor)=>{
  const textId=kind==='SIGN'?rawTextId:(rawTextId&0x3f);
  const evidence=resolveStaticTextPointer({rom,mapBank:map.mapBank,
   textPointerCpu:map.textPointerCpu,textId});
  const textPointerVerified=evidence.verified===true;
  const command=textPointerVerified?evidence.command:'UNRESOLVED_TEXT_REFERENCE';
  if(textPointerVerified)resolvedTextPointers++;
  else{
   unresolvedReasons[evidence.reason||'UNKNOWN']=(unresolvedReasons[evidence.reason||'UNKNOWN']||0)+1;
  }
  commandCounts[command]=(commandCounts[command]||0)+1;
  const dispatchClass=textPointerVerified?evidence.dispatchClass:'UNRESOLVED';
  dispatchClassCounts[dispatchClass]=(dispatchClassCounts[dispatchClass]||0)+1;
  const preview=evidence.staticTextPreview?.verified===true?
    evidence.staticTextPreview:null;
  if(preview?.program?.verified===true&&preview.program.scriptComplete===true)
   linearTextPrograms++;
  if(command==='TX_START_ASM'||command==='UNRESOLVED_TEXT_REFERENCE'||
     command==='TEXT_OPCODE_UNCLASSIFIED')nonLinearOrUnknown++;
  if(evidence.mart?.verified===true)martInventoryLists++;
  let asmCandidate=null;
  if(textPointerVerified&&command==='TX_START_ASM'){
   const offset=evidence.textFileOffset;
   if(!asmEntrypoints.has(offset))
    asmEntrypoints.set(offset,inspectTxAsmHandlerAdaptive({rom,fileOffset:offset}));
   asmCandidate=asmEntrypoints.get(offset);
  }
  const trainer=kind==='TRAINER'?(map.trainerEvents||[]).find(
   row=>row.objectOrdinal===ordinal):null;
  const stationary=kind==='STATIC_POKEMON'?(map.staticEncounterEvents||[]).find(
   row=>row.objectOrdinal===ordinal):null;
  // Independently audited scripts complement the normal trainer header bits.
  // Do not infer effects or outcomes from the existence of a mapped bit.
  const special=kind==='TRAINER'?SPECIAL_SCRIPT_EVENTS[map.mapId]?.[ordinal]:null;
  const guarded=kind==='TRAINER'?GUARDED_SPECIAL_BATTLES[map.mapId]?.[ordinal]:null;
  const candidates=[trainer?.eventBitIndex,stationary?.eventBitIndex,
   special,guarded?.bit].filter(Number.isInteger);
  const bitIndex=candidates.length?candidates[0]:null;
  if(candidates.some(v=>v!==bitIndex||v<0||v>=2560)||
     (Number.isInteger(special)||guarded)&&(
      kind!=='TRAINER'||!Number.isInteger(actor.trainerClassOrItemId)||
      actor.trainerClassOrItemId<201)){
   bindingConflicts.push({mapId:map.mapId,ordinal,kind,candidates});
  }
  const flagSource=trainer?'ROM_TRAINER_HEADER':
   stationary?'ROM_STATIONARY_ENCOUNTER_HEADER':
   Number.isInteger(special)?'SHA_AUDITED_CHECKEVENT_SPECIAL':
   guarded?'SHA_AUDITED_GUARDED_BATTLE_SCRIPT':null;
  const flagMeaning=guarded?.kind==='SCRIPT_VICTORY'?
   'SCRIPT_VICTORY_FLAG_NOT_RUNTIME_VERIFIED':
   guarded?.kind==='BATTLE_WAS_PLAYED'?
   'BATTLE_WAS_PLAYED_FLAG_NOT_RUNTIME_VERIFIED':
   kind==='TRAINER'&&bitIndex!==null?'TRAINER_GATE_FLAG_ONLY':
   kind==='STATIC_POKEMON'&&bitIndex!==null?'ENCOUNTER_GATE_FLAG_ONLY':null;
  const row={
   mapId:map.mapId,kind,ordinal,x,y,rawTextId,textId,
   actorRomMetadata:kind==='ITEM'?{itemId:actor.trainerClassOrItemId??null}:
    kind==='TRAINER'?{trainerClassId:actor.trainerClassOrItemId??null,
      trainerNumber:actor.trainerNumberOrLevel??null}:
    kind==='STATIC_POKEMON'?{speciesInternalId:actor.wildSpeciesInternalId??null,
      level:actor.wildLevel??null}:null,
   textPointerVerified,scriptCommand:command,
   scriptDispatchClass:dispatchClass,
   scriptDispatchOpcodeVerified:evidence.dispatchOpcodePhysicallyVerified===true,
   scriptDispatchCodeSemanticsVerified:false,
   scriptDispatchOutcomeVerified:false,
   asmCandidate,
   asmDirectWramReadCandidates:asmCandidate?.directWramReadCandidateCount??0,
   asmDirectWramWriteCandidates:asmCandidate?.directWramWriteCandidateCount??0,
   asmWramPointerLiteralCandidates:asmCandidate?.wramPointerLiteralCount??0,
   asmMemoryEffectExecuted:false,
   scriptFileOffset:textPointerVerified?evidence.textFileOffset:null,
   textPointerCpu:textPointerVerified?evidence.textPointerCpu:null,
   indirectTextTarget:evidence.far?.verified===true?{
    fileOffset:evidence.far.fileOffset,bank:evidence.far.bank,cpu:evidence.far.cpu
   }:null,
   staticText:preview?{
    firstStringOnly:true,text:preview.text,
    runtimeVariables:preview.containsRuntimeVariables===true,
    linearProgramComplete:preview.program?.scriptComplete===true,
    literalSegmentCount:preview.program?.segmentCount??null
   }:null,
   martStaticItemIds:evidence.mart?.verified===true?
    evidence.mart.itemIds:null,
   eventBitIndex:bitIndex,
   eventBitBindingVerified:bitIndex!==null,
   eventBitBindingSource:flagSource,
   eventBitMeaning:flagMeaning,
   eventBitUnknownReason:kind==='TRAINER'&&bitIndex===null?
    'EVENT_BIT_NOT_PROVEN_FROM_ROM_SCRIPT_OR_TRAINER_HEADER':null,
   eventFlagSet:null,
   eventFlagSnapshotVerified:false,
   conditionsFullyDecoded:false,scriptEffectsVerified:false,
   effectBranchesVerified:false,interactionExecuted:false,
   accessibleNow:null,alreadyCompleted:null,
   unresolvedReason:textPointerVerified?null:(evidence.reason||'UNKNOWN'),
   source:'SHA_AUDITED_ROM_MAP_OBJECT_AND_TEXT_POINTER'
  };
  all.push(row);
  byKind[kind]++;
  return row;
 };
 for(const map of maps.data){
  if(!map.valid){
   unresolvedMapIDs++;
   world.push({mapId:map.mapId,verified:false,reason:'NO_NORMAL_MAP_HEADER',
    scriptPointerCpu:null,interactions:[]});
   continue;
  }
  const objects=map.objects;
  if(!Number.isInteger(map.mapBank)||map.mapBank<1||map.mapBank>=64||
     !Number.isInteger(map.scriptPointerCpu)||
     !Number.isInteger(map.textPointerCpu)||
     !objects||!Array.isArray(objects.objects)||!Array.isArray(objects.signs))
   return invalid('Cabecalho/objetos do mapa '+map.mapId+' incompletos');
  mapScriptPointers++;
  const interactions=[];
  for(let i=0;i<objects.signs.length;i++){
   const a=objects.signs[i];
   if(!Number.isInteger(a.textId)||a.textId<0||a.textId>255)
    return invalid('Text ID de sinal invalido no mapa '+map.mapId);
   interactions.push(push(map,'SIGN',i+1,a.x,a.y,a.textId,a));
  }
  for(let i=0;i<objects.objects.length;i++){
   const a=objects.objects[i];
   const kind={npc:'NPC',trainer:'TRAINER',item:'ITEM',
    wildPokemon:'STATIC_POKEMON'}[a.kind];
   if(!kind||!Number.isInteger(a.textId)||a.textId<0||a.textId>255)
    return invalid('Objeto ou Text ID invalido no mapa '+map.mapId);
   interactions.push(push(map,kind,i+1,a.x,a.y,a.textId,a));
  }
  world.push({mapId:map.mapId,verified:true,
   scriptPointerCpu:map.scriptPointerCpu,mapBank:map.mapBank,
   scriptEntrySemanticsVerified:false,interactions,
   conditionsFullyDecoded:false,scriptEffectsVerified:false});
 }
 // Classify all physically addressable ROM0 targets from deduplicated ASM
 // handlers, not only the first twelve samples. This is a separate candidate
 // scan and does NOT resolve the original branch's runtime meaning.
 const rom0Targets=new Map(),rom0BranchDistinct=new Set(),rom0CallDistinct=new Set();
 let rom0BranchOccurrences=0,rom0CallOccurrences=0;
 for(const graph of asmEntrypoints.values()){
  rom0BranchOccurrences+=graph.rom0BranchTargetOccurrences||0;
  rom0CallOccurrences+=graph.rom0CallTargetOccurrences||0;
  for(const pc of graph.rom0BranchTargetCpus||[]){
   rom0BranchDistinct.add(pc);
   if(!rom0Targets.has(pc))
    rom0Targets.set(pc,inspectFixedRom0TargetAdaptive({rom,targetCpu:pc}));
  }
  for(const pc of graph.rom0CallTargetCpus||[]){
   rom0CallDistinct.add(pc);
   if(!rom0Targets.has(pc))
    rom0Targets.set(pc,inspectFixedRom0TargetAdaptive({rom,targetCpu:pc}));
  }
 }
 // Link decoder diagnostics back to actual world object references.
 // These are static references, not proof an NPC/action executes the target.
 const targetOrigins=new Map();
 for(const row of all){
  if(row.scriptCommand!=='TX_START_ASM'||row.asmCandidate?.verified!==true)
   continue;
  const kinds=[['branch',row.asmCandidate.rom0BranchTargetCpus||[]],
               ['call',row.asmCandidate.rom0CallTargetCpus||[]]];
  for(const [kind,targetCpus] of kinds)
   for(const cpu of new Set(targetCpus)){
    if(!targetOrigins.has(cpu))targetOrigins.set(cpu,{
     maps:new Set(),handlers:new Set(),branchInteractionRefs:0,
     callInteractionRefs:0
    });
    const entry=targetOrigins.get(cpu);
    entry.maps.add(row.mapId);entry.handlers.add(row.scriptFileOffset);
    if(kind==='branch')entry.branchInteractionRefs++;
    else entry.callInteractionRefs++;
   }
 }
 const rom0Evidence=[...rom0Targets.values()].map(x=>{
  const origins=targetOrigins.get(x.targetCpu);
  return {...x,
   referencingMapIds:[...(origins?.maps||[])].sort((a,b)=>a-b),
   referencingAsmOffsets:[...(origins?.handlers||[])].sort((a,b)=>a-b),
   branchInteractionReferences:origins?.branchInteractionRefs||0,
   callInteractionReferences:origins?.callInteractionRefs||0};
 });
 // Deduplicate opcode addresses across roots: scanning a single JP HL
 // from several map objects must not fabricate several distinct tables.
 const distinctIndirectByPc=new Map();
 for(const candidate of rom0Evidence)
  for(const x of candidate.indirectJumpDetails||[]){
   const previous=distinctIndirectByPc.get(x.jumpPc);
   if(!previous||previous.kind==='UNCLASSIFIED_JP_HL')
    distinctIndirectByPc.set(x.jumpPc,x);
  }
 const indirectProofs=[...distinctIndirectByPc.values()];
 const unmappedTrainers=all.filter(x=>
  x.kind==='TRAINER'&&x.eventBitBindingVerified!==true);
 // These two exact unbound trainer scripts occur in all 3 audited ROMs.
 // A ship-departed flag and poster event cannot substitute battle gating.
 const expectedUnmapped=['96:2','135:11'];
 if(unmappedTrainers.length!==expectedUnmapped.length||
    unmappedTrainers.some(x=>!expectedUnmapped.includes(
     x.mapId+':'+x.ordinal)))
  return invalid('Trainer event binding candidates differ from original ROM: '+
   JSON.stringify(unmappedTrainers.map(x=>({
    mapId:x.mapId,ordinal:x.ordinal,reason:x.eventBitUnknownReason}))));
 if(bindingConflicts.length)
  return invalid('Conflito de bit entre cabecalho ROM e script especial: '+
   JSON.stringify(bindingConflicts.slice(0,8)));
 if(world.length!==MAP_IDS||mapScriptPointers!==NORMAL_MAPS||
    unresolvedMapIDs!==MAP_IDS-NORMAL_MAPS||all.length!==EXPECTED_REFERENCES||
    byKind.SIGN!==202||byKind.NPC!==472||byKind.TRAINER!==334||
    byKind.ITEM!==106||byKind.STATIC_POKEMON!==12)
  return invalid('Inventario de 1126 interacoes da ROM nao fecha');
 return {verified:true,romSha256:sha,maps:world,references:all,
  summary:{mapIds:MAP_IDS,normalMaps:NORMAL_MAPS,unresolvedMapIDs,
   mapScriptPointers,referencedInteractions:all.length,byKind,
   resolvedTextPointers,unresolvedTextPointers:all.length-resolvedTextPointers,
   linearTextPrograms,nonLinearOrUnknown,martInventoryLists,
   commandCounts,dispatchClassCounts,unresolvedReasons,
   trainerEventFlagBindings:all.filter(x=>
    x.kind==='TRAINER'&&x.eventBitBindingVerified).length,
   stationaryEventFlagBindings:all.filter(x=>
    x.kind==='STATIC_POKEMON'&&x.eventBitBindingVerified).length,
   specialTrainerEventFlagBindings:all.filter(x=>
    x.kind==='TRAINER'&&['SHA_AUDITED_CHECKEVENT_SPECIAL',
     'SHA_AUDITED_GUARDED_BATTLE_SCRIPT'].includes(x.eventBitBindingSource)).length,
   trainerEventFlagBindingsMissing:unmappedTrainers.length,
   trainerEventFlagBindingsUnresolved:unmappedTrainers.map(x=>({
    mapId:x.mapId,ordinal:x.ordinal,x:x.x,y:x.y,
    rawTextId:x.rawTextId,
    reason:x.eventBitUnknownReason,
    eventBitIndex:null,scriptEffectsVerified:false
   })),
   asmTextReferences:all.filter(x=>x.scriptCommand==='TX_START_ASM').length,
   uniqueAsmEntrypoints:asmEntrypoints.size,
   uniqueAsmMemoryOperandInstructions:[...asmEntrypoints.values()].reduce(
    (n,x)=>n+(x.absoluteMemoryOperandCount||0),0),
   uniqueAsmDirectWramReadCandidates:[...asmEntrypoints.values()].reduce(
    (n,x)=>n+(x.directWramReadCandidateCount||0),0),
   uniqueAsmDirectWramWriteCandidates:[...asmEntrypoints.values()].reduce(
    (n,x)=>n+(x.directWramWriteCandidateCount||0),0),
   uniqueAsmWramPointerLiterals:[...asmEntrypoints.values()].reduce(
    (n,x)=>n+(x.wramPointerLiteralCount||0),0),
   asmMemoryWritesExecuted:0,
   asmEntrypointsLocated:all.filter(x=>x.asmCandidate?.verified===true).length,
   uniqueAsmCandidateInstructions:[...asmEntrypoints.values()].reduce(
    (n,x)=>n+(x.opcodeCandidateCount||0),0),
   uniqueAsmCallsNotFollowed:[...asmEntrypoints.values()].reduce(
    (n,x)=>n+(x.callsNotFollowed||0),0),
   uniqueAsmUnresolvedTargets:[...asmEntrypoints.values()].reduce(
    (n,x)=>n+(x.unresolvedBranchTargets||0),0),
   uniqueAsmFirstPassLimitHits:[...asmEntrypoints.values()].filter(
    x=>x.firstPassLimitReached===true).length,
   uniqueAsmScanLimitHits:[...asmEntrypoints.values()].filter(
    x=>x.limitReached===true).length,
   uniqueAsmExpandedEntrypoints:[...asmEntrypoints.values()].filter(
    x=>x.candidateExpansionApplied===true).length,
   uniqueAsmAdditionalCandidateInstructions:[...asmEntrypoints.values()].reduce(
    (n,x)=>n+(x.additionalCandidateInstructions||0),0),
   uniqueAsmExpandedStillLimited:[...asmEntrypoints.values()].filter(
    x=>x.candidateExpansionApplied===true&&x.residualLimitReached===true).length,
   rom0BranchTargetOccurrences:rom0BranchOccurrences,
   distinctRom0BranchDestinations:rom0BranchDistinct.size,
   rom0CallTargetOccurrences:rom0CallOccurrences,
   distinctRom0CallDestinations:rom0CallDistinct.size,
   distinctRom0PhysicalTargets:rom0Targets.size,
   physicallyMappedRom0Targets:rom0Evidence.filter(x=>
    x.verified===true&&x.physicalRom0Mapped===true).length,
   rom0OpcodeCandidateInstructions:rom0Evidence.reduce(
    (n,x)=>n+(x.opcodeCandidateCount||0),0),
   rom0DecodeProblems:rom0Evidence.reduce(
    (n,x)=>n+(x.candidateDecodeProblems||0),0),
   rom0StillBudgetLimited:rom0Evidence.filter(x=>x.limitReached===true).length,
   rom0FirstPassLimitHits:rom0Evidence.filter(x=>x.firstPassLimitReached===true).length,
   rom0ExpandedTargets:rom0Evidence.filter(x=>x.candidateExpansionApplied===true).length,
   rom0AdditionalCandidateInstructions:rom0Evidence.reduce(
    (n,x)=>n+(x.additionalCandidateInstructions||0),0),
   rom0ExpandedStillLimited:rom0Evidence.filter(x=>
    x.candidateExpansionApplied===true&&x.residualLimitReached===true).length,
   rom0Intermediate128LimitHits:rom0Evidence.filter(x=>
    x.firstDeepPassLimitReached===true).length,
   rom0WholeBankPasses:rom0Evidence.filter(x=>x.thirdPassApplied===true).length,
   rom0ThirdPassAdditionalCandidateInstructions:rom0Evidence.reduce(
    (n,x)=>n+(x.thirdPassAdditionalCandidateInstructions||0),0),
   rom0WholeBankResidualLimits:rom0Evidence.filter(x=>
    x.thirdPassApplied===true&&x.residualLimitReached===true).length,
   rom0StaticCandidateWalkExhausted:rom0Evidence.filter(x=>
    x.fixedBankCandidateWalkExhausted===true).length,
   rom0EffectSemanticsCertified:0,
   rom0UniqueIndirectJumpInstructions:indirectProofs.length,
   rom0LiteralJumpTables:indirectProofs.filter(x=>
    x.kind==='GUARDED_ROM0_LITERAL_JUMP_TABLE').length,
   rom0LiteralJumpTableCandidateTargets:indirectProofs.reduce((n,x)=>
    n+(x.candidateTargetsCpu?.length||0),0),
   rom0HlReturnTrampolines:indirectProofs.filter(x=>
    x.kind==='PUSH_RETURN_AND_JUMP_RUNTIME_HL').length,
   rom0IndirectRuntimeTargetsVerified:0,
   rom0TargetsWithWorldOrigins:rom0Evidence.filter(x=>
    x.referencingMapIds.length>0&&x.referencingAsmOffsets.length>0).length,
   asmUnresolvedReasonCounts:aggregateAsmCounts('unresolvedReasonCounts'),
   asmUnfollowedCallClasses:aggregateAsmCounts('callClassCounts'),
   semanticallyCertifiedInteractionScripts:0,asmSemanticallyCertified:0},
  fixedRom0BranchEvidence:rom0Evidence,
  distinctRom0IndirectJumpEvidence:indirectProofs,
  rom0PhysicalAddressMappingCertified:rom0Evidence.every(x=>
   x.verified===true&&x.physicalRom0Mapped===true),
  allMapEntriesEnumerated:true,
  allScriptEffectsUnderstood:false,
  scriptEffectsSemanticallyComplete:false,
  runtimeFlagsVerified:false,
  warnings:['Uma referencia de texto/script nao demonstra o que o NPC faz',
   'O programa de texto linear pode terminar antes de ramificacoes de assembly',
   'A interpretacao de texto nao demonstra condicoes, acessibilidade ou efeito',
   'Mapas reservados e handlers bancados continuam por resolver',
   'A lista de loja e estaticamente extraida; compras nao sao confirmadas',
   'Enderecos WRAM diretos sao candidatos estaticos, nao prova de execucao'],
  source:'SHA_AUDITED_ROM_ALL_MAP_OBJECT_TEXT_REFERENCES'};
}
module.exports={auditWorldScriptReferences};
