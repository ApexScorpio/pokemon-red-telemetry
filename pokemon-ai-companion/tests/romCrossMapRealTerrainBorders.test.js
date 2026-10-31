'use strict';
// Check the actual SHA-audited terrain archives and original 78 ROM header
// references. The target is a TEST TILE at the border, not an in-game item.
const test=require('node:test'),assert=require('node:assert/strict');
const {findCrossMapItemPaths}=require('../romCrossMapItemRoute');
const {validateOutdoorAlignment,expectedBlockOffset,mapArrival}
 =require('../romOutdoorAlignment');
const canonical=require('../data/gen1CanonicalMaps.json');
const offsets=require('../data/gen1OutdoorConnectionOffsetsReference.json');
const archived=require('../data/gen1OutdoorConnectionsAudited.json');
const atlases=[
 require('../data/romTerrain_red.json'),
 require('../data/romTerrain_blue.json'),
 require('../data/romTerrain_green.json')
];
const signed=new Map(offsets.edges.map(e=>[
 e.sourceMapId+':'+e.direction+':'+e.destinationMapId,e.offsetBlocks
]));
function fixture(terrain){
 const sha=terrain.romSha256,a=archived.versions[sha];
 const maps=Array.from({length:248},(_,mapId)=>{
  const row=canonical.maps[String(mapId)];
  return {mapId,valid:row.blockWidth>0&&row.blockHeight>0,
   widthBlocks:row.blockWidth,heightBlocks:row.blockHeight,
   blocksPointerCpu:0x4000};
 });
 const independent=new Map();
 for(const e of a.edges){
  const k=e.sourceMapId+':'+e.direction+':'+e.destinationMapId;
  const offset=signed.get(k);
  assert.ok(Number.isInteger(offset),'Missing signed ROM reference '+k);
  const dest=maps[e.destinationMapId];
  const d=expectedBlockOffset(e.direction,offset,
   dest.widthBlocks,dest.heightBlocks);
  const base=(e.destinationBlockPointerCpu-d+0x10000)&0xffff;
  if(independent.has(e.destinationMapId))
   assert.equal(independent.get(e.destinationMapId),base);
  independent.set(e.destinationMapId,base);
  dest.blocksPointerCpu=base;
 }
 const graph={verified:true,romSha256:sha,normalMapHeaders:226,
  totalWarpEntries:813,
  // Warp traversal is deliberately disabled: this test isolates borders.
  edges:Array.from({length:813},()=>({status:'LAST_MAP_RAM_REQUIRED'})),
  outdoorConnections:a};
 const alignment=validateOutdoorAlignment({
  profile:{hash:{sha256:sha},world:{maps:{valid:true,data:maps}}},
  warpGraph:graph
 });
 assert.equal(alignment.verified,true,alignment.reason);
 assert.equal(alignment.verifiedConnections,78);
 return {romSha256:sha,terrainAtlas:terrain,warpGraph:graph,
  outdoorAlignment:alignment,sourceMapId:15,
  position:{x:89,y:4},positionVerified:true,currentModeByte:0,
  canCut:false,canSurf:false,maxTransitions:3,maxStates:150};
}
for(const a of atlases)test('Route 4 east border is a non-guaranteed ROM terrain hypothesis for '+a.romSha256.slice(0,8),()=>{
 const f=fixture(a);
 const east=f.outdoorAlignment.connections.find(e=>
  e.sourceMapId===15&&e.destinationMapId===3&&e.direction==='east');
 assert.ok(east);
 const arrival=mapArrival('east',east.offsetBlocks,{x:89,y:4},
  east.destinationWidthTiles,east.destinationHeightTiles);
 assert.deepEqual(arrival,{x:0,y:12});
 // The second target deliberately stays on the source tile to confirm
 // that independent targets are not contaminated by the other route.
 const r=findCrossMapItemPaths({...f,targets:[
  {mapId:3,x:arrival.x,y:arrival.y,hidden:true},
  {mapId:15,x:89,y:4,hidden:true}
 ]});
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.requestedCount,2);
 assert.equal(r.foundCount,2);
 assert.equal(r.results[0].found,true);
 assert.equal(r.results[0].outdoorTransitions,1);
 assert.equal(r.results[0].warpTransitions,0);
 assert.deepEqual(r.results[0].segments[0].destinationTile,arrival);
 assert.equal(r.results[1].transitionCount,0);
 assert.equal(r.results[0].routeNavigableNowProven,false);
 assert.equal(r.results[0].accessibleNow,null);
 assert.equal(r.routeNavigableNowProven,false);
});
test('wrong ROM SHA never legitimises source/destination terrain routing',()=>{
 const f=fixture(atlases[0]);
 const r=findCrossMapItemPaths({...f,romSha256:atlases[2].romSha256,
  targets:[{mapId:3,x:0,y:12,hidden:true}]});
 assert.equal(r.verified,false);
 assert.equal(r.accessibleNow,null);
});
