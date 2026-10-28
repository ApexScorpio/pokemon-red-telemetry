'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {readRom}=require('../romComprehensiveAudit');
const {readCollisionAtlas,terrainAt,pairBoundaryBlocked}=require('../romTilesetCollisionAudit');
const dir=process.env.POKEMON_ROM_DIR;
const sources={
 red:process.env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon - Red Version (UE)[!].zip')),
 blue:process.env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
 green:process.env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon%20Green%20International%20v1.2.1.gb'))
};
const atlasFile=process.env.POKEGUIDE_ATLAS_JSON;
const ready=atlasFile&&fs.existsSync(atlasFile)&&Object.values(sources).every(p=>p&&fs.existsSync(p));
const catalogue=ready?JSON.parse(fs.readFileSync(atlasFile,'utf8')):null;
const expected={red:48504,blue:48504,green:48570};
for(const label of Object.keys(sources)){
 test('ROM '+label+': complete collision table, 24 tilesets, 226 maps and 95132 tiles',
  {skip:!ready?'Original ROMs and source atlas required':false},()=>{
   const rom=readRom(sources[label]),variant=catalogue.variants[label];
   const out=readCollisionAtlas(rom,{valid:true,data:variant.catalogue.maps});
   assert.equal(out.verified,true,out.reason);
   assert.equal(out.romSha256,variant.identity.sha256);
   assert.deepEqual(out.totals,{tilesets:24,normalMaps:226,mapBlockCells:23783,
    characterCells:95132,terrainAllowedCells:expected[label],
    terrainDisallowedCells:95132-expected[label],
    uniqueReferencedMetablocks:label==='green'?1193:1194,
    landBlockedPairs:11,waterBlockedPairs:3});
   assert.equal(out.tilesets.length,24);
   assert.equal(out.mapTerrain.length,226);
   assert.equal(out.tilesets[0].walkableTileIds.length,19);
   assert.equal(out.tilesets[0].grassTileId,0x52);
   assert.equal(out.tilesets[11].walkableTileIds.length,5);
   assert.equal(out.pairCollisions.land.length,11);
   assert.equal(out.pairCollisions.water.length,3);
   assert.equal(out.tilesets.every(x=>x.requiredBlockTableSha256.length===64),true);
   assert.equal(out.mapTerrain.every(x=>x.movementFullyCertified===false),true);
   const map0=out.mapTerrain.find(x=>x.mapId===0);
   assert.equal(map0.widthTiles,20);assert.equal(map0.heightTiles,18);
   assert.equal(terrainAt(out,0,5,5).verified,true);
   assert.equal(terrainAt(out,0,500,0).verified,false);
   const pair=pairBoundaryBlocked(out,17,0x20,0x05);
   assert.equal(pair.verified,true);assert.equal(pair.blockedByStaticPair,true);
   assert.equal(pair.transitionFullyCertified,false);
   assert.equal(pairBoundaryBlocked(out,17,0x05,0x20).blockedByStaticPair,true);
   assert.equal(pairBoundaryBlocked(out,17,0x20,0x20).blockedByStaticPair,false);
   assert.equal(pairBoundaryBlocked(out,3,0x14,0x2e,'water').blockedByStaticPair,true);
   assert.equal(pairBoundaryBlocked(out,3,0x14,0x2e,'land').blockedByStaticPair,false);
  });
}
test('fail closed for unknown/truncated ROM and missing map evidence',()=>{
 const unknown=Buffer.alloc(1048576);
 assert.equal(readCollisionAtlas(unknown,{valid:true,data:Array(248)}).verified,false);
 assert.equal(readCollisionAtlas(Buffer.alloc(16384),{valid:true,data:Array(248)}).verified,false);
 assert.equal(readCollisionAtlas(Buffer.alloc(1048576)).verified,false);
 assert.equal(terrainAt(null,0,0,0).verified,false);
 assert.equal(pairBoundaryBlocked(null,0,0,0).verified,false);
});
test('fixture: collision query never promotes terrain whitelist to live walkability',()=>{
 const a={verified:true,mapTerrain:[{mapId:0,tilesetId:3,widthTiles:2,heightTiles:2,
  collisionTilesBase64:Buffer.from([30,31,32,33]).toString('base64'),
  terrainAllowMaskBase64:Buffer.from([0b1010]).toString('base64')}],
  pairCollisions:{land:[],water:[]}};
 const one=terrainAt(a,0,1,0),zero=terrainAt(a,0,0,0);
 assert.equal(one.tileId,31);assert.equal(one.terrainAllowed,true);
 assert.equal(one.currentlyWalkable,null);
 assert.equal(zero.tileId,30);assert.equal(zero.terrainAllowed,false);
});