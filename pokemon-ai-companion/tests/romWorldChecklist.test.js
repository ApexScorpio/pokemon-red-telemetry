'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildMapChecklist}=require('../romWorldChecklist');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function index(){
 const maps=Array.from({length:248},(_,mapId)=>({
  mapId,verified:false,contents:null,reason:'NO_NORMAL_MAP_HEADER'}));
 maps[15]={mapId:15,verified:true,contents:{
  visibleItems:[{kind:'item',x:5,y:2,itemOrTrainerId:201,accessibleNow:null},
    {kind:'item',x:7,y:2,itemOrTrainerId:202,accessibleNow:null}],
  hiddenItems:[{hiddenIndex:1,x:7,y:4,itemId:30,accessibleNow:null}],
  trainers:[{kind:'trainer',x:9,y:2,itemOrTrainerId:205}],
  npcs:[{kind:'npc',x:4,y:4}],
  stationaryPokemon:[],signs:[],
  warps:[{x:3,y:5,destinationMap:6,destinationWarp:1}]
 }};
 return {verified:true,romSha256:sha,maps};
}
function advisor(overrides={}){
 return {verified:true,mapId:15,romSha256:sha,hiddenFlagsVerified:true,
  observations:[
   {kind:'ITEM',x:5,y:2,itemId:201,status:'NOT_REMOVED_FLAG',
    accessStatus:'NEEDS_CUT'},
   {kind:'ITEM',x:7,y:2,itemId:202,status:'REMOVED_NOT_PROOF_OF_COLLECTION',
    accessStatus:'NEEDS_SURF'},
   {kind:'HIDDEN_ITEM',x:7,y:4,itemId:30,hiddenIndex:1,status:'COLLECTED_FLAG'},
   {kind:'TRAINER',x:9,y:2,status:'VICTORY_SCRIPT_FLAG'},
   {kind:'WARP',x:3,y:5,destinationMapId:6,status:'STATIC_TRANSITION'}
  ],...overrides};
}
test('items with independently verified hidden bitmap and local Cut/Surf hints are separate',()=>{
 const r=buildMapChecklist({index:index(),mapId:15,advisor:advisor()});
 assert.equal(r.verified,true);
 assert.equal(r.summary.total,6);
 assert.equal(r.summary.confirmedCollected,1);
 assert.equal(r.summary.needsCutCandidates,1);
 assert.equal(r.summary.needsSurfCandidates,1);
 const hidden=r.actions.find(o=>o.kind==='HIDDEN_ITEM');
 assert.equal(hidden.progress,'COLLECTED_CONFIRMED_FLAG');
 assert.equal(hidden.accessibleNow,null);
 assert.equal(r.actions.find(o=>o.kind==='ITEM'&&o.x===5).routeCondition,'NEEDS_CUT');
 assert.equal(r.actions.find(o=>o.kind==='ITEM'&&o.x===7).routeCondition,'NEEDS_SURF');
 assert.equal(r.actions.find(o=>o.kind==='TRAINER').progress,'NOT_PROVEN');
 assert.equal(r.globalStateCertified,false);
 assert.ok(r.actions.every(x=>x.completedNow===null));
});
test('hidden flag cannot prove collection without independent bitmap assurance',()=>{
 const r=buildMapChecklist({index:index(),mapId:15,
  advisor:advisor({hiddenFlagsVerified:false})});
 assert.equal(r.summary.confirmedCollected,0);
});
test('stale map or wrong ROM identity never changes static item progress',()=>{
 for(const mismatch of [{mapId:16},{romSha256:'0'.repeat(64)},{verified:false}]){
  const r=buildMapChecklist({index:index(),mapId:15,advisor:advisor(mismatch)});
  assert.equal(r.advisorEvidenceMatched,false);
  assert.equal(r.summary.confirmedCollected,0);
  assert.equal(r.summary.needsCutCandidates,0);
  assert.equal(r.summary.needsSurfCandidates,0);
 }
});
test('duplicate observations at same coordinate do not produce an invented route or progress',()=>{
 const a=advisor();
 a.observations.push({kind:'ITEM',x:5,y:2,itemId:202,accessStatus:'NEEDS_CUT'});
 a.observations.push({kind:'HIDDEN_ITEM',x:7,y:4,itemId:31,status:'COLLECTED_FLAG'});
 const r=buildMapChecklist({index:index(),mapId:15,advisor:a});
 assert.equal(r.summary.confirmedCollected,0);
 assert.equal(r.summary.needsCutCandidates,0);
 assert.equal(r.actions.find(x=>x.kind==='HIDDEN_ITEM').joinProven,false);
});
test('reserved map cannot be treated as empty or accessible',()=>{
 const i=index();
 i.maps[111].unassignedHiddenItems=[{
  hiddenIndex:34,mapId:111,x:14,y:11,accessibleNow:null
 }];
 const r=buildMapChecklist({index:i,mapId:111,advisor:advisor()});
 assert.equal(r.verified,false);
 assert.equal(r.unresolvedHiddenReferences.length,1);
 assert.equal(r.unresolvedHiddenReferences[0].hiddenIndex,34);
 assert.deepEqual(r.actions,[]);
});

test('hidden collection requires exact ROM event index, not just same map/item/coordinates',()=>{
 for(const entry of [
  {hiddenIndex:2,status:'COLLECTED_FLAG'},
  {hiddenIndex:null,status:'COLLECTED_FLAG'},
  {status:'COLLECTED_FLAG'}
 ]){
  const a=advisor();
  a.observations=a.observations.map(o=>o.kind==='HIDDEN_ITEM'?{
   kind:'HIDDEN_ITEM',x:7,y:4,itemId:30,...entry
  }:o);
  const r=buildMapChecklist({index:index(),mapId:15,advisor:a});
  assert.equal(r.summary.confirmedCollected,0);
  assert.equal(r.actions.find(row=>row.kind==='HIDDEN_ITEM').joinProven,false);
 }
});
test('the exact hidden bit 1 can distinguish collected from uncollected without certifying access',()=>{
 const a=advisor();
 a.observations=a.observations.map(o=>o.kind==='HIDDEN_ITEM'?
  {...o,status:'NOT_COLLECTED_FLAG'}:o);
 const r=buildMapChecklist({index:index(),mapId:15,advisor:a});
 assert.equal(r.summary.confirmedNotCollected,1);
 assert.equal(r.summary.confirmedCollected,0);
 assert.equal(r.actions.find(row=>row.kind==='HIDDEN_ITEM').accessibleNow,null);
});
