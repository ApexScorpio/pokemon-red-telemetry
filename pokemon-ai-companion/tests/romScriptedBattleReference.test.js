'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildScriptedBattleReferenceEvidence,scriptedBattleGuidanceForMap}=
 require('../romScriptedBattleReference');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function fixture(){
 const maps=Array.from({length:248},(_,mapId)=>({mapId,interactions:[]}));
 const cases=[[96,2,0x0614e6,24,'SS_ANNE_2F'],
  [135,11,0x048e9d,18,'GAME_CORNER']];
 const handlers=cases.map(([mapId,ordinal,txAsmFileOffset,bank,name])=>{
  maps[mapId].interactions.push({kind:'TRAINER',ordinal,
   eventBitBindingVerified:false,eventBitIndex:null,scriptCommand:'TX_START_ASM'});
  return {mapId,ordinal,txAsmFileOffset,bank,referenceMapName:name,
   x:9,y:6,eventFlagBitIndex:null,handlerRuntimeExecuted:false,
   trainerVictoryObserved:null};
 });
 const temps=cases.map(([mapId,ordinal,txAsmFileOffset])=>({
  mapId,ordinal,txAsmFileOffset,eventBitIndex:null,executed:false,
  worldEventBitsRecovered:0,physicallyAdjacentOpcodesHex:'212dd7cbf6cbfe',
  mutations:[6,7].map(bit=>({bit,address:0xd72d,
   instructionExecuted:false}))
 }));
 return {verified:true,romSha256:SHA,maps,
  summary:{trainerEventFlagBindingsMissing:2,
   trainerEventFlagBindingsUnresolved:[{mapId:96,ordinal:2},{mapId:135,ordinal:11}]},
  unboundTrainerHandlerContext:{verified:true,romSha256:SHA,
   handlerCount:2,handlers},
  unboundTrainerTempBattleFlags:{verified:true,romSha256:SHA,
   handlerCount:2,handlers:temps,temporaryWramAddress:0xd72d,
   transientSetBitCandidates:4,worldEventBitsRecovered:0,executed:false}};
}
test('classifies two physical special battle handlers as external map-script cases',()=>{
 const f=fixture(),r=buildScriptedBattleReferenceEvidence({scriptAtlas:f});
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.referenceCases,2);
 assert.deepEqual(r.entries.map(x=>[x.mapId,x.ordinal,x.referenceScriptVariable]),[
  [96,2,'wSSAnne2FCurScript'],[135,11,'wGameCornerCurScript']]);
 assert.ok(r.entries.every(x=>x.battleWon===null&&
  x.ordinaryTrainerEventBitIndex===null&&
  x.referenceSemanticsVerifiedInThisRom===false&&
  x.physicalHandlerByteProven===true));
 assert.equal(r.observedBattlesWon,0);
});
test('map 96 and 135 show conditional advice, and other maps show none',()=>{
 const f=fixture();f.scriptedBattleReferenceEvidence=
  buildScriptedBattleReferenceEvidence({scriptAtlas:f});
 const anne=scriptedBattleGuidanceForMap({scriptAtlas:f,mapId:96});
 const game=scriptedBattleGuidanceForMap({scriptAtlas:f,mapId:135});
 const other=scriptedBattleGuidanceForMap({scriptAtlas:f,mapId:4});
 assert.equal(anne.verified,true);
 assert.equal(anne.entries.length,1);
 assert.equal(anne.entries[0].wasWon,null);
 assert.equal(anne.entries[0].actionStatus,'SCRIPT_STATE_UNKNOWN');
 assert.equal(game.entries[0].referenceActor,'ROCKET');
 assert.equal(other.entries.length,0);
});
test('does not convert guessed event-bit, victory or gameplay state into proof',()=>{
 const f=fixture();
 f.unboundTrainerHandlerContext.handlers[0].eventFlagBitIndex=13;
 assert.equal(buildScriptedBattleReferenceEvidence({scriptAtlas:f}).verified,false);
 const v=fixture();v.unboundTrainerHandlerContext.handlers[1].trainerVictoryObserved=true;
 assert.equal(buildScriptedBattleReferenceEvidence({scriptAtlas:v}).verified,false);
 const q=fixture();q.unboundTrainerTempBattleFlags.handlers[1].mutations[0].instructionExecuted=true;
 assert.equal(buildScriptedBattleReferenceEvidence({scriptAtlas:q}).verified,false);
});
test('wrong handler offset, SHA or missing map object is rejected',()=>{
 const f=fixture();f.unboundTrainerHandlerContext.handlers[0].txAsmFileOffset++;
 assert.equal(buildScriptedBattleReferenceEvidence({scriptAtlas:f}).verified,false);
 const other=fixture();other.romSha256='f'.repeat(64);
 assert.equal(buildScriptedBattleReferenceEvidence({scriptAtlas:other}).verified,false);
 const noActor=fixture();noActor.maps[135].interactions=[];
 assert.equal(buildScriptedBattleReferenceEvidence({scriptAtlas:noActor}).verified,false);
});
for(const [variant,name] of [
 ['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']
]){
 test('actual '+variant+' ROM special battle semantics remain a reference, not a win',
  {skip:!process.env[name]?'Original ROM required':false},()=>{
  const rom=readRom(process.env[name]);
  const profile=inspectRomBuffer(rom,variant+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[variant]);
  const atlas=profile.world.interactionScriptAtlas;
  const x=atlas.scriptedBattleReferenceEvidence;
  assert.equal(x.verified,true,x.reason);
  assert.equal(x.referenceCases,2);
  assert.equal(x.standardTrainerFlagsRecovered,0);
  assert.ok(x.entries.every(row=>
   row.sourceReferenceOnly===true&&
   row.referenceSemanticsVerifiedInThisRom===false&&
   row.battleWon===null));
  for(const mapId of [96,135]){
   const guidance=scriptedBattleGuidanceForMap({scriptAtlas:atlas,mapId});
   assert.equal(guidance.verified,true);
   assert.equal(guidance.entries.length,1);
   assert.equal(guidance.entries[0].canBattleNow,null);
  }
 });
}
