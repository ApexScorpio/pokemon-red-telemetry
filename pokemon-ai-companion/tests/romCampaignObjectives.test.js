'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {campaignObjectives}=require('../romCampaignObjectives');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function mapProgress(mapId){
 return {mapId,name:'Mapa '+mapId,
  hiddenItems:{notCollected:0},hiddenCoins:{notCollected:0},
  trainers:{gatesOpen:0,unknown:0},
  stationaryPokemon:{gatesOpen:0,unknown:0}};
}
function fixture(){
 const mapProgress=Array.from({length:226},(_,mapId)=>mapProgressFor(mapId));
 function mapProgressFor(mapId){return mapProgressTemplate(mapId);}
 function mapProgressTemplate(mapId){return {
   mapId,name:'Mapa '+mapId,
   hiddenItems:{notCollected:0},hiddenCoins:{notCollected:0},
   trainers:{gatesOpen:0,unknown:0},
   stationaryPokemon:{gatesOpen:0,unknown:0}
 };}
 mapProgress[15].hiddenItems.notCollected=1;
 mapProgress[16].hiddenItems.notCollected=2;
 mapProgress[17].trainers.gatesOpen=1;
 mapProgress[18].trainers.unknown=3;
 const warpEdges=Array.from({length:813},(_,i)=>({
   sourceMapId:100,destinationMapId:101,status:'LAST_MAP_RAM_REQUIRED'}));
 warpEdges[0]={sourceMapId:15,destinationMapId:16,
  status:'STATIC_DESTINATION_WARP_VALIDATED',landing:{mapId:16},
  sourceWarpIndex:2};
 warpEdges[1]={sourceMapId:16,destinationMapId:17,
  status:'STATIC_DESTINATION_WARP_VALIDATED',landing:{mapId:17},
  sourceWarpIndex:3};
 const warpGraph={verified:true,romSha256:sha,
  totalWarpEntries:813,normalMapHeaders:226,edges:warpEdges,
  outdoorConnections:{verified:true,edges:[]}};
 const ledger={verified:true,romSha256:sha,mapCount:226,
  progressCompleteness:'PARTIAL',mapProgress};
 return {ledger,warpGraph,sourceMapId:15};
}
test('prioritize current and nearby outstanding flags over unknown-only maps',()=>{
 const x=campaignObjectives(fixture());
 assert.equal(x.verified,true);
 assert.equal(x.mapsWithPending,3);
 assert.equal(x.mapsWithUnknown,1);
 assert.deepEqual(x.objectives.map(o=>o.mapId),[15,16,17,18]);
 assert.deepEqual(x.objectives.map(o=>o.mapHopCount),[0,1,2,null]);
 assert.equal(x.objectives[3].kind,'UNRESOLVED_FLAGS_ONLY');
 assert.equal(x.objectives[0].locationAccessibleNow,null);
 assert.equal(x.objectives[1].routeNavigableNowProven,false);
});
test('route suggestion is a static sequence, never an access guarantee',()=>{
 const x=campaignObjectives(fixture());
 assert.deepEqual(x.objectives[2].route.map(e=>e.destinationMapId),[16,17]);
 assert.equal(x.objectives[2].mapHopCount,2);
 assert.equal(x.routeNavigableNowProven,false);
});
test('mismatched or incomplete warp graph preserves goals but removes routes',()=>{
 const cfg=fixture();cfg.warpGraph.romSha256='0'.repeat(64);
 const x=campaignObjectives(cfg);
 assert.equal(x.verified,true);
 assert.equal(x.routeGraphVerified,false);
 assert.equal(x.objectives[1].route,null);
 assert.equal(x.objectives[1].mapHopCount,null);
 const c=fixture();c.warpGraph.edges.pop();
 assert.equal(campaignObjectives(c).routeGraphVerified,false);
});
test('reject inconsistent totals, coordinates and invalid bounds',()=>{
 const cfg=fixture();cfg.ledger.mapProgress[16].hiddenItems.notCollected=-1;
 assert.equal(campaignObjectives(cfg).verified,false);
 const dup=fixture();dup.ledger.mapProgress[17].mapId=16;
 assert.equal(campaignObjectives(dup).verified,false);
 assert.equal(campaignObjectives({...fixture(),sourceMapId:237}).verified,false);
 assert.equal(campaignObjectives({...fixture(),maxResults:100}).verified,false);
});
test('outdoor links are usable only when independently verified',()=>{
 const cfg=fixture();
 cfg.warpGraph.outdoorConnections.edges=[{
    sourceMapId:15,destinationMapId:18,direction:'E'}];
 const first=campaignObjectives(cfg);
 assert.equal(first.objectives.find(x=>x.mapId===18).mapHopCount,1);
 cfg.warpGraph.outdoorConnections.verified=false;
 assert.equal(campaignObjectives(cfg).objectives.find(x=>x.mapId===18).mapHopCount,null);
});
test('unreachable in static graph never means blocked in real gameplay',()=>{
 const cfg=fixture();
 cfg.warpGraph.edges[1].status='LAST_MAP_RAM_REQUIRED';
 const x=campaignObjectives(cfg);
 assert.equal(x.objectives.find(o=>o.mapId===17).mapHopCount,null);
 assert.ok(x.warnings.some(s=>/portas|scripts|LAST_MAP/.test(s)));
});

test('first-hop terrain proof beats a shorter but unwalkable-looking static warp',()=>{
 const cfg=fixture();
 cfg.warpGraph.edges[2]={sourceMapId:15,destinationMapId:17,
  status:'STATIC_DESTINATION_WARP_VALIDATED',landing:{mapId:17},
  sourceWarpIndex:7};
 cfg.position={x:11,y:5};
 cfg.firstMapTerrainHints={verified:true,romSha256:sha,mapId:15,
  positionFromRam:{x:11,y:5},candidates:[
   {warpIndex:2,destinationMapId:16,theoreticalTerrainPathFound:true},
   {warpIndex:7,destinationMapId:17,theoreticalTerrainPathFound:false}
  ]};
 const advice=campaignObjectives(cfg);
 const goal=advice.objectives.find(g=>g.mapId===17);
 assert.equal(advice.firstMapTerrainHintsCorroborated,true);
 assert.equal(goal.mapHopCount,2);
 assert.equal(goal.route[0].destinationMapId,16);
 assert.equal(goal.firstTransitionTerrainEvidence,'LOCAL_TERRAIN_PATH_CANDIDATE');
 assert.equal(goal.routeNavigableNowProven,false);
});
test('stale or wrong SHA first-hop hint is ignored, never certifies a path',()=>{
 const cfg=fixture();
 cfg.warpGraph.edges[2]={sourceMapId:15,destinationMapId:17,
  status:'STATIC_DESTINATION_WARP_VALIDATED',landing:{mapId:17},
  sourceWarpIndex:7};
 cfg.position={x:11,y:5};
 cfg.firstMapTerrainHints={verified:true,romSha256:sha,mapId:15,
  positionFromRam:{x:7,y:7},candidates:[
   {warpIndex:7,destinationMapId:17,theoreticalTerrainPathFound:true}]};
 let r=campaignObjectives(cfg);
 assert.equal(r.firstMapTerrainHintsCorroborated,false);
 assert.equal(r.objectives.find(g=>g.mapId===17).firstTransitionTerrainEvidence,
   'TERRAIN_NOT_VERIFIED');
 cfg.firstMapTerrainHints.positionFromRam={x:11,y:5};
 cfg.firstMapTerrainHints.romSha256='0'.repeat(64);
 r=campaignObjectives(cfg);
 assert.equal(r.firstMapTerrainHintsCorroborated,false);
});
