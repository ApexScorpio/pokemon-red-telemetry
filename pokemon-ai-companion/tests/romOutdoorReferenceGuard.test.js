'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyOutdoorConnectionVariant}=require('../romOutdoorReferenceGuard');
const reference=require('../data/gen1OutdoorConnectionsAudited.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const keys=Object.keys(reference.versions);
const graph=sha=>({verified:true,romSha256:sha,
  outdoorConnections:clone(reference.versions[sha])});
test('all 78 exact descriptors from each of the three ROM variants match',()=>{
 assert.equal(keys.length,3);
 for(const sha of keys){
   const r=verifyOutdoorConnectionVariant({warpGraph:graph(sha),romSha256:sha});
   assert.equal(r.verified,true);
   assert.equal(r.matchingDescriptors,78);
   assert.equal(r.borderAlignmentVerified,false);
   assert.equal(r.currentTraversalProven,false);
 }
});
test('reordered but identical edges still preserve a complete matching atlas',()=>{
 const sha=keys[0],x=graph(sha);
 x.outdoorConnections.edges.reverse();
 assert.equal(verifyOutdoorConnectionVariant({warpGraph:x,romSha256:sha}).verified,true);
});
test('one changed target, direction or file offset invalidates all border evidence',()=>{
 const sha=keys[0];
 for(const field of ['destinationMapId','direction','sourceFileOffset',
   'destinationBlockPointerCpu','destinationWidthBlocks']){
   const x=graph(sha);
   x.outdoorConnections.edges[0][field]=
     field==='direction'?'west':x.outdoorConnections.edges[0][field]+1;
   const r=verifyOutdoorConnectionVariant({warpGraph:x,romSha256:sha});
   assert.equal(r.verified,false);
 }
});
test('duplicate border and missing header refuse a fake 78 edge total',()=>{
 const sha=keys[0],a=graph(sha);
 a.outdoorConnections.edges[1]=clone(a.outdoorConnections.edges[0]);
 assert.equal(verifyOutdoorConnectionVariant({warpGraph:a,romSha256:sha}).verified,false);
 const b=graph(sha);b.outdoorConnections.edges.pop();
 assert.equal(verifyOutdoorConnectionVariant({warpGraph:b,romSha256:sha}).verified,false);
});
test('unknown or mixed-ROM graph cannot inherit valid border crossings',()=>{
 const sha=keys[0],blue=keys[1];
 assert.equal(verifyOutdoorConnectionVariant({
   warpGraph:graph(sha),romSha256:blue}).verified,false);
 assert.equal(verifyOutdoorConnectionVariant({
   warpGraph:graph(sha),romSha256:'0'.repeat(64)}).verified,false);
});
test('source destination descriptors remain explicit about unknown passability',()=>{
 for(const sha of keys){
   const r=reference.versions[sha];
   assert.equal(r.edges.every(x=>x.pathAccessProven===false&&
     x.currentBorderCoordinatesProven===false&&
     x.descriptorSize===11),true);
 }
});
