'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {suggestWorldDetours}=require('../romWorldDetourCycles');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function fixture(){
 const edges=Array.from({length:813},()=>({status:'LAST_MAP_RAM_REQUIRED'}));
 edges[0]={status:'STATIC_DESTINATION_WARP_VALIDATED',
   sourceMapId:15,destinationMapId:16,sourceWarpIndex:0,destinationWarpIndex:0,
   landing:{mapId:16,warpIndex:0}};
 edges[1]={status:'STATIC_DESTINATION_WARP_VALIDATED',
   sourceMapId:16,destinationMapId:17,sourceWarpIndex:0,destinationWarpIndex:0,
   landing:{mapId:17,warpIndex:0}};
 const borders=Array.from({length:78},()=>({
   sourceMapId:190,destinationMapId:191,direction:'west'}));
 borders[0]={sourceMapId:17,destinationMapId:15,direction:'north'};
 const warpGraph={verified:true,romSha256:sha,
   totalWarpEntries:813,normalMapHeaders:226,edges,
   outdoorConnections:{verified:true,romSha256:sha,
     edgeCount:78,reciprocalConnections:78,edges:borders}};
 const localExits={verified:true,romSha256:sha,mapId:15,
   positionFromRam:{x:2,y:3},truncated:false,
   exits:[{kind:'WARP',sourceWarpIndex:0,destinationMapId:16,
     terrainStatus:'TERRAIN_PATH_REQUIRES_CUT_ACTION'}]};
 return {warpGraph,localExits,romSha256:sha,mapId:15,
   target:{mapId:15,x:4,y:2},localPathAbsent:true,maxHops:5};
}
test('three-map cycle uses one outdoor border without claiming item access',()=>{
 const result=suggestWorldDetours(fixture());
 assert.equal(result.verified,true);
 assert.equal(result.candidates.length,1);
 assert.deepEqual(result.candidates[0].mapIds,[15,16,17,15]);
 assert.equal(result.candidates[0].includesOutdoorBorder,true);
 assert.equal(result.candidates[0].returnsToTargetSideProven,false);
 assert.equal(result.targetAccessProven,false);
 assert.equal(result.candidates[0].firstExitTerrainRank,0);
});
test('two opposite outdoor borders are not a meaningful workaround',()=>{
 const f=fixture();
 f.warpGraph.edges[0].status='LAST_MAP_RAM_REQUIRED';
 f.warpGraph.edges[1].status='LAST_MAP_RAM_REQUIRED';
 f.warpGraph.outdoorConnections.edges[0]={
   sourceMapId:15,destinationMapId:16,direction:'east'};
 f.warpGraph.outdoorConnections.edges[1]={
   sourceMapId:16,destinationMapId:15,direction:'west'};
 f.localExits.exits=[{kind:'OUTDOOR_BORDER',destinationMapId:16,
   terrainStatus:'BORDER_CROSSING_TILE_NOT_VERIFIED'}];
 const result=suggestWorldDetours(f);
 assert.equal(result.verified,true);
 assert.equal(result.candidates.length,0);
});
test('return by same static warp is ignored, alternate landing remains a hypothesis',()=>{
 const f=fixture();
 f.warpGraph.edges[1]={status:'STATIC_DESTINATION_WARP_VALIDATED',
   sourceMapId:16,destinationMapId:15,sourceWarpIndex:0,destinationWarpIndex:0,
   landing:{mapId:15,warpIndex:0}};
 f.warpGraph.outdoorConnections.verified=false;
 assert.equal(suggestWorldDetours(f).candidates.length,0);
 f.warpGraph.edges[1].destinationWarpIndex=1;
 const r=suggestWorldDetours(f);
 assert.equal(r.candidates.length,1);
 assert.equal(r.candidates[0].returnsToTargetSideProven,false);
});
test('wrong ROM, missing local obstacle or uncorroborated exits are rejected',()=>{
 const f=fixture();
 assert.equal(suggestWorldDetours({...f,localPathAbsent:false}).verified,false);
 assert.equal(suggestWorldDetours({...f,romSha256:'0'.repeat(64)}).verified,false);
 f.localExits.truncated=true;
 assert.equal(suggestWorldDetours(f).verified,false);
});
test('invalid outdoor evidence is never silently treated as 78 valid routes',()=>{
 const f=fixture();
 f.warpGraph.outdoorConnections.edges.pop();
 const r=suggestWorldDetours(f);
 assert.equal(r.verified,true);
 assert.equal(r.candidates.length,0);
});
test('bounded map search differentiates budget exhaustion from suggestion limit',()=>{
 const f=fixture();
 const limit=suggestWorldDetours({...f,maxSuggestions:1});
 assert.equal(limit.verified,true);
 assert.equal(limit.searchBudgetExhausted,false);
 assert.equal(limit.candidates.length,1);
 const noBudget=suggestWorldDetours({...f,maxStates:1});
 assert.equal(noBudget.searchBudgetExhausted,true);
 assert.equal(noBudget.candidates.length,0);
});

test('return-cycle shows only a first step backed by source-map terrain',()=>{
 const cfg=fixture();
 cfg.localExits.exits[0].approach={nextStep:{x:2,y:3},steps:7};
 const result=suggestWorldDetours(cfg);
 assert.equal(result.verified,true);
 const first=result.candidates[0].firstExitEvidence;
 assert.equal(first.known,true);
 assert.equal(first.kind,'WARP');
 assert.deepEqual(first.firstTerrainStep,{x:2,y:3});
 assert.equal(first.crossingAlignmentVerified,false);
 assert.equal(result.candidates[0].returnsToTargetSideProven,false);
});
test('candidate border tile never becomes an asserted landing on next map',()=>{
 const cfg=fixture();
 cfg.warpGraph.edges[0].status='LAST_MAP_RAM_REQUIRED';
 cfg.warpGraph.outdoorConnections.edges[1]={
   sourceMapId:15,destinationMapId:16,direction:'east'};
 cfg.localExits.exits=[{kind:'OUTDOOR_BORDER',destinationMapId:16,
   direction:'east',terrainStatus:'BORDER_SOURCE_TERRAIN_CANDIDATES_ALIGNMENT_UNKNOWN',
   borderEvidence:{verified:true,borderTiles:[{
     tile:{x:4,y:2},firstTerrainStep:{x:1,y:2}}]}}];
 const r=suggestWorldDetours(cfg);
 assert.equal(r.candidates.length,1);
 const first=r.candidates[0].firstExitEvidence;
 assert.deepEqual(first.candidateBorderTile,{x:4,y:2});
 assert.deepEqual(first.firstTerrainStep,{x:1,y:2});
 assert.equal(first.crossingAlignmentVerified,false);
 assert.equal(r.targetAccessProven,false);
});

test('return-cycle carries ROM-aligned outdoor landing without declaring traverse',()=>{
 const f=fixture();
 f.warpGraph.edges[0].status='LAST_MAP_RAM_REQUIRED';
 f.warpGraph.outdoorConnections.edges[1]={
   sourceMapId:15,destinationMapId:16,direction:'east'};
 f.localExits.exits=[{kind:'OUTDOOR_BORDER',
   destinationMapId:16,direction:'east',
   terrainStatus:'BORDER_ALIGNED_TERRAIN_CANDIDATES_TRANSFER_UNVERIFIED',
   neighborAlignmentVerified:true,
   borderEvidence:{verified:true,borderTiles:[{
     tile:{x:89,y:4},destinationTile:{x:0,y:12},
     firstTerrainStep:{x:88,y:4}}]}}];
 const r=suggestWorldDetours(f),first=r.candidates[0].firstExitEvidence;
 assert.equal(first.known,true);
 assert.deepEqual(first.candidateBorderTile,{x:89,y:4});
 assert.deepEqual(first.candidateDestinationTile,{x:0,y:12});
 assert.equal(first.crossingAlignmentVerified,true);
 assert.equal(first.canTraverseNowProven,false);
 assert.equal(r.candidates[0].returnsToTargetSideProven,false);
});

test('a conditional Cut or Strength route can motivate a cycle without falsifying local-path absence',()=>{
 const f=fixture();
 const cut=suggestWorldDetours({...f,localPathAbsent:false,
   localPathConditional:true});
 assert.equal(cut.verified,true,cut.reason);
 assert.equal(cut.localPathEvidence,'CONDITIONAL_LOCAL_BARRIER');
 assert.equal(cut.candidates.length,1);
 assert.equal(cut.targetAccessProven,false);
 const noPath=suggestWorldDetours(f);
 assert.equal(noPath.localPathEvidence,'NO_SAME_MAP_PATH');
 assert.equal(suggestWorldDetours({...f,localPathAbsent:false,
   localPathConditional:false}).verified,false);
 assert.equal(suggestWorldDetours({...f,localPathAbsent:true,
   localPathConditional:true}).verified,false);
});
