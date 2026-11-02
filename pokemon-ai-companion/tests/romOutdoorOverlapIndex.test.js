'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildOutdoorOverlapIndex}=require('../romOutdoorOverlapIndex');
const {validateOutdoorAlignment,expectedBlockOffset}=require('../romOutdoorAlignment');
const reference=require('../data/gen1OutdoorConnectionOffsetsReference.json');
const audit=require('../data/gen1OutdoorConnectionsAudited.json');
const canonical=require('../data/gen1CanonicalMaps.json');
const versions={
 red:require('../data/romTerrain_red.json'),
 blue:require('../data/romTerrain_blue.json'),
 green:require('../data/romTerrain_green.json')
};
const key=e=>e.sourceMapId+':'+e.direction+':'+e.destinationMapId;
const offsets=new Map(reference.edges.map(e=>[key(e),e.offsetBlocks]));
function fixture(terrain){
 const sha=terrain.romSha256;
 const index=Array.from({length:248},(_,mapId)=>{
   const m=canonical.maps[String(mapId)];
   return {mapId,valid:m.blockWidth>0&&m.blockHeight>0,
     widthBlocks:m.blockWidth,heightBlocks:m.blockHeight,
     blocksPointerCpu:0x4000};
 });
 const bases=new Map();
 for(const e of audit.versions[sha].edges){
   const d=index[e.destinationMapId],diff=expectedBlockOffset(e.direction,
     offsets.get(key(e)),d.widthBlocks,d.heightBlocks);
   const base=(e.destinationBlockPointerCpu-diff+65536)&65535;
   if(bases.has(e.destinationMapId))assert.equal(bases.get(e.destinationMapId),base);
   bases.set(e.destinationMapId,base);d.blocksPointerCpu=base;
 }
 const profile={hash:{sha256:sha},world:{
   terrainAtlas:terrain,maps:{valid:true,data:index}}};
 const graph={verified:true,romSha256:sha,
   outdoorConnections:audit.versions[sha]};
 const alignment=validateOutdoorAlignment({profile,warpGraph:graph});
 assert.equal(alignment.verified,true,alignment.reason);
 return {profile,alignment};
}
for(const [name,data] of Object.entries(versions)){
 test(name+': all 78 aligned border overlays equal original 226-map archives',()=>{
   const output=buildOutdoorOverlapIndex(fixture(data));
   assert.equal(output.verified,true,output.reason);
   assert.equal(output.edgeCount,78);
   assert.equal(output.overlappingTilePairs,1484);
   assert.equal(output.staticLandCompatiblePairs,400);
   assert.equal(output.bordersWithLandPairs,70);
   assert.equal(output.bordersWithoutLandPairs,8);
   assert.equal(output.bordersWithWaterTiles,24);
   assert.equal(output.gamePassagesVerified,0);
   assert.equal(output.edges.filter(x=>x.activeTransitionObserved===true).length,0);
 });
}
test('Route4 maps 15→14/3 retain aligned land examples but never traversal claims',()=>{
 const atlas=buildOutdoorOverlapIndex(fixture(versions.red));
 const south=atlas.edges.find(x=>x.sourceMapId===15&&x.direction==='south');
 const east=atlas.edges.find(x=>x.sourceMapId===15&&x.direction==='east');
 assert.ok(south);assert.ok(east);
 assert.equal(south.offsetBlocks,-25);
 assert.equal(east.offsetBlocks,-4);
 assert.ok(south.staticLandSamples.some(x=>
   x.source.x===7&&x.source.y===17&&x.destination.x===57&&
   x.destination.y===0));
 assert.ok(east.staticLandSamples.some(x=>
   x.source.x===89&&x.source.y===4&&x.destination.x===0&&
   x.destination.y===12));
 assert.equal(south.accessibleNow,null);
 assert.equal(east.activeTransitionObserved,false);
});
test('zero land overlap means unknown event/water crossing, NOT permanent block',()=>{
 const atlas=buildOutdoorOverlapIndex(fixture(versions.blue));
 const zero=atlas.edges.filter(x=>x.staticLandCompatiblePairs===0);
 assert.equal(zero.length,8);
 assert.ok(zero.some(x=>x.sourceMapId===33&&x.destinationMapId===34));
 assert.ok(zero.every(x=>x.maybeRequiresWaterOrEvent===true&&
   x.accessibleNow===null));
});
test('wrong ROM terrain hash, altered tile bits and unknown alignment fail closed',()=>{
 const f=fixture(versions.green);
 assert.equal(buildOutdoorOverlapIndex({...f,alignment:{
   ...f.alignment,romSha256:'0'.repeat(64)}}).verified,false);
 const changed={...versions.green,maps:versions.green.maps.map(m=>m.mapId===15?
   {...m,walkingBitsSha256:'0'.repeat(64)}:m)};
 assert.equal(buildOutdoorOverlapIndex({
   profile:{...f.profile,world:{...f.profile.world,terrainAtlas:changed}},
   alignment:f.alignment}).verified,false);
});
