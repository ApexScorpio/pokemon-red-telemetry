'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {annotateLastMap}=require('../romLastMapEvidence');
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const profile={hash:{sha256:SHA},world:{maps:{valid:true,data:Array.from({length:248},(_,mapId)=>({mapId,valid:mapId===0||mapId===37,
 objects:{warps:mapId===0?[{x:5,y:5}]:[{x:3,y:7}]}}))}}};
const guide={verified:true,romSha256:SHA,mapId:37,
 warps:[{x:2,y:7,map:255,warp:0,destinationMode:'LAST_MAP_FROM_RAM'},
  {x:3,y:8,map:0,warp:0,destinationMode:'STATIC_MAP_ID'}]};
test('matching D365 values annotate LAST_MAP target without claiming atomic RAM',()=>{
 const x=annotateLastMap(guide,profile,{firstByte:'00',secondByte:'00',mapSnapshotVerified:true});
 assert.equal(x.verified,true);assert.equal(x.resolvedLastMapId,0);
 assert.equal(x.resolvedWarpCount,1);assert.equal(x.guide.warps[0].resolvedMapId,0);
 assert.equal(x.guide.warps[0].landingX,5);assert.equal(x.guide.warps[0].map,255);
 assert.equal(x.guide.warps[0].accessibleNow,null);
 assert.equal(x.atomicSnapshotVerified,false);
 assert.equal(guide.warps[0].resolvedMapId,undefined);
});
test('changed D365 or map mismatch cannot publish stale dynamic destination',()=>{
 assert.equal(annotateLastMap(guide,profile,{firstByte:'00',secondByte:'25',mapSnapshotVerified:true}).verified,false);
 assert.equal(annotateLastMap(guide,profile,{firstByte:'00',secondByte:'00',mapSnapshotVerified:false}).verified,false);
 assert.equal(annotateLastMap(guide,profile,{firstByte:'ff',secondByte:'ff',mapSnapshotVerified:true}).verified,false);
});
test('unknown ROM and missing landing index fail closed',()=>{
 assert.equal(annotateLastMap(guide,{...profile,hash:{sha256:'0'.repeat(64)}},
  {firstByte:'00',secondByte:'00',mapSnapshotVerified:true}).verified,false);
 const broken=structuredClone(guide);broken.warps[0].warp=99;
 const r=annotateLastMap(broken,profile,{firstByte:'00',secondByte:'00',mapSnapshotVerified:true});
 assert.equal(r.verified,true);assert.equal(r.resolvedWarpCount,0);assert.equal(r.unresolvedWarpCount,1);
 assert.equal(r.guide.warps[0].ramResolvedDestinationVerified,false);
});