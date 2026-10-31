'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {localExitAccess}=require('../romLocalExitAccess');
const {verifyOutdoorConnectionVariant}=require('../romOutdoorReferenceGuard');
const {validateOutdoorAlignment,expectedBlockOffset}=require('../romOutdoorAlignment');
const canonical=require('../data/gen1CanonicalMaps.json');
const offsets=require('../data/gen1OutdoorConnectionOffsetsReference.json');
const borders=require('../data/gen1OutdoorConnectionsAudited.json');
const terrain={
 red:require('../data/romTerrain_red.json'),
 blue:require('../data/romTerrain_blue.json'),
 green:require('../data/romTerrain_green.json')
};
const passable=(m,x,y)=>{
 const i=y*m.width+x,b=Buffer.from(m.walkingBitsBase64,'base64');
 return !!(b[i>>3]&(1<<(i&7)));
};
const offsetByEdge=new Map(offsets.edges.map(e=>
 [e.sourceMapId+':'+e.direction+':'+e.destinationMapId,e.offsetBlocks]));
function alignedHeaderProfile(sha){
 const connections=borders.versions[sha].edges;
 const maps=Array.from({length:248},(_,mapId)=>{
   const m=canonical.maps[String(mapId)];
   return {mapId,valid:m.blockWidth>0&&m.blockHeight>0,
     widthBlocks:m.blockWidth,heightBlocks:m.blockHeight,
     blocksPointerCpu:0x4000};
 });
 const references=new Map();
 for(const e of connections){
   const dest=maps[e.destinationMapId],offset=offsetByEdge.get(
     e.sourceMapId+':'+e.direction+':'+e.destinationMapId);
   const diff=expectedBlockOffset(e.direction,offset,
     dest.widthBlocks,dest.heightBlocks);
   const base=(e.destinationBlockPointerCpu-diff+65536)&65535;
   if(references.has(e.destinationMapId))
     assert.equal(references.get(e.destinationMapId),base);
   references.set(e.destinationMapId,base);
   dest.blocksPointerCpu=base;
 }
 return {valid:true,data:maps};
}
function fixture(version,position){
 const atlas=terrain[version],sha=atlas.romSha256;
 const map=atlas.maps.find(m=>m.mapId===15);
 assert.equal(map.width,90);assert.equal(map.height,18);
 const outdoor=borders.versions[sha];
 assert.equal(verifyOutdoorConnectionVariant({
   romSha256:sha,warpGraph:{verified:true,romSha256:sha,
     outdoorConnections:outdoor}}).verified,true);
 const mapHeaders=alignedHeaderProfile(sha);
 const profile={hash:{sha256:sha},world:{terrainAtlas:atlas,
   maps:mapHeaders}};
 const graph={verified:true,romSha256:sha,outdoorConnections:outdoor};
 const alignment=validateOutdoorAlignment({profile,warpGraph:graph});
 assert.equal(alignment.verified,true,alignment.reason);
 return {profile,
   warpGraph:{verified:true,romSha256:sha,normalMapHeaders:226,
     totalWarpEntries:813,
     edges:Array.from({length:813},()=>({status:'LAST_MAP_RAM_REQUIRED'})),
     outdoorConnections:outdoor},
   outdoorAlignment:alignment,
   mapId:15,position,mapSnapshotVerified:true,positionVerified:true,
   modeByte:0,canCut:false,canSurf:false,mapEntities:[],
   spritesVerified:true};
}
for(const version of Object.keys(terrain)){
 test('Route 4 '+version+' southeast boundaries use actual ROM collision grid',()=>{
   const map=terrain[version].maps.find(m=>m.mapId===15);
   const south=Array.from({length:map.width},(_,x)=>x)
     .filter(x=>passable(map,x,17));
   const east=Array.from({length:map.height},(_,y)=>y)
     .filter(y=>passable(map,89,y));
   assert.equal(south.length,10);
   assert.equal(east.length,8);
   assert.equal(passable(map,89,4),true);
   assert.equal(passable(map,6,17),true);
   const a=localExitAccess(fixture(version,{x:89,y:4}));
   assert.equal(a.verified,true,a.reason);
   const e=a.exits.find(e=>e.kind==='OUTDOOR_BORDER'&&
     e.direction==='east'&&e.destinationMapId===3);
   assert.ok(e);
   assert.equal(e.borderEvidence.verified,true);
   assert.equal(e.borderEvidence.edgeTileCount,18);
   assert.equal(e.borderEvidence.borderTiles.some(v=>v.tile.x===89&&
     v.tile.y===4&&v.steps===0),true);
   assert.equal(e.neighborAlignmentVerified,true);
   assert.equal(e.accessibleNow,null);
   const b=localExitAccess(fixture(version,{x:7,y:17}));
   assert.equal(b.verified,true,b.reason);
   const s=b.exits.find(e=>e.kind==='OUTDOOR_BORDER'&&
     e.direction==='south'&&e.destinationMapId===14);
   assert.ok(s);
   assert.equal(s.borderEvidence.borderTiles.some(v=>
     v.tile.x===7&&v.tile.y===17&&v.steps===0),true);
   assert.equal(s.passageGeometryVerified,false);
 });
}

test('Route 4 south: exclude x=6 whose target Route 3 border tile is blocked',()=>{
 for(const version of Object.keys(terrain)){
   const r=localExitAccess(fixture(version,{x:7,y:17}));
   assert.equal(r.verified,true,r.reason);
   const south=r.exits.find(e=>e.kind==='OUTDOOR_BORDER'&&e.direction==='south');
   assert.equal(south.neighborAlignmentVerified,true);
   assert.equal(south.borderEvidence.compiledRomPointerFormulaMatched,true);
   assert.equal(south.borderEvidence.overlappingSourceTiles,20);
   assert.equal(south.borderEvidence.destinationTerrainCompatibleTiles,7);
   assert.equal(south.borderEvidence.borderTiles.some(v=>v.tile.x===6),false);
   assert.ok(south.borderEvidence.borderTiles.some(v=>v.tile.x===7&&
     v.destinationTile.x===57&&v.destinationTile.y===0&&
     v.destinationTerrainStatus==='STATIC_LAND_CANDIDATE'));
   assert.equal(south.passageGeometryVerified,false);
 }
});
test('Route 4 east: ROM offset -4 maps x=89,y=4 to Cerulean x=0,y=12',()=>{
 for(const version of Object.keys(terrain)){
   const r=localExitAccess(fixture(version,{x:89,y:4}));
   assert.equal(r.verified,true,r.reason);
   const east=r.exits.find(e=>e.kind==='OUTDOOR_BORDER'&&e.direction==='east');
   assert.equal(east.neighborAlignmentVerified,true);
   assert.equal(east.terrainStatus,
     'BORDER_ALIGNED_TERRAIN_CANDIDATES_TRANSFER_UNVERIFIED');
   assert.ok(east.borderEvidence.borderTiles.some(v=>
     v.tile.x===89&&v.tile.y===4&&
     v.destinationTile.x===0&&v.destinationTile.y===12&&v.steps===0));
   assert.equal(east.accessibleNow,null);
 }
});
