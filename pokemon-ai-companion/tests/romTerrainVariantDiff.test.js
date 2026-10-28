'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compareTerrainVariants}=require('../romTerrainVariantDiff');
const a={red:require('../data/romTerrain_red.json'),
 blue:require('../data/romTerrain_blue.json'),green:require('../data/romTerrain_green.json')};
test('Red and Blue have identical static land collision matrices in 226 maps',()=>{
 const v=compareTerrainVariants(a.red,a.blue);
 assert.equal(v.verified,true,v.reason);assert.equal(v.cellsChanged,0);
 assert.equal(v.affectedMapIds.length,0);
});
test('Green has 642 changed tile passability cells, only in Cerulean Cave 226,227,228',()=>{
 const v=compareTerrainVariants(a.red,a.green);
 assert.equal(v.verified,true,v.reason);assert.equal(v.cellsChanged,642);
 assert.equal(v.passableAddedInSecond,354);assert.equal(v.passableRemovedInSecond,288);
 assert.equal(v.netAdditionalWalkableInSecond,66);
 assert.deepEqual(v.affectedMapIds,[226,227,228]);
 assert.equal(v.maps.reduce((n,m)=>n+m.cellsChanged,0),642);
 assert.equal(v.actualTraversalChangedProven,false);
});
test('backward Green to Red swaps added and removed while preserving 642 changes',()=>{
 const v=compareTerrainVariants(a.green,a.red);
 assert.equal(v.verified,true,v.reason);assert.equal(v.cellsChanged,642);
 assert.equal(v.passableAddedInSecond,288);assert.equal(v.passableRemovedInSecond,354);
});
test('forged terrain bitmap SHA invalidates variant comparison',()=>{
 const corrupt=JSON.parse(JSON.stringify(a.blue));
 corrupt.maps[0].walkingBitsSha256='0'.repeat(64);
 assert.equal(compareTerrainVariants(a.red,corrupt).verified,false);
});