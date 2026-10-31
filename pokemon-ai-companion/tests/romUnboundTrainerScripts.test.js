'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditUnboundTrainerScripts}=require('../romUnboundTrainerScripts');
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function input(){
 const maps=Array.from({length:248},(_,mapId)=>({mapId,verified:false,interactions:[]}));
 const refs=Array.from({length:1126},()=>({kind:'NPC',mapId:0,ordinal:1}));
 const unresolved=[];
 for(const [mapId,ordinal] of [[96,2],[135,11]]){
  const a={mapId,kind:'TRAINER',ordinal,x:9,y:3,rawTextId:17,textId:17,
   actorRomMetadata:{trainerClassId:201,trainerNumber:1},
   eventBitIndex:null,eventBitBindingVerified:false,
   eventBitUnknownReason:'EVENT_BIT_NOT_PROVEN_FROM_ROM_SCRIPT_OR_TRAINER_HEADER',
   eventFlagSnapshotVerified:false,scriptEffectsVerified:false,
   interactionExecuted:false,textPointerVerified:true,
   scriptFileOffset:0x1d000+mapId,textPointerCpu:0x5000,
   scriptCommand:'TX_START',scriptDispatchClass:'LINEAR_TEXT',
   scriptDispatchOpcodeVerified:true,
   asmCandidate:null,asmDirectWramReadCandidates:0,
   asmDirectWramWriteCandidates:0};
  maps[mapId]={mapId,verified:true,interactions:[a]};
  refs[mapId]=a;
  unresolved.push({mapId,ordinal,x:9,y:3,rawTextId:17,
   reason:a.eventBitUnknownReason,eventBitIndex:null,scriptEffectsVerified:false});
 }
 return {scriptAtlas:{verified:true,romSha256:SHA,maps,references:refs,
  summary:{referencedInteractions:1126,trainerEventFlagBindingsMissing:2,
   trainerEventFlagBindingsUnresolved:unresolved}}};
}
test('two unresolved trainer actors keep distinct physical script locations and no invented bits',()=>{
 const x=auditUnboundTrainerScripts(input());
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.unresolvedCount,2);
 assert.deepEqual(x.entries.map(r=>[r.mapId,r.ordinal,r.eventBitIndex]),
  [[96,2,null],[135,11,null]]);
 assert.deepEqual(x.entries.map(r=>r.referenceMapName),
  ['SS_ANNE_2F','GAME_CORNER']);
 assert.ok(x.entries.every(r=>r.mapNameFromRom===false&&
  r.trainerVictoryRecorded===null&&r.scriptTriggered===null&&
  r.scriptEffectVerified===false));
 assert.equal(x.eventBitsRecovered,0);
});
test('missing, contradictory or forged event bit evidence is rejected',()=>{
 const good=input();
 assert.equal(auditUnboundTrainerScripts({}).verified,false);
 const different=input();different.scriptAtlas.romSha256='0'.repeat(64);
 assert.equal(auditUnboundTrainerScripts(different).verified,false);
 const bit=input();bit.scriptAtlas.maps[96].interactions[0].eventBitIndex=100;
 assert.equal(auditUnboundTrainerScripts(bit).verified,false);
 const won=input();won.scriptAtlas.maps[96].interactions[0].interactionExecuted=true;
 assert.equal(auditUnboundTrainerScripts(won).verified,false);
 const third=input();third.scriptAtlas.summary.trainerEventFlagBindingsMissing=3;
 assert.equal(auditUnboundTrainerScripts(third).verified,false);
});
test('missing duplicate and inconsistent actor/script references are rejected',()=>{
 const dup=input();
 dup.scriptAtlas.maps[96].interactions.push(
  {...dup.scriptAtlas.maps[96].interactions[0]});
 assert.equal(auditUnboundTrainerScripts(dup).verified,false);
 const other=input();other.scriptAtlas.references[96]={
  ...other.scriptAtlas.references[96]};
 assert.equal(auditUnboundTrainerScripts(other).verified,false);
 const wrong=input();wrong.scriptAtlas.maps[96].interactions[0].scriptFileOffset=1048577;
 assert.equal(auditUnboundTrainerScripts(wrong).verified,false);
});
