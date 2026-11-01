'use strict';
// World-wide, ROM-anchored intermediate representation for Gen I interactions.
// This is a universal compiler over every map object, NOT a claim that NPC
// code, events or RAM effects were observed. Source of text opcode behavior:
// pret/pokered@171e2c204f9c1ff8e577ca387a4bbb009e130843,
// home/text.asm, home/text_script.asm and macros/scripts/text.asm.
const crypto=require('node:crypto');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {decodeRomTextProgram}=require('./romTextScriptDecoder');
const EXPECTED_REFS=1126;
const KINDS=new Set(['SIGN','NPC','TRAINER','ITEM','STATIC_POKEMON']);
const PRESENTATION_COMMANDS=new Set([
 'TX_START','TX_RAM','TX_BCD','TX_MOVE','TX_BOX','TX_LOW',
 'TX_PROMPT_BUTTON','TX_SCROLL','TX_NUM','TX_PAUSE',
 'TX_SOUND_GET_ITEM_1','TX_DOTS','TX_WAIT_BUTTON',
 'TX_SOUND_POKEDEX_RATING','TX_SOUND_GET_ITEM_1_DUPLICATE',
 'TX_SOUND_GET_ITEM_2','TX_SOUND_GET_KEY_ITEM',
 'TX_SOUND_CAUGHT_MON','TX_SOUND_DEX_PAGE_ADDED',
 'TX_SOUND_CRY_NIDORINA','TX_SOUND_CRY_PIDGEOT',
 'TX_SOUND_CRY_DEWGONG'
]);
function fail(reason){
 return {verified:false,reason,rows:[],groups:[],summary:null,
  fullScriptSemanticsCertified:false,liveGameplayObserved:false};
}
function compileOne({rom,reference}={}){
 const r=reference;
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    !r||!Number.isInteger(r.mapId)||r.mapId<0||r.mapId>=248||
    !KINDS.has(r.kind)||!Number.isInteger(r.ordinal)||r.ordinal<1||
    !Number.isInteger(r.scriptFileOffset)||r.scriptFileOffset<0||
    r.scriptFileOffset>=rom.length||
    r.textPointerVerified!==true||
    typeof r.scriptCommand!=='string')
   return {verified:false,reason:'Map interaction or ROM pointer not authenticated'};
 const out={
  verified:true,mapId:r.mapId,kind:r.kind,ordinal:r.ordinal,
  x:r.x,y:r.y,scriptFileOffset:r.scriptFileOffset,
  scriptCommand:r.scriptCommand,programClass:'UNCLASSIFIED_EFFECTS',
  semanticScope:'NONE',
  textProcessorCommandsVerified:false,
  conditionalServiceHandlerVerified:false,
  asmEntrypointIdentified:false,
  eventBitIndex:r.eventBitBindingVerified===true?r.eventBitIndex:null,
  eventBitIsOnlyAGateCandidate:r.eventBitBindingVerified===true,
  gameplayEffectsFullyInterpreted:false,
  mapScriptConditionsFullyInterpreted:false,
  observedExecution:false,
  eventCompleted:null,accessibleNow:null,
  limitations:['MAP_SCRIPT_CONTROL_FLOW_UNVERIFIED','LIVE_EXECUTION_UNOBSERVED']
 };
 if(r.scriptCommand==='TX_FAR'){
  if(rom[r.scriptFileOffset]!==0x17)
   return {...out,programClass:'FAR_DISPATCH_BYTE_MISMATCH'};
  const target=r.indirectTextTarget;
  if(!Number.isInteger(target?.fileOffset)||
      target.fileOffset<0||target.fileOffset>=rom.length)
   return {...out,programClass:'FAR_TARGET_NOT_RESOLVED'};
  const decoded=decodeRomTextProgram({rom,offset:target.fileOffset});
  if(decoded.verified!==true||decoded.scriptComplete!==true||
     !decoded.commands.every(c=>PRESENTATION_COMMANDS.has(c)))
   return {...out,programClass:'FAR_TEXT_NOT_LINEARLY_INTERPRETED',
    textProgramReason:decoded.reason||'Nonlinear text command'};
  return {...out,programClass:'LINEAR_PRESENTATION_TEXT',
   semanticScope:'TEXT_COMMAND_PROCESSOR_ONLY',
   textProcessorCommandsVerified:true,
   textTargetFileOffset:target.fileOffset,
   textTermination:decoded.termination,
   textCommandCount:decoded.commandCount,
   textCommands:decoded.commands,
   containsRuntimeText:decoded.containsRuntimeText,
   containsRuntimeRenderingCommands:decoded.containsRuntimeCommands,
   // These commands control the text box, read strings/numbers or play
   // sounds. Their opcode handlers do not mutate wEventFlags. The map's
   // surrounding scripts can still change progression and are NOT proven.
   gameEventBitWriteByTextOpcodes:false,
   limitations:['SURROUNDING_MAP_SCRIPT_EFFECTS_UNKNOWN','LIVE_EXECUTION_UNOBSERVED']};
 }
 if(r.scriptCommand.startsWith('SCRIPT_')){
  const d=r.specialDispatchReference;
  if(d?.verified!==true||d.scriptFileOffset!==r.scriptFileOffset||
      d.opcode!==rom[r.scriptFileOffset]||
      d.scriptCommand!==r.scriptCommand||
      d.handlerReferenceVerified!==true)
   return {...out,programClass:'SPECIAL_SERVICE_HANDLER_UNRESOLVED'};
  return {...out,programClass:'SPECIAL_SERVICE_DISPATCH',
    conditionalServiceHandlerVerified:true,
    referenceHandler:d.referenceHandler,
    conditionalService:d.conditionalService,
    optionalStaticMartItemIds:d.staticItemIds,
    limitations:['SERVICE_BRANCHES_AND_USER_CHOICE_UNKNOWN',
      'LIVE_EXECUTION_UNOBSERVED']};
 }
 if(r.scriptCommand==='TX_START_ASM'){
  if(rom[r.scriptFileOffset]!==0x08||r.asmCandidate?.verified!==true||
     r.asmCandidate.txAsmFileOffset!==r.scriptFileOffset)
   return {...out,programClass:'ASM_HANDLER_UNRESOLVED'};
  return {...out,programClass:'ASM_CONTROL_FLOW_PENDING',
   asmEntrypointIdentified:true,
   asmCandidateInstructions:r.asmCandidate.opcodeCandidateCount||0,
   limitations:['ASSEMBLY_CONTROL_FLOW_EFFECTS_UNRESOLVED',
    'RAM_BRANCHES_AND_INDIRECT_TARGETS_UNOBSERVED']};
 }
 return out;
}
function compileWorldInteractionPrograms({rom,atlas}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    atlas?.verified!==true||!isKnownAuditedRomSha(atlas.romSha256)||
    crypto.createHash('sha256').update(rom).digest('hex')!==atlas.romSha256||
    !Array.isArray(atlas.references)||atlas.references.length!==EXPECTED_REFS||
    atlas.summary?.referencedInteractions!==EXPECTED_REFS||
    atlas.summary?.resolvedTextPointers!==EXPECTED_REFS)
  return fail('Complete three-variant-audited ROM/world atlas required');
 const rows=[],keys=new Set(),groups=new Map();
 let linearTexts=0,services=0,asmRefs=0,uncertain=0;
 const classCounts={};
 for(const r of atlas.references){
  const k=r.mapId+':'+r.kind+':'+r.ordinal;
  if(keys.has(k))return fail('Duplicate map interaction: '+k);
  keys.add(k);
  const p=compileOne({rom,reference:r});
  const semanticRow=atlas.scriptSemantics?.verified===true&&
   atlas.scriptSemantics.romSha256===atlas.romSha256?
   atlas.scriptSemantics.rows.find(s=>s.mapId===r.mapId&&s.kind===r.kind&&
    s.ordinal===r.ordinal&&s.scriptFileOffset===r.scriptFileOffset):null;
  if(semanticRow?.semantics?.verified===true){
   p.abstractTransitions=semanticRow.semantics.effects;
   p.abstractExecutionLimitations=semanticRow.semantics.unresolved;
   p.handlerControlFlowFullyInterpreted=semanticRow.semantics.complete;
   if(p.abstractTransitions.length){p.programClass='ASM_PARTIALLY_INTERPRETED';p.semanticScope='ROM_ABSTRACT_CONTROL_FLOW_TRANSITIONS';}
  }
  if(p.verified!==true)return fail('Invalid interaction: '+k+': '+p.reason);
  rows.push(p);
  classCounts[p.programClass]=(classCounts[p.programClass]||0)+1;
  if(p.textProcessorCommandsVerified)linearTexts++;
  if(p.conditionalServiceHandlerVerified)services++;
  if(p.asmEntrypointIdentified)asmRefs++;
  if(!p.textProcessorCommandsVerified&&
     !p.conditionalServiceHandlerVerified&&
     !p.asmEntrypointIdentified)uncertain++;
  const groupKey=r.scriptCommand+':'+r.scriptFileOffset;
  let g=groups.get(groupKey);
  if(!g){g={scriptCommand:r.scriptCommand,
    scriptFileOffset:r.scriptFileOffset,programClass:p.programClass,
    references:0,mapIds:new Set()};groups.set(groupKey,g);}
  if(g.programClass!==p.programClass)
   return fail('Shared physical program classified inconsistently: '+groupKey);
  g.references++;g.mapIds.add(r.mapId);
 }
 if(rows.length!==EXPECTED_REFS||keys.size!==EXPECTED_REFS||
    asmRefs!==atlas.summary?.asmTextReferences)
  return fail('Universal program compiler did not cover all physical interactions');
 const programs=[...groups.values()].map(g=>({
  ...g,mapIds:[...g.mapIds].sort((a,b)=>a-b)
 })).sort((a,b)=>b.references-a.references||
  a.scriptFileOffset-b.scriptFileOffset);
 return {verified:true,romSha256:atlas.romSha256,rows,groups:programs,
  summary:{
   mapObjectInteractionsCompiled:rows.length,
   uniquePhysicalEntrypoints:programs.length,
   asmHandlerReferences:asmRefs,
   uniqueAsmHandlerEntrypoints:new Set(rows.filter(r=>
    r.asmEntrypointIdentified).map(r=>r.scriptFileOffset)).size,
   presentationTextStreamsInterpreted:linearTexts,
   conditionalServiceDispatchesLocated:services,
   unresolvedCommandStreams:uncertain,
   worldScriptEffectsCompletelyCertified:0,
   formallyProvenScriptEffects:atlas.scriptSemantics?.formallyProvenScriptEffects??0,
   runtimeEventsObserved:0,
   byProgramClass:classCounts,
   groupsByProgramClass:Object.fromEntries(
    [...new Set(programs.map(g=>g.programClass))].map(c=>
      [c,programs.filter(g=>g.programClass===c).length]))
  },
  semanticScope:'ROM_PARTIAL_ABSTRACT_CONTROL_FLOW_AND_TEXT_COMMAND_PROCESSOR',
  fullScriptSemanticsCertified:false,liveGameplayObserved:false,
  note:'Partial abstract RAM transitions carry path conditions and unresolved frontiers. They do not prove surrounding map-script eligibility, runtime execution or completion.'};
}
module.exports={compileOne,compileWorldInteractionPrograms};
