'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateOutdoorAlignment,mapArrival,expectedBlockOffset}
  =require('../romOutdoorAlignment');
const refs=require('../data/gen1OutdoorConnectionOffsetsReference.json');
const archive=require('../data/gen1OutdoorConnectionsAudited.json');
const canonical=require('../data/gen1CanonicalMaps.json');
const getKey=e=>e.sourceMapId+':'+e.direction+':'+e.destinationMapId;
const offsets=new Map(refs.edges.map(e=>[getKey(e),e.offsetBlocks]));
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(sha){
 const a=archive.versions[sha];
 const maps=Array.from({length:248},(_,mapId)=>{
   const row=canonical.maps[String(mapId)];
   return {mapId,valid:row.blockWidth>0&&row.blockHeight>0,
     widthBlocks:row.blockWidth,heightBlocks:row.blockHeight,
     blocksPointerCpu:0x4000};
 });
 const checked=new Map();
 for(const e of a.edges){
   const k=getKey(e),delta=expectedBlockOffset(e.direction,offsets.get(k),
     maps[e.destinationMapId].widthBlocks,maps[e.destinationMapId].heightBlocks);
   const base=(e.destinationBlockPointerCpu-delta+65536)&0xffff;
   if(checked.has(e.destinationMapId))
     assert.equal(checked.get(e.destinationMapId),base,
       'Independent ROM pointer must agree for '+e.destinationMapId);
   checked.set(e.destinationMapId,base);
   maps[e.destinationMapId].blocksPointerCpu=base;
 }
 return {profile:{hash:{sha256:sha},world:{maps:{valid:true,data:maps}}},
   warpGraph:{verified:true,romSha256:sha,outdoorConnections:clone(a)},
   independentlyCorroboratedMaps:[...checked].filter(([mapId])=>
     a.edges.filter(e=>e.destinationMapId===mapId).length>1).length};
}
test('every one of 78 original connection macro offsets is reciprocal',()=>{
 assert.equal(refs.edges.length,78);
 assert.equal(new Set(refs.edges.map(getKey)).size,78);
 for(const edge of refs.edges){
   const back=refs.edges.find(r=>r.sourceMapId===edge.destinationMapId&&
     r.destinationMapId===edge.sourceMapId);
   assert.ok(back,'Missing reciprocal '+getKey(edge));
   assert.equal(edge.offsetBlocks,-back.offsetBlocks);
 }
});
test('all 78 ROM descriptor strip pointers agree for every variant',()=>{
 for(const sha of Object.keys(archive.versions)){
   const f=fixture(sha);
   assert.equal(f.independentlyCorroboratedMaps,34);
   const r=validateOutdoorAlignment(f);
   assert.equal(r.verified,true,r.reason);
   assert.equal(r.verifiedConnections,78);
   assert.equal(r.sourceMaps,36);
   assert.equal(r.descriptorPointerFormulaVerified,true);
   assert.equal(r.actualTransitionVerified,false);
 }
});
test('Route 4 south and east offsets map source to proper destination tiles',()=>{
 const sha=Object.keys(archive.versions)[0],r=validateOutdoorAlignment(fixture(sha));
 const south=r.connections.find(e=>e.sourceMapId===15&&e.direction==='south');
 const east=r.connections.find(e=>e.sourceMapId===15&&e.direction==='east');
 assert.equal(south.offsetBlocks,-25);
 assert.equal(east.offsetBlocks,-4);
 assert.deepEqual(mapArrival('south',south.offsetBlocks,{x:7,y:17},
   south.destinationWidthTiles,south.destinationHeightTiles),{x:57,y:0});
 assert.deepEqual(mapArrival('east',east.offsetBlocks,{x:89,y:4},
   east.destinationWidthTiles,east.destinationHeightTiles),{x:0,y:12});
 assert.equal(mapArrival('south',south.offsetBlocks,{x:89,y:17},
   south.destinationWidthTiles,south.destinationHeightTiles),null);
});
test('wrong block pointer rejects complete outdoor alignment',()=>{
 const sha=Object.keys(archive.versions)[0],f=fixture(sha);
 f.profile.world.maps.data[14].blocksPointerCpu++;
 const r=validateOutdoorAlignment(f);
 assert.equal(r.verified,false);
 assert.match(r.reason,/Ponteiro/);
});
test('corrupted edge descriptor or ROM identity never yields an aligned route',()=>{
 const sha=Object.keys(archive.versions)[0],f=fixture(sha);
 f.warpGraph.outdoorConnections.edges[0].destinationBlockPointerCpu++;
 assert.equal(validateOutdoorAlignment(f).verified,false);
 const wrong=fixture(sha);wrong.profile.hash.sha256='0'.repeat(64);
 assert.equal(validateOutdoorAlignment(wrong).verified,false);
});
test('no coordinate outside destination map is an acceptable crossing',()=>{
 assert.equal(mapArrival('east',-4,{x:89,y:28},40,36),null);
 assert.equal(mapArrival('north',25,{x:3,y:0},90,18),null);
 assert.equal(mapArrival('west',0,{x:0,y:3},40,36)?.x,39);
});
