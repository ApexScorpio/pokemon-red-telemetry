'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {adviseWorld}=require('../romWorldStateAdvisor');
const hash='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function fakeProfile(){
 const data=Array.from({length:248},(_,mapId)=>({mapId,valid:false}));
 data[15]={mapId:15,valid:true,name:'Route 4',objects:{warps:[
  {x:3,y:4,destinationMap:5,destinationWarp:1}
 ]}};
 return {hash:{sha256:hash},world:{maps:{valid:true,data},
  outdoorConnections:{edges:[{sourceMapId:15,destinationMapId:16,direction:'E'}]}}};
}
function evidence(overrides={}){
 return {verified:true,mapId:15,items:[{x:5,y:2,itemId:200,
  itemName:'TM04',removedFromMap:false,source:'ROM'}],
  trainers:[{x:9,y:3,trainerClassName:'Trainer',eventFlagSet:true,
   victoryRecorded:null}],
  npcs:[{x:8,y:4,objectOrdinal:3,source:'ROM'}],
  stationaryPokemon:[],stationaryEncounterRamVerified:false,
  trainerEventRamVerified:true,...overrides};
}
function run(extra={}){
 return adviseWorld({profile:fakeProfile(),mapId:15,position:{x:7,y:2},
  positionVerified:true,areaEvidence:evidence(),
  hiddenItems:[{mapId:15,x:7,y:4,itemId:201,isCollected:true}],
  hiddenFlagsVerified:true,trainerFlagsVerified:true,...extra});
}
test('all local object kinds plus exits in every audited map, no guarantee',()=>{
 const a=run();
 assert.equal(a.verified,true);
 assert.deepEqual(new Set(a.observations.map(o=>o.kind)),
   new Set(['ITEM','HIDDEN_ITEM','TRAINER','NPC','WARP','BORDER']));
 assert.equal(a.futureOutcomeGuaranteed,false);
 assert.equal(a.activeRomSha256Verified,false);
 assert.equal(a.progressCompleteness,'PARTIAL');
 assert.ok(a.observations.every(o=>o.accessibleNow===null));
});
test('hidden item flag never proves a trainer victory',()=>{
 const a=run({trainerFlagsVerified:false,
   areaEvidence:evidence({trainers:[{x:9,y:3,defeated:true,
      eventFlagSet:true,victoryRecorded:true}]})});
 assert.equal(a.observations.find(o=>o.kind==='TRAINER').status,'UNKNOWN');
 assert.equal(a.observations.find(o=>o.kind==='HIDDEN_ITEM').status,'COLLECTED_FLAG');
});
test('trainer gate closed is not a victory, script victory is distinct',()=>{
 assert.equal(run().observations.find(o=>o.kind==='TRAINER').status,'TRAINER_GATE_CLOSED');
 const win=run({areaEvidence:evidence({trainers:[{x:9,y:3,victoryRecorded:true,
   eventFlagSet:true}]})});
 assert.equal(win.observations.find(o=>o.kind==='TRAINER').status,'VICTORY_SCRIPT_FLAG');
});
test('hidden item recollection requires own verified flags',()=>{
 assert.equal(run({hiddenFlagsVerified:false}).observations.find(o=>
   o.kind==='HIDDEN_ITEM').status,'UNKNOWN');
 assert.equal(run({hiddenFlagsVerified:true}).observations.find(o=>
   o.kind==='HIDDEN_ITEM').status,'COLLECTED_FLAG');
});
test('item access joined only by SHA+map+index+coordinate+ROM source',()=>{
 const inputs=[{x:5,y:2,name:'TM04',romItemCoordinatesVerified:true},
  {x:7,y:4,name:'Hidden',romItemCoordinatesVerified:true}];
 const access={verified:true,mapId:15,romSha256:hash,results:[
  {index:0,x:5,y:2,accessStatus:'NEEDS_SURF',
   route:{steps:10,usesSurf:true},reason:'water'},
  {index:1,x:7,y:4,accessStatus:'CONDITIONAL_PATH',
   route:{steps:2},reason:'tile'}
 ]};
 const a=run({itemAccess:access,itemAccessInputs:inputs,hiddenStartIndex:1});
 assert.equal(a.observations.find(o=>o.kind==='ITEM').accessStatus,'NEEDS_SURF');
 assert.equal(a.observations.find(o=>o.kind==='HIDDEN_ITEM').accessStatus,'CONDITIONAL_PATH');
 assert.equal(a.observations.find(o=>o.kind==='ITEM').accessibleNow,null);
 assert.equal(run({itemAccess:{...access,romSha256:'0'.repeat(64)},
   itemAccessInputs:inputs,hiddenStartIndex:1}).observations
   .find(o=>o.kind==='ITEM').accessStatus,undefined);
 assert.equal(run({itemAccess:{...access,mapId:14},itemAccessInputs:inputs,
   hiddenStartIndex:1}).observations.find(o=>o.kind==='ITEM').accessStatus,undefined);
 assert.equal(run({itemAccess:{...access,results:[
   {...access.results[0],index:7},access.results[1]]},itemAccessInputs:inputs,
   hiddenStartIndex:1}).observations.find(o=>o.kind==='ITEM').accessStatus,undefined);
});
test('duplicate visible coordinates do not inherit some other item path',()=>{
 const e=evidence({items:[{x:5,y:2,itemName:'A',itemId:1},{x:5,y:2,
   itemName:'B',itemId:2}]});
 const a=run({areaEvidence:e,hiddenStartIndex:2,
  itemAccessInputs:[{x:5,y:2,romItemCoordinatesVerified:true},
    {x:5,y:2,romItemCoordinatesVerified:true}],
  itemAccess:{verified:true,mapId:15,romSha256:hash,results:[
    {index:0,x:5,y:2,accessStatus:'NEEDS_CUT'},
    {index:1,x:5,y:2,accessStatus:'NO_SAME_MAP_PATH'}
  ]}});
 assert.ok(a.observations.filter(o=>o.kind==='ITEM').every(o=>!o.accessStatus));
});
test('stale area from other map is not considered present on current map',()=>{
 const a=run({areaEvidence:evidence({mapId:14})});
 assert.equal(a.liveAreaEvidenceVerified,false);
 assert.equal(a.observations.some(o=>o.kind==='ITEM'||o.kind==='TRAINER'),false);
 assert.equal(a.observations.some(o=>o.kind==='WARP'),true);
});
test('reject unknown ROM SHA and reserved map even with tempting flags',()=>{
 const p=fakeProfile();p.hash.sha256='0'.repeat(64);
 assert.equal(adviseWorld({profile:p,mapId:15,areaEvidence:evidence()}).verified,false);
 assert.equal(run({mapId:237}).verified,false);
});

test('coins use D6FE evidence only, never the hidden-item flag',()=>{
 const coins=[{mapId:15,x:9,y:8,actualAwardIfClaimed:20,isCollected:true}];
 const unknown=run({hiddenCoins:coins,coinFlagsVerified:false,hiddenFlagsVerified:true});
 assert.equal(unknown.observations.find(o=>o.kind==='HIDDEN_COIN').status,'UNKNOWN');
 const got=run({hiddenCoins:coins,coinFlagsVerified:true,hiddenFlagsVerified:false});
 const obs=got.observations.find(o=>o.kind==='HIDDEN_COIN');
 assert.equal(obs.status,'COIN_COLLECTED_FLAG');
 assert.equal(obs.coinAmount,20);
 assert.equal(got.observations.find(o=>o.kind==='HIDDEN_ITEM').status,'UNKNOWN');
});

test('all ROM signs surfaced without claiming dialogue or scripted result',()=>{
 const p=fakeProfile();
 p.world.maps.data[15].objects.signs=[
   {x:11,y:4,textId:1},{x:9,y:5,textId:2}];
 const r=run({profile:p});
 const signs=r.observations.filter(o=>o.kind==='SIGN');
 assert.equal(signs.length,2);
 assert.ok(signs.every(o=>o.status==='SCRIPT_UNRESOLVED'&&
   o.accessibleNow===null));
});
test('ROM encounter slots are conditional and only copied with all 10 audited weights',()=>{
 const p=fakeProfile();
 const data=Array.from({length:248},(_,mapId)=>({mapId,grass:{
   rateByte:0,slots:[]},water:{rateByte:0,slots:[]}}));
 const weights=[51,51,39,25,25,25,13,13,11,3];
 data[15].grass={rateByte:12,slots:weights.map((weight,slot)=>({
   slot,level:10+slot,internalId:1,rollWeight:weight}))};
 p.world.wildEncounters={valid:true,data};
 const result=run({profile:p});
 const a=result.observations.find(o=>o.kind==='WILD_ENCOUNTER');
 assert.equal(a.rateByte,12);
 assert.equal(a.slots.reduce((sum,s)=>sum+s.weight,0),256);
 assert.equal(a.effectiveChancePerStep,null);
 assert.equal(a.accessibleNow,null);
 // Corrupted wild table is not silently presented as confirmed.
 p.world.wildEncounters.data[15].grass.slots[0].rollWeight=52;
 assert.equal(run({profile:p}).observations.some(o=>
   o.kind==='WILD_ENCOUNTER'),false);
});

test('advisor exposes all-map static inventory without inventing current progress',()=>{
 const reserved=new Set([11,105,106,107,109,110,111,112,114,115,116,117,
   204,205,206,231,237,238,241,242,243,244]);
 const p=fakeProfile();
 p.world.maps.validMapHeaders=226;
 p.world.maps.data=Array.from({length:248},(_,mapId)=>({
   mapId,valid:!reserved.has(mapId),mapBank:1,
   objects:{warps:[],signs:[],objects:[]}
 }));
 p.world.maps.data[15].objects={
   warps:[{x:3,y:4,destinationMap:5,destinationWarp:0}],
   signs:[],
   objects:[{kind:'item',x:6,y:4,spriteId:10,textId:129,
     trainerClassOrItemId:35}]
 };
 const result=adviseWorld({profile:p,mapId:15});
 assert.equal(result.verified,true);
 assert.equal(result.fullWorldStaticIndexVerified,true);
 assert.equal(result.fullWorldStaticTotals.normalMaps,226);
 assert.equal(result.campaignSummary.normalMaps,226);
 assert.equal(result.campaignGlobalCompletionVerified,false);
 assert.equal(result.mapStaticInventory.verified,true);
 const item=result.mapStaticInventory.contents.visibleItems[0];
 assert.equal(item.itemOrTrainerId,35);
 assert.equal(item.accessibleNow,null);
 assert.equal(item.collected,null);
 assert.equal(result.mapStaticInventory.liveProgressVerified,false);
 assert.equal(result.futureOutcomeGuaranteed,false);
});

test('advisor carries exact hidden event index to prevent a wrong RAM bit joining an item',()=>{
 const a=run({hiddenItems:[{mapId:15,x:7,y:4,itemId:201,
  hiddenIndex:12,isCollected:true}]});
 const row=a.observations.find(o=>o.kind==='HIDDEN_ITEM');
 assert.equal(row.hiddenIndex,12);
 assert.equal(row.status,'COLLECTED_FLAG');
 const unknown=run({hiddenItems:[{mapId:15,x:7,y:4,itemId:201,
  isCollected:true}]});
 assert.equal(unknown.observations.find(o=>o.kind==='HIDDEN_ITEM').hiddenIndex,null);
});

test('campaign observations are counted only when map/position RAM window is confirmed',()=>{
 const reserved=new Set([11,105,106,107,109,110,111,112,114,115,116,117,
  204,205,206,231,237,238,241,242,243,244]);
 const p=fakeProfile();
 p.world.maps.validMapHeaders=226;
 p.world.maps.data=Array.from({length:248},(_,mapId)=>({
  mapId,valid:!reserved.has(mapId),
  objects:{warps:[],signs:[],objects:[]}
 }));
 const absent=adviseWorld({profile:p,mapId:15,positionVerified:false});
 assert.equal(absent.verified,true);
 assert.equal(absent.campaignCurrentMapConfirmed,false);
 assert.equal(absent.campaignSummary.observedMapCount,0);
 const checked=adviseWorld({profile:p,mapId:15,positionVerified:true});
 assert.equal(checked.verified,true);
 assert.equal(checked.campaignCurrentMapConfirmed,true);
 assert.equal(checked.campaignSummary.observedMapCount,1);
 assert.equal(checked.campaignGlobalCompletionVerified,false);
});

test('reference-guided scripted battle remains unknown on maps 96 and 135',()=>{
 const p=fakeProfile();
 const rows=[{mapId:96,ordinal:2,referenceScriptVariable:'wSSAnne2FCurScript',
  referencePath:'scripts/SSAnne2F.asm',referenceCommit:'c9181e91388686b6e8618cf6bef58506d93214f8',
  referenceScriptStates:['SCRIPT_SSANNE2F_DEFAULT'],
  x:36,y:4,battleWon:null,mapScriptStateReadFromCurrentGame:false},
 {mapId:135,ordinal:11,referenceScriptVariable:'wGameCornerCurScript',
  referencePath:'scripts/GameCorner.asm',referenceCommit:'c9181e91388686b6e8618cf6bef58506d93214f8',
  referenceScriptStates:['SCRIPT_GAMECORNER_DEFAULT'],
  x:9,y:5,battleWon:null,mapScriptStateReadFromCurrentGame:false}];
 p.world.interactionScriptAtlas={romSha256:hash,
  scriptedBattleReferenceEvidence:{verified:true,romSha256:hash,entries:rows}};
 for(const mapId of [96,135]){
  p.world.maps.data[mapId]={mapId,valid:true,name:'Reference',
   objects:{warps:[],signs:[],objects:[]}};
  const result=adviseWorld({profile:p,mapId});
  assert.equal(result.verified,true);
  const battle=result.observations.filter(o=>o.kind==='SCRIPTED_BATTLE');
  assert.equal(battle.length,1);
  assert.equal(battle[0].status,'SCRIPT_STATE_UNKNOWN');
  assert.equal(battle[0].eventBitIndex,null);
  assert.equal(battle[0].battleWon,null);
  assert.equal(battle[0].accessibleNow,null);
  assert.equal(battle[0].mapScriptStateVerified,false);
  assert.equal(battle[0].nextActionConditional,true);
 }
});
test('unverified scripted battle reference cannot appear as real observed progress',()=>{
 const p=fakeProfile();
 p.world.maps.data[96]={mapId:96,valid:true,
  objects:{warps:[],signs:[],objects:[]}};
 p.world.interactionScriptAtlas={
  romSha256:hash,scriptedBattleReferenceEvidence:{
   verified:false,romSha256:hash,entries:[]}};
 const a=adviseWorld({profile:p,mapId:96});
 assert.equal(a.verified,true);
 assert.equal(a.observations.some(o=>o.kind==='SCRIPTED_BATTLE'),false);
});

test('two corroborated script-byte reads expose only reference state, never battle outcome',()=>{
 const p=fakeProfile(),mapId=96,bytes=Array(784).fill('00');
 bytes[197]='04';
 p.world.maps.data[mapId]={mapId,valid:true,
  objects:{warps:[],signs:[],objects:[]}};
 const row={mapId:96,ordinal:2,x:36,y:4,battleWon:null,
  mapScriptStateReadFromCurrentGame:false,
  referenceScriptStates:['SCRIPT_SSANNE2F_DEFAULT']};
 p.world.interactionScriptAtlas={
  romSha256:hash,
  scriptedBattleReferenceEvidence:{verified:true,romSha256:hash,
   entries:[row,{mapId:135,ordinal:11,battleWon:null,
    mapScriptStateReadFromCurrentGame:false}]},
  scriptedBattleRamCandidates:{verified:true,romSha256:hash,count:2,
   candidates:[
    {mapId:96,ordinal:2,handlerBank:24,
     referenceVariable:'wSSAnne2FCurScript',
     referenceWramAddress:0xd665,worldBlockOffset:197,
     addressProvenFromActualRomInstructions:false,referenceLayoutOnly:true},
    {mapId:135,ordinal:11,handlerBank:18,
     referenceVariable:'wGameCornerCurScript',
     referenceWramAddress:0xd65f,worldBlockOffset:191,
     addressProvenFromActualRomInstructions:false,referenceLayoutOnly:true}
   ]}
 };
 const args={profile:p,mapId,positionVerified:true,
  scriptedBattleRamReadback:{firstWorldBlockHex:bytes,
   repeatScriptHex:'04',repeatMapHex:'60',
   romIdentityMatched:true,mapPositionVerified:true,
   secondReadFromSameTargetVerified:true}};
 const a=adviseWorld(args);
 assert.equal(a.verified,true);
 const entry=a.observations.find(x=>x.kind==='SCRIPTED_BATTLE');
 assert.equal(entry.status,'SCRIPT_BYTE_REPEAT_VERIFIED_REFERENCE_ONLY');
 assert.equal(entry.referenceStateName,'SCRIPT_SSANNE2F_NOOP');
 assert.equal(entry.currentMapScriptValue,4);
 assert.equal(entry.battleWon,null);
 assert.equal(entry.mapScriptStateVerified,false);
 assert.equal(entry.accessibleNow,null);
 const b=adviseWorld({...args,scriptedBattleRamReadback:{
  ...args.scriptedBattleRamReadback,repeatScriptHex:'03'}});
 assert.equal(b.observations.find(x=>x.kind==='SCRIPTED_BATTLE').status,
  'SCRIPT_STATE_UNKNOWN');
});
