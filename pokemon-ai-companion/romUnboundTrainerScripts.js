'use strict';
// Explain the two unbound trainer event bits with exact ROM actor and script
// provenance. The pinned reference map name is not embedded in ROM bytes.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {lookupRomReference}=require('./romReferenceSemantics');
const TARGETS=Object.freeze([{mapId:96,ordinal:2},{mapId:135,ordinal:11}]);
function bad(reason){return {verified:false,reason,entries:[],unresolvedCount:null,
 eventBitsRecovered:0,gameplayOutcomesProven:0};}
function auditUnboundTrainerScripts({scriptAtlas}={}){
 const sha=String(scriptAtlas?.romSha256||'').toLowerCase();
 if(scriptAtlas?.verified!==true||!isKnownAuditedRomSha(sha)||
   !Array.isArray(scriptAtlas.maps)||scriptAtlas.maps.length!==248||
   !Array.isArray(scriptAtlas.references)||
   scriptAtlas.references.length!==1126||
   scriptAtlas.summary?.referencedInteractions!==1126||
   scriptAtlas.summary?.trainerEventFlagBindingsMissing!==2||
   !Array.isArray(scriptAtlas.summary.trainerEventFlagBindingsUnresolved)||
   scriptAtlas.summary.trainerEventFlagBindingsUnresolved.length!==2)
  return bad('Exact ROM script atlas with 1126 references required');
 const unresolved=scriptAtlas.summary.trainerEventFlagBindingsUnresolved;
 const entries=[],used=new Set();
 for(const expected of TARGETS){
  const rows=unresolved.filter(x=>x.mapId===expected.mapId&&
   x.ordinal===expected.ordinal);
  const map=scriptAtlas.maps[expected.mapId];
  const actors=(map?.interactions||[]).filter(x=>
   x.kind==='TRAINER'&&x.ordinal===expected.ordinal);
  const references=scriptAtlas.references.filter(x=>
   x.kind==='TRAINER'&&x.mapId===expected.mapId&&
   x.ordinal===expected.ordinal);
  const label=lookupRomReference({romSha256:sha,mapId:expected.mapId});
  if(rows.length!==1||actors.length!==1||references.length!==1||
    map.mapId!==expected.mapId||map.verified!==true||
    label.verified!==true||typeof label.referenceMapName!=='string')
   return bad('Unbound trainer is not uniquely linked to a ROM map object');
  const row=actors[0],stub=rows[0],ref=references[0];
  if(ref!==row||
    row.mapId!==expected.mapId||
    row.eventBitBindingVerified!==false||row.eventBitIndex!==null||
    stub.eventBitIndex!==null||stub.scriptEffectsVerified!==false||
    stub.reason!=='EVENT_BIT_NOT_PROVEN_FROM_ROM_SCRIPT_OR_TRAINER_HEADER'||
    row.eventBitUnknownReason!==stub.reason||
    row.eventFlagSnapshotVerified!==false||
    row.scriptEffectsVerified!==false||
    row.interactionExecuted!==false||
    row.textPointerVerified!==true||
    !Number.isInteger(row.scriptFileOffset)||
    row.scriptFileOffset<0||row.scriptFileOffset>=1048576||
    !Number.isInteger(row.textPointerCpu)||
    row.textPointerCpu<0x4000||row.textPointerCpu>=0x8000||
    !Number.isInteger(row.x)||row.x< -4||row.x>255||
    !Number.isInteger(row.y)||row.y< -4||row.y>255||
    row.x!==stub.x||row.y!==stub.y||
    row.rawTextId!==stub.rawTextId||
    !Number.isInteger(row.actorRomMetadata?.trainerClassId)||
    !Number.isInteger(row.actorRomMetadata?.trainerNumber)||
    typeof row.scriptCommand!=='string'||
    typeof row.scriptDispatchClass!=='string'||
    typeof row.scriptDispatchOpcodeVerified!=='boolean'||
    !Number.isInteger(row.rawTextId))
   return bad('Trainer metadata, physical script reference or unbound status disagree');
  const key=row.mapId+':'+row.ordinal;
  if(used.has(key))return bad('Duplicate actor identity');
  used.add(key);
  const asm=row.asmCandidate?.verified===true?row.asmCandidate:null;
  if(row.scriptCommand==='TX_START_ASM'&&
     (!asm||asm.txAsmFileOffset!==row.scriptFileOffset))
   return bad('ASM handler expected but not physically verified');
  entries.push({
   mapId:row.mapId,referenceMapName:label.referenceMapName,
   mapNameFromRom:false,mapNameSource:'PINNED_PRET_POKERED_REFERENCE',
   ordinal:row.ordinal,x:row.x,y:row.y,
   trainerClassId:row.actorRomMetadata.trainerClassId,
   trainerNumber:row.actorRomMetadata.trainerNumber,
   rawTextId:row.rawTextId,textId:row.textId,
   scriptFileOffset:row.scriptFileOffset,
   textPointerCpu:row.textPointerCpu,
   scriptCommand:row.scriptCommand,
   scriptDispatchClass:row.scriptDispatchClass,
   dispatchOpcodePhysicallyVerified:row.scriptDispatchOpcodeVerified,
   handlerCandidateAvailable:asm!==null,
   handlerCandidateInstructionCount:asm?.opcodeCandidateCount??null,
   directWramReadCandidates:row.asmDirectWramReadCandidates,
   directWramWriteCandidates:row.asmDirectWramWriteCandidates,
   eventBitIndex:null,eventBitBindingVerified:false,
   reason:row.eventBitUnknownReason,
   trainerVictoryRecorded:null,
   scriptTriggered:null,scriptEffectVerified:false,
   liveEventBitObserved:false,
   recommendedResearch:'TRACE_ACTUAL_ROM_SCRIPT_AND_EVENT_FLAG_WRITES'
  });
 }
 if(unresolved.some(x=>!used.has(x.mapId+':'+x.ordinal))||
   scriptAtlas.references.filter(x=>
    x.kind==='TRAINER'&&x.eventBitBindingVerified!==true).length!==2)
  return bad('Additional or inconsistent unresolved trainer actors');
 return {verified:true,romSha256:sha,
  source:'SHA_VERIFIED_ROM_ACTOR_AND_SCRIPT_REFERENCE',
  entries,unresolvedCount:entries.length,
  eventBitsRecovered:0,gameplayOutcomesProven:0,
  allNormalTrainerFlagsResolved:false,
  warning:'Physical actor and script pointers are verified; the two missing flag identities and any victory or trigger remain unknown.'};
}
module.exports={auditUnboundTrainerScripts};
