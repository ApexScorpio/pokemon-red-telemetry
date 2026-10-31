'use strict';
// Two NPCs with TX_ASM battle handlers do not use the ordinary per-trainer
// bit-binding pipeline in the pinned pret/pokered reference. The reference
// describes progression through the map's script state; it does NOT prove
// those exact state transitions in a customized ROM or a live save.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const REFERENCE_COMMIT='c9181e91388686b6e8618cf6bef58506d93214f8';
const CASES=Object.freeze([
 {mapId:96,ordinal:2,scriptFileOffset:0x0614e6,bank:24,
  referenceMapName:'SS_ANNE_2F',referenceActor:'RIVAL',
  kind:'SCRIPTED_RIVAL_BATTLE',
  scriptStateVariable:'wSSAnne2FCurScript',
  referenceScriptSource:'scripts/SSAnne2F.asm',
  referenceHandlerSymbol:'SSAnne2FRivalText',
  states:['SCRIPT_SSANNE2F_DEFAULT',
   'SCRIPT_SSANNE2F_RIVAL_START_BATTLE',
   'SCRIPT_SSANNE2F_RIVAL_AFTER_BATTLE',
   'SCRIPT_SSANNE2F_RIVAL_EXIT',
   'SCRIPT_SSANNE2F_NOOP'],
  nextStepIfWon:'Rival exits; captain carrying the Cut HM is farther ahead on the ship'},
 {mapId:135,ordinal:11,scriptFileOffset:0x048e9d,bank:18,
  referenceMapName:'GAME_CORNER',referenceActor:'ROCKET',
  kind:'SCRIPTED_GAME_CORNER_ROCKET_BATTLE',
  scriptStateVariable:'wGameCornerCurScript',
  referenceScriptSource:'scripts/GameCorner.asm',
  referenceHandlerSymbol:'GameCornerRocketText',
  states:['SCRIPT_GAMECORNER_DEFAULT',
   'SCRIPT_GAMECORNER_ROCKET_BATTLE',
   'SCRIPT_GAMECORNER_ROCKET_EXIT'],
  nextStepIfWon:'Rocket leaves; the poster has a separate interactable event that can expose the hideout'}
]);
function invalid(reason){return {verified:false,reason,entries:[],
 referenceCases:0,standardTrainerFlagsRecovered:0,
 observedBattlesWon:0};}
function buildScriptedBattleReferenceEvidence({scriptAtlas}={}){
 const sha=String(scriptAtlas?.romSha256||'').toLowerCase();
 const handler=scriptAtlas?.unboundTrainerHandlerContext;
 const temp=scriptAtlas?.unboundTrainerTempBattleFlags;
 if(scriptAtlas?.verified!==true||!isKnownAuditedRomSha(sha)||
    !Array.isArray(scriptAtlas.maps)||scriptAtlas.maps.length!==248||
    scriptAtlas.summary?.trainerEventFlagBindingsMissing!==2||
    !Array.isArray(scriptAtlas.summary?.trainerEventFlagBindingsUnresolved)||
    scriptAtlas.summary.trainerEventFlagBindingsUnresolved.length!==2||
    handler?.verified!==true||handler.romSha256!==sha||
    handler.handlerCount!==2||!Array.isArray(handler.handlers)||
    temp?.verified!==true||temp.romSha256!==sha||
    temp.handlerCount!==2||!Array.isArray(temp.handlers)||
    temp.temporaryWramAddress!==0xd72d||
    temp.transientSetBitCandidates!==4||
    temp.worldEventBitsRecovered!==0||temp.executed!==false)
  return invalid('Pinned ROM and two physically verified TX_ASM handlers required');
 const entries=[];
 for(const [index,reference] of CASES.entries()){
  const h=handler.handlers[index],t=temp.handlers[index];
  const unresolved=scriptAtlas.summary.trainerEventFlagBindingsUnresolved
   .filter(x=>x.mapId===reference.mapId&&x.ordinal===reference.ordinal);
  const actor=scriptAtlas.maps[reference.mapId]?.interactions
   ?.filter(x=>x.kind==='TRAINER'&&x.ordinal===reference.ordinal)||[];
  if(unresolved.length!==1||actor.length!==1||
     !h||!t||h.mapId!==reference.mapId||
     h.ordinal!==reference.ordinal||
     h.txAsmFileOffset!==reference.scriptFileOffset||
     h.bank!==reference.bank||
     h.referenceMapName!==reference.referenceMapName||
     h.handlerRuntimeExecuted!==false||
     h.eventFlagBitIndex!==null||
     h.trainerVictoryObserved!==null||
     t.mapId!==h.mapId||t.ordinal!==h.ordinal||
     t.txAsmFileOffset!==h.txAsmFileOffset||
     t.eventBitIndex!==null||t.executed!==false||
     t.worldEventBitsRecovered!==0||
     t.physicallyAdjacentOpcodesHex!=='212dd7cbf6cbfe'||
     !Array.isArray(t.mutations)||t.mutations.length!==2||
     t.mutations.map(x=>x.bit).join(',')!=='6,7'||
     t.mutations.some(x=>x.address!==0xd72d||
      x.instructionExecuted!==false)||
     actor[0].eventBitBindingVerified!==false||
     actor[0].eventBitIndex!==null||
     actor[0].scriptCommand!=='TX_START_ASM')
   return invalid('Physical special actor and pinned reference do not align');
  entries.push({
   mapId:h.mapId,ordinal:h.ordinal,
   x:h.x,y:h.y,
   referenceMapName:h.referenceMapName,referenceActor:reference.referenceActor,
   battleKind:reference.kind,
   txAsmFileOffset:h.txAsmFileOffset,
   physicalHandlerByteProven:true,physicalTempBitSequenceProven:true,
   temporaryWramAddress:0xd72d,
   referenceClassification:'SCRIPTED_BATTLE_WITH_MAP_SCRIPT_STATE',
   referenceScriptVariable:reference.scriptStateVariable,
   referenceScriptStates:reference.states.slice(),
   referenceSource:'pret/pokered',referenceCommit:REFERENCE_COMMIT,
   referencePath:reference.referenceScriptSource,
   referenceHandlerSymbol:reference.referenceHandlerSymbol,
   nextStepIfWonInReference:reference.nextStepIfWon,
   sourceReferenceOnly:true,mapScriptStateReadFromCurrentGame:false,
   referenceSemanticsVerifiedInThisRom:false,
   ordinaryTrainerBitRequiredByReference:false,
   ordinaryTrainerEventBitIndex:null,
   battleWon:null,actorAvailableNow:null,
   eventActuallyTriggered:null,
   storyProgressProven:false,
   completionAssessment:'UNKNOWN_NO_LIVE_SCRIPT_STATE',
   warning:'External reference describes map-state battles. The local ROM agrees on handler bytes, not on proven runtime outcomes.'
  });
 }
 return {verified:true,romSha256:sha,
  source:'PINNED_PRET_SCRIPTED_BATTLES_PLUS_PHYSICAL_ROM_HANDLER',
  referenceCommit:REFERENCE_COMMIT,entries,referenceCases:2,
  standardTrainerFlagsRecovered:0,
  observedBattlesWon:0,liveScriptStatesVerified:0,
  actualSpecialBattleCompletionCertified:false,
  warning:'Do not treat the two special battle scripts as ordinary trainer completion bits, or treat a map-script label as an observed save value.'};
}
function scriptedBattleGuidanceForMap({scriptAtlas,mapId}={}){
 const evidence=scriptAtlas?.scriptedBattleReferenceEvidence;
 if(evidence?.verified!==true||evidence.romSha256!==scriptAtlas.romSha256||
    !Array.isArray(evidence.entries)||evidence.entries.length!==2||
    evidence.entries.some((x,i)=>x.mapId!==CASES[i].mapId||
     x.ordinal!==CASES[i].ordinal||x.battleWon!==null||
     x.mapScriptStateReadFromCurrentGame!==false))
  return {verified:false,reason:'Scripted battle reference evidence missing',entries:[]};
 if(!Number.isInteger(mapId)||mapId<0||mapId>=248)
  return {verified:false,reason:'Invalid map ID',entries:[]};
 return {verified:true,mapId,
  entries:evidence.entries.filter(x=>x.mapId===mapId)
   .map(x=>({...x,actionStatus:'SCRIPT_STATE_UNKNOWN',
    canBattleNow:null,wasWon:null,
    actionRequiresCurrentMapScriptValue:true})),
  gameplayStatusVerified:false};
}
module.exports={buildScriptedBattleReferenceEvidence,
 scriptedBattleGuidanceForMap};
