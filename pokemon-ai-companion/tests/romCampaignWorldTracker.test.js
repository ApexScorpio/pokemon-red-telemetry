'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildCampaignWorldTracker}=require('../romCampaignWorldTracker');
const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {readRom}=require('../romComprehensiveAudit');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const sha=AUDITED_ROM_SHA256.RED;
const reserved=new Set([11,105,106,107,109,110,111,112,114,115,116,117,
 204,205,206,231,237,238,241,242,243,244]);
function index(){
 const maps=Array.from({length:248},(_,mapId)=>({
  mapId,verified:!reserved.has(mapId),contents:reserved.has(mapId)?null:{
   visibleItems:[],hiddenItems:[],trainers:[],npcs:[],
   stationaryPokemon:[],signs:[],warps:[]
  },unassignedHiddenItems:[]}));
 maps[15].contents.visibleItems=[{x:6,y:4,kind:'item',itemOrTrainerId:19}];
 maps[15].contents.hiddenItems=[{x:7,y:4,hiddenIndex:3,itemId:23}];
 maps[111].unassignedHiddenItems=[{mapId:111,x:14,y:11,hiddenIndex:34}];
 return {verified:true,romSha256:sha,maps};
}
function snapshot(){
 return {verified:true,mapId:15,romSha256:sha,hiddenFlagsVerified:true,
  observations:[
   {kind:'HIDDEN_ITEM',x:7,y:4,itemId:23,hiddenIndex:3,status:'COLLECTED_FLAG'},
   {kind:'ITEM',x:6,y:4,itemId:19,status:'NOT_REMOVED_FLAG',
    accessStatus:'NEEDS_CUT'}
  ]};
}
test('all 248 IDs processed; reserved map keeps orphan and does not claim current progress',()=>{
 const result=buildCampaignWorldTracker({index:index()});
 assert.equal(result.verified,true);
 assert.equal(result.maps.length,248);
 assert.equal(result.summary.normalMaps,226);
 assert.equal(result.summary.unresolvedMapIds,22);
 assert.equal(result.summary.unresolvedHiddenReferences,1);
 assert.equal(result.summary.allStaticActions,2);
 assert.equal(result.summary.confirmedHiddenCollected,0);
 assert.equal(result.summary.progressUnknown,2);
 assert.equal(result.maps[111].verified,false);
 assert.equal(result.maps[111].unresolvedHiddenReferences[0].hiddenIndex,34);
 assert.equal(result.currentMapConfirmed,false);
 assert.equal(result.allQuestsCompletedVerified,false);
});
test('a single ROM-bound advisor snapshot can mark only its own hidden flag and Cut candidate',()=>{
 const result=buildCampaignWorldTracker({index:index(),evidenceByMap:[snapshot()],
  currentMapId:15,currentMapVerified:true});
 assert.equal(result.verified,true);
 assert.equal(result.summary.observedMapCount,1);
 assert.equal(result.summary.confirmedHiddenCollected,1);
 assert.equal(result.summary.conditionalNeedsCut,1);
 assert.equal(result.summary.progressUnknown,1);
 assert.equal(result.currentMapConfirmed,true);
 assert.equal(result.currentMapId,15);
 assert.equal(result.maps[15].summary.confirmedCollected,1);
 assert.equal(result.storyCompletionVerified,false);
 assert.equal(result.globalAccessVerified,false);
});
test('wrong ROM, stale map, unknown event index cannot complete any object',()=>{
 const s=snapshot();
 s.observations[0].hiddenIndex=5;
 const result=buildCampaignWorldTracker({index:index(),evidenceByMap:[
  {...snapshot(),romSha256:'0'.repeat(64)},s,
  {...snapshot(),mapId:249}
 ]});
 assert.equal(result.summary.rejectedSnapshots,2);
 assert.equal(result.summary.confirmedHiddenCollected,0);
 assert.equal(result.summary.observedMapCount,1);
 assert.equal(result.currentMapConfirmed,false);
});
test('two competing snapshots for same map fail closed, never choose latest arbitrarily',()=>{
 const s=snapshot();
 const r=buildCampaignWorldTracker({index:index(),evidenceByMap:[
  s,{...s,observations:[{...s.observations[0],status:'NOT_COLLECTED_FLAG'}]}
 ],currentMapId:15,currentMapVerified:true});
 assert.equal(r.summary.ambiguousMapSnapshots,1);
 assert.equal(r.summary.observedMapCount,0);
 assert.equal(r.summary.confirmedHiddenCollected,0);
 assert.equal(r.summary.confirmedHiddenNotCollected,0);
 assert.equal(r.currentMapConfirmed,false);
});
test('cannot manufacture a 248-map campaign from a partial or unknown index',()=>{
 const i=index();i.romSha256='bad';
 assert.equal(buildCampaignWorldTracker({index:i}).verified,false);
 const j=index();j.maps[15].verified=false;
 assert.equal(buildCampaignWorldTracker({index:j}).verified,false);
});
for(const [variant,env] of [
 ['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('real '+variant+' ROM builds all-map read-only checklist without claiming full completion',
 {skip:!process.env[env]?'ROM file required for native full map audit':false},()=>{
  const b=readRom(process.env[env]);
  const p=inspectRomBuffer(b,variant+'.gb');
  const index=buildWorldContentsIndex(p);
  assert.equal(index.verified,true);
  const result=buildCampaignWorldTracker({index});
  assert.equal(result.verified,true);
  assert.equal(result.maps.length,248);
  assert.equal(result.summary.normalMaps,226);
  assert.equal(result.summary.unresolvedMapIds,22);
  assert.equal(result.summary.unresolvedHiddenReferences,1);
  assert.equal(result.summary.confirmedHiddenCollected,0);
  assert.equal(result.summary.observedMapCount,0);
  assert.equal(result.summary.allStaticActions,
   index.totals.visibleItems+index.totals.hiddenItemsInNormalMaps+
   index.totals.trainers+index.totals.npcs+index.totals.stationaryPokemon+
   index.totals.warps+index.totals.signs);
  assert.equal(result.storyCompletionVerified,false);
  assert.equal(result.globalAccessVerified,false);
  assert.equal(result.allQuestsCompletedVerified,false);
 });
}
