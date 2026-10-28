'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {readRom}=require('../romComprehensiveAudit');
const {auditTerrainCollision,terrainTileAt,terrainStepEvidence,matchDerivedTerrain}=require('../romTerrainCollision');
const input={red:process.env.POKEMON_RED_ROM,blue:process.env.POKEMON_BLUE_ROM,green:process.env.POKEMON_GREEN_ROM};
const atlasPath=process.env.POKEGUIDE_ATLAS_JSON;
const ready=atlasPath&&fs.existsSync(atlasPath)&&Object.values(input).every(f=>f&&fs.existsSync(f));
const exact=ready?JSON.parse(fs.readFileSync(atlasPath,'utf8')).variants:null;
const audits={};
for(const name of ['red','blue','green'])test(name+': 24 tilesets, all 226 maps and 95,132 collision samples from exact ROM',
 {skip:!ready?'Provide original ROM paths and previous SHA-pinned atlas':false},()=>{
 const rom=readRom(input[name]),maps={valid:true,data:exact[name].catalogue.maps};
 const r=auditTerrainCollision(rom,maps);assert.equal(r.verified,true,r.reason);
 audits[name]=r;
 assert.equal(r.decodedMapCount,226);assert.equal(r.tilesetCount,24);
 assert.equal(r.logicalTiles,95132);assert.equal(r.sourceBlockCount,23783);
 assert.equal(r.basePassable+r.baseBlocked,95132);
 assert.equal(r.landPairs.length,11);assert.equal(r.waterPairs.length,3);
 assert.equal(r.maps.reduce((s,m)=>s+m.byteCount,0),95132);
 for(const m of r.maps){
   const grid=zlib.inflateRawSync(Buffer.from(m.tileIdsDeflateBase64,'base64'));
   assert.equal(grid.length,m.widthTiles*m.heightTiles);
   assert.equal(grid.every(tile=>tile<=95),true);
 }
});
test('three SHA-pinned ROMs: Green differs on precisely three map IDs and preserves terrain distinctions',
 {skip:!ready?'Original ROM paths required':false},()=>{
 const [r,b,g]=['red','blue','green'].map(n=>audits[n]);
 assert.deepEqual(r.maps.map(m=>m.tileSha256),b.maps.map(m=>m.tileSha256));
 let mismatches=0,blockedDelta=0,maps=[];
 for(let i=0;i<r.maps.length;i++){
  const a=r.maps[i],c=g.maps[i];assert.equal(a.mapId,c.mapId);
  const aa=zlib.inflateRawSync(Buffer.from(a.tileIdsDeflateBase64,'base64'));
  const gg=zlib.inflateRawSync(Buffer.from(c.tileIdsDeflateBase64,'base64'));
  let count=0;
  for(let k=0;k<aa.length;k++){
   if(aa[k]!==gg[k]){mismatches++;count++;}
   const p1=r.tilesets[a.tilesetId].landPassableTileIds.includes(aa[k]);
   const p2=g.tilesets[c.tilesetId].landPassableTileIds.includes(gg[k]);
   if(p1!==p2)blockedDelta++;
  }
  if(count)maps.push(a.mapId);
 }
 assert.deepEqual(maps,[226,227,228]);assert.equal(mismatches,950);assert.equal(blockedDelta,642);
});
test('actual 16x16 player collision lower-left tile can be queried, with dynamic state withheld',
 {skip:!ready?'Original ROM paths required':false},()=>{
 const t=terrainTileAt(audits.red,0,0,0);
 assert.equal(t.verified,true);assert.equal(t.tileId,0x2c);
 assert.equal(t.landBasePassable,true);assert.equal(t.walkableNowVerified,false);
 const next=terrainStepEvidence(audits.red,0,{x:0,y:0},{x:1,y:0});
 assert.equal(next.verified,true);assert.equal(next.walkableNowVerified,false);
 assert.equal(terrainStepEvidence(audits.red,0,{x:0,y:0},{x:2,y:0}).verified,false);
});
test('ROM corruption or mismatched map block hash fail closed',
 {skip:!ready?'Original ROM paths required':false},()=>{
 const rom=readRom(input.red);
 const fake=Buffer.from(rom);fake[0xC7BE]^=1;
 assert.equal(auditTerrainCollision(fake,{valid:true,data:exact.red.catalogue.maps}).verified,false);
 const maps=structuredClone(exact.red.catalogue.maps);maps[0].blockSha256='0'.repeat(64);
 const invalid=auditTerrainCollision(rom,{valid:true,data:maps});
 assert.equal(invalid.verified,false);assert.match(invalid.reason,/SHA/);
});
test('corrupt compressed grid and out-of-map coordinates fail closed',
 {skip:!ready?'Original ROM paths required':false},()=>{
 const v=structuredClone(audits.red);v.maps[0].tileIdsDeflateBase64='000000';
 assert.equal(terrainTileAt(v,0,0,0).verified,false);
 assert.equal(terrainTileAt(audits.red,0,500,0).verified,false);
 assert.equal(terrainTileAt(audits.red,11,0,0).verified,false);
});

const catalog=require('../data/gen1TerrainCollisionAudited.json');
test('derived catalogue passes only with 226 matching map source SHA-256 hashes and exact ROM identity',()=>{
 for(const name of ['red','blue','green']){
  const r=audits[name];if(!r)return;
  const profile={hash:{sha256:r.romSha256},world:{maps:{valid:true,data:exact[name].catalogue.maps}}};
  const matched=matchDerivedTerrain(profile,catalog);
  assert.equal(matched?.verified,true);
  assert.equal(matched.runtimeRomSha256Verified,false);
  assert.equal(terrainTileAt(matched,0,0,0).verified,true);
  const tampered=structuredClone(profile);tampered.world.maps.data[0].blockSha256='0'.repeat(64);
  assert.equal(matchDerivedTerrain(tampered,catalog),null);
 }
});
test('forged variant, missing map list or corrupt derived map tile data is refused',()=>{
 const r=audits.red;if(!r)return;
 const profile={hash:{sha256:r.romSha256},world:{maps:{valid:true,data:exact.red.catalogue.maps}}};
 assert.equal(matchDerivedTerrain({...profile,hash:{sha256:'0'.repeat(64)}},catalog),null);
 assert.equal(matchDerivedTerrain({...profile,world:{maps:{valid:true,data:[]}}},catalog),null);
 const matched=matchDerivedTerrain(profile,catalog);
 const corrupt=structuredClone(matched);corrupt.maps[0].tileSha256='a'.repeat(64);
 assert.equal(terrainTileAt(corrupt,0,0,0).verified,false);
});