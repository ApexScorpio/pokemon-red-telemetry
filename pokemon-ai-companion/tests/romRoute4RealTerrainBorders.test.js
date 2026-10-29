'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {localExitAccess}=require('../romLocalExitAccess');
const {verifyOutdoorConnectionVariant}=require('../romOutdoorReferenceGuard');
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
function fixture(version,position){
 const atlas=terrain[version],sha=atlas.romSha256;
 const map=atlas.maps.find(m=>m.mapId===15);
 assert.equal(map.width,90);assert.equal(map.height,18);
 const outdoor=borders.versions[sha];
 assert.equal(verifyOutdoorConnectionVariant({
   romSha256:sha,warpGraph:{verified:true,romSha256:sha,
     outdoorConnections:outdoor}}).verified,true);
 return {profile:{hash:{sha256:sha},world:{terrainAtlas:atlas}},
   warpGraph:{verified:true,romSha256:sha,normalMapHeaders:226,
     totalWarpEntries:813,
     edges:Array.from({length:813},()=>({status:'LAST_MAP_RAM_REQUIRED'})),
     outdoorConnections:outdoor},
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
   assert.equal(e.neighborAlignmentVerified,false);
   assert.equal(e.accessibleNow,null);
   const b=localExitAccess(fixture(version,{x:6,y:17}));
   assert.equal(b.verified,true,b.reason);
   const s=b.exits.find(e=>e.kind==='OUTDOOR_BORDER'&&
     e.direction==='south'&&e.destinationMapId===14);
   assert.ok(s);
   assert.equal(s.borderEvidence.borderTiles.some(v=>
     v.tile.x===6&&v.tile.y===17&&v.steps===0),true);
   assert.equal(s.passageGeometryVerified,false);
 });
}
