'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyTerrainVariant}=require('../romTerrainVariantGuard');
const r=require('../data/romTerrain_red.json');
const b=require('../data/romTerrain_blue.json');
const g=require('../data/romTerrain_green.json');
function profile(terrain){return {
 hash:{sha256:terrain.romSha256},
 world:{terrainAtlas:terrain}
};}
const clone=x=>JSON.parse(JSON.stringify(x));
test('all 226 maps and 95132 tiles match the three individual ROM archives',()=>{
 for(const archive of [r,b,g]){
   const v=verifyTerrainVariant(profile(archive));
   assert.equal(v.verified,true);
   assert.equal(v.verifiedMapCount,226);
   assert.equal(v.verifiedTerrainCells,95132);
   assert.equal(v.activeRomFullSha256Verified,false);
   assert.equal(v.runtimeAccessProven,false);
 }
});
test('Red and Blue are terrain-identical, Green differs only in 226,227,228',()=>{
 const hashes=x=>new Map(x.maps.map(m=>[m.mapId,m.tileIdsSha256+':'+m.walkingBitsSha256]));
 const R=hashes(r),B=hashes(b),G=hashes(g);
 assert.deepEqual([...R.keys()],[...B.keys()]);
 assert.deepEqual([...R.keys()],[...G.keys()]);
 assert.deepEqual([...R].filter(([id,v])=>B.get(id)!==v).map(x=>x[0]),[]);
 assert.deepEqual([...R].filter(([id,v])=>G.get(id)!==v).map(x=>x[0]),
   [226,227,228]);
});
test('Green profile containing the Red terrain of map 226 is rejected',()=>{
 const mixed=clone(g);
 const wrong=r.maps.find(m=>m.mapId===226);
 mixed.maps[mixed.maps.findIndex(m=>m.mapId===226)]=wrong;
 const v=verifyTerrainVariant(profile(mixed));
 assert.equal(v.verified,false);
 assert.equal(v.mapId,226);
});
test('a Blue profile containing one Green map 228 is also rejected',()=>{
 const mixed=clone(b);
 mixed.maps[mixed.maps.findIndex(m=>m.mapId===228)]=
   g.maps.find(m=>m.mapId===228);
 const v=verifyTerrainVariant(profile(mixed));
 assert.equal(v.verified,false);
 assert.equal(v.mapId,228);
});
test('missing or duplicated normal map fails closed',()=>{
 const fewer=clone(r);fewer.maps.pop();
 assert.equal(verifyTerrainVariant(profile(fewer)).verified,false);
 const dup=clone(r);dup.maps[1]=dup.maps[0];
 assert.equal(verifyTerrainVariant(profile(dup)).verified,false);
});
test('profile identity, tampered fingerprint and unknown ROM are rejected',()=>{
 const invalid=profile(r);invalid.hash.sha256='0'.repeat(64);
 assert.equal(verifyTerrainVariant(invalid).verified,false);
 const bad=clone(r);bad.maps[15].walkingBitsSha256='0'.repeat(64);
 assert.equal(verifyTerrainVariant(profile(bad)).mapId,15);
 const unknown=profile(r);unknown.unknownLayout=true;
 assert.equal(verifyTerrainVariant(unknown).verified,false);
});
