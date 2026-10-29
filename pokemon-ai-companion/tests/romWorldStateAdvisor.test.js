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
