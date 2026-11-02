'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditUnboundTrainerScripts}=require('../romUnboundTrainerScripts');
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
function input(){
 const maps=Array.from({length:248},(_,mapId)=>({mapId,verified:false,interactions:[]}));
 // Faithful compact profile: 1126 references distributed among maps,
 // with no top-level `references` property.
 maps[0]={mapId:0,verified:true,interactions:Array.from({length:1124},
  (_,i)=>({kind:'NPC',mapId:0,ordinal:i+1}))};
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
  unresolved.push({mapId,ordinal,x:9,y:3,rawTextId:17,
   reason:a.eventBitUnknownReason,eventBitIndex:null,scriptEffectsVerified:false});
 }
 return {scriptAtlas:{verified:true,romSha256:SHA,maps,
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
 const other=input();
 other.scriptAtlas.references=other.scriptAtlas.maps.flatMap(m=>m.interactions);
 other.scriptAtlas.references[1124]={...other.scriptAtlas.references[1124]};
 assert.equal(auditUnboundTrainerScripts(other).verified,false);
 const wrong=input();wrong.scriptAtlas.maps[96].interactions[0].scriptFileOffset=1048577;
 assert.equal(auditUnboundTrainerScripts(wrong).verified,false);
});

test('compact and full atlas agree only if they share identical map actor objects',()=>{
 const compact=input(),c=auditUnboundTrainerScripts(compact);
 assert.equal(c.verified,true,c.reason);
 assert.equal(c.referenceSource,'COMPACT_MAP_INTERACTIONS');
 assert.equal(c.mapInteractionRowsReconstructed,1126);
 const full=input();
 full.scriptAtlas.references=full.scriptAtlas.maps.flatMap(m=>m.interactions);
 const f=auditUnboundTrainerScripts(full);
 assert.equal(f.verified,true,f.reason);
 assert.equal(f.referenceSource,'FULL_ATLAS_REFERENCES_MATCH_MAPS');
 assert.deepEqual(f.entries,c.entries);
});
test('compact atlas with missing or extra interactions fails closed',()=>{
 const missing=input();
 missing.scriptAtlas.maps[0].interactions.pop();
 assert.equal(auditUnboundTrainerScripts(missing).verified,false);
 const extra=input();
 extra.scriptAtlas.maps[0].interactions.push({kind:'NPC',mapId:0,ordinal:1125});
 assert.equal(auditUnboundTrainerScripts(extra).verified,false);
 const corrupt=input();
 corrupt.scriptAtlas.maps[96].interactions[0].textPointerVerified=false;
 assert.equal(auditUnboundTrainerScripts(corrupt).verified,false);
});
for(const [variant,envName] of [
 ['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('original '+variant+' ROM compact profile exposes two script pointers',
  {skip:!process.env[envName]?'Requires original ROM':false},()=>{
   const rom=readRom(process.env[envName]);
   const profile=inspectRomBuffer(rom,variant+'.gb');
   assert.equal(profile.hash.sha256,KNOWN[variant]);
   const atlas=profile.world.interactionScriptAtlas;
   assert.equal(Object.hasOwn(atlas,'references'),false);
   const audit=auditUnboundTrainerScripts({scriptAtlas:atlas});
   assert.equal(audit.verified,true,audit.reason);
   assert.equal(audit.referenceSource,'COMPACT_MAP_INTERACTIONS');
   assert.equal(audit.mapInteractionRowsReconstructed,1126);
   assert.deepEqual(audit.entries.map(x=>[x.mapId,x.ordinal,x.eventBitIndex]),
    [[96,2,null],[135,11,null]]);
   assert.ok(audit.entries.every(x=>x.scriptFileOffset>=0&&
    x.scriptFileOffset<rom.length&&x.trainerVictoryRecorded===null));
  });
}
