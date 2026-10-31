'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {outdoorBoundaryCandidates}=require('../romOutdoorBoundaryCandidates');
function reach(){
 return {width:2,height:2,length:4,startIndex:0,
   prev:Int32Array.from([0,0,0,0,-1,-1,-1,-1]),
   changes:Uint8Array.from([0,0,0,0,0,0,0,0]),
   jump:Uint8Array.from([0,0,0,0,0,0,0,0])};
}
function fixture(id,canCut=false,canSurf=false){
 const grid={width:2,height:2,romSha256:'a'.repeat(64)},
   bits=Uint8Array.of(id==='land'?1:0),
   tiles=Uint8Array.of(id==='cut'?0x3d:id==='water'?0x14:0,0,0,0);
 return {grid,direction:'east',reachNormal:reach(),reachCut:reach(),
   reachSurf:reach(),reachBoth:reach(),canCut,canSurf,
   alignment:{descriptorPointerMatches:true,referenceOffsetCorroborated:true,
     direction:'east',sourceWidthTiles:2,sourceHeightTiles:2,
     destinationWidthTiles:2,destinationHeightTiles:2,offsetBlocks:0},
   destinationGrid:{width:2,height:2,romSha256:grid.romSha256,
     bits,tiles,tilesetId:0},maxCandidates:4};
}
test('water destination is not falsely marked immediately usable',()=>{
 const a=outdoorBoundaryCandidates(fixture('water',false,false));
 assert.equal(a.verified,true);
 const candidate=a.borderTiles.find(x=>x.destinationTile?.x===0);
 assert.ok(candidate);
 assert.equal(candidate.destinationRequiresSurf,true);
 assert.equal(candidate.destinationCapabilityStatus,'SURF_NOT_AVAILABLE');
 assert.equal(candidate.destinationEntryUsableNow,null);
 assert.equal(candidate.borderTransitionProven,false);
});
test('Cut destination remains action-unobserved even with known Cut capability',()=>{
 const a=outdoorBoundaryCandidates(fixture('cut',true,false));
 assert.equal(a.verified,true);
 assert.equal(a.borderTiles[0].destinationRequiresCut,true);
 assert.equal(a.borderTiles[0].destinationCapabilityStatus,
   'CUT_ABILITY_KNOWN_ACTION_UNOBSERVED');
 assert.equal(a.borderTiles[0].destinationEntryUsableNow,null);
});
test('ordinary land destination remains hypothetical until transition observed',()=>{
 const a=outdoorBoundaryCandidates(fixture('land'));
 assert.equal(a.verified,true);
 assert.equal(a.borderTiles[0].destinationCapabilityStatus,'STATIC_LAND_POSSIBLE');
 assert.equal(a.borderTiles[0].borderTransitionProven,false);
});
