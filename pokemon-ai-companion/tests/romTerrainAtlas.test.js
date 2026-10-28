'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readRom}=require('../romComprehensiveAudit');
const {readRomTerrain,inspectTerrainCell,findTerrainRoute}=require('../romTerrainAtlas');
const dir=process.env.POKEMON_ROM_DIR;
const files={
 red:process.env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon - Red Version (UE)[!].zip')),
 blue:process.env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
 green:process.env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon%20Green%20International%20v1.2.1.gb'))};
const atlasFile=process.env.POKEGUIDE_ATLAS_JSON;
const ready=atlasFile&&fs.existsSync(atlasFile)&&Object.values(files).every(f=>f&&fs.existsSync(f));
const known={
 red:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 blue:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 green:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'};
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [variant,filename] of Object.entries(files)){
 test('real ROM '+variant+': 24 tilesets, 226 maps and 95132 terrain cells',
  {skip:!ready?'Original ROMs + POKEGUIDE_ATLAS_JSON required':false},()=>{
   const b=readRom(filename),a=JSON.parse(fs.readFileSync(atlasFile,'utf8'));
   assert.equal(sha256(b),known[variant]);
   const terrain=readRomTerrain(b,{maps:{valid:true,data:a.variants[variant].catalogue.maps}});
   assert.equal(terrain.verified,true,terrain.reason+' '+JSON.stringify(terrain.detail));
   assert.equal(terrain.tilesets.length,24);assert.equal(terrain.maps.length,226);
   assert.equal(terrain.totals.metablocks,23783);
   assert.equal(terrain.totals.terrainCells,95132);
   assert.equal(terrain.totals.walkableLandTerrainCells,variant==='green'?48570:48504);
   assert.equal(terrain.totals.blockedLandTerrainCells,variant==='green'?46562:46628);
   const pallet=terrain.maps.find(m=>m.mapId===0);
   assert.equal(pallet.width,20);assert.equal(pallet.height,18);
   const p=inspectTerrainCell(pallet,0,0);
   assert.equal(p.verified,true);assert.equal(p.playerCanWalkHereNow,null);
   // One adjacent pair allowed by terrain must produce a one-step *theoretical* route.
   let step=null;
   for(let y=0;y<pallet.height&&step===null;y++)for(let x=0;x+1<pallet.width;x++){
    const one=inspectTerrainCell(pallet,x,y),two=inspectTerrainCell(pallet,x+1,y);
    if(one.passableByStaticLandTileset&&two.passableByStaticLandTileset){
      step=findTerrainRoute(pallet,{x,y},{x:x+1,y});break;
    }
   }
   assert.ok(step,'Expected adjacent walkable terrain pair');
   assert.equal(step.verified,true);assert.equal(step.stepsOnStaticTerrain,1);
   assert.equal(step.routeNavigableNowProven,false);
 });
}
test('pure 5x3 terrain route is theoretical; barriers respected',()=>{
 const width=5,height=3,tiles=Buffer.alloc(15,1),bits=Buffer.alloc(2);
 for(const i of [0,1,2,3,4,5,9,10,11,12,13,14])bits[i>>3]|=1<<(i&7);
 const m={mapId:42,width,height,source:'TEST_GRID',tileIdsBase64:tiles.toString('base64'),
  tileIdsSha256:sha256(tiles),walkingBitsBase64:bits.toString('base64'),walkingBitsSha256:sha256(bits)};
 const route=findTerrainRoute(m,{x:0,y:1},{x:4,y:1});
 assert.equal(route.verified,true);assert.equal(route.stepsOnStaticTerrain,6);
 assert.equal(route.routeNavigableNowProven,false);
 assert.equal(findTerrainRoute(m,{x:0,y:1},{x:1,y:1}).verified,false);
 assert.equal(inspectTerrainCell(m,0,0).verified,true);
 const forged={...m,walkingBitsSha256:'0'.repeat(64)};
 assert.equal(findTerrainRoute(forged,{x:0,y:1},{x:4,y:1}).verified,false);
 assert.equal(inspectTerrainCell(forged,0,0).verified,false);
});
test('ROM data cannot be silently altered without invalidating terrain evidence',
 {skip:!ready?'Original ROMs + atlas required':false},()=>{
 const b=readRom(files.blue),a=JSON.parse(fs.readFileSync(atlasFile,'utf8'));
 b[0x5000]^=1;
 assert.equal(readRomTerrain(b,{maps:{valid:true,data:a.variants.blue.catalogue.maps}}).verified,false);
 const real=readRom(files.blue),wrong=structuredClone(a.variants.blue.catalogue.maps);
 wrong[0].blocksPointerCpu++;
 assert.equal(readRomTerrain(real,{maps:{valid:true,data:wrong}}).verified,false);
});