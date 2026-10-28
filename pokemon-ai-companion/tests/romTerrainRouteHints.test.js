'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {terrainWarpHints}=require('../romTerrainRouteHints');
const {readRom}=require('../romComprehensiveAudit'),{readRomTerrain}=require('../romTerrainAtlas');
const dir=process.env.POKEMON_ROM_DIR;
const f={red:process.env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon - Red Version (UE)[!].zip')),
 blue:process.env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
 green:process.env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon%20Green%20International%20v1.2.1.gb'))};
const atlasFile=process.env.POKEGUIDE_ATLAS_JSON;
const ready=atlasFile&&fs.existsSync(atlasFile)&&Object.values(f).every(x=>x&&fs.existsSync(x));
for(const name of Object.keys(f))test('terrain exit previews on exact ROM '+name,
 {skip:!ready?'ROMs and atlas required':false},()=>{
  const atlas=JSON.parse(fs.readFileSync(atlasFile,'utf8')).variants[name],b=readRom(f[name]);
  const world={maps:{valid:true,data:atlas.catalogue.maps}};
  const t=readRomTerrain(b,world);assert.equal(t.verified,true);
  const map=t.maps.find(m=>m.mapId===0),blocks=atlas.catalogue.maps[0];
  const bits=Buffer.from(map.walkingBitsBase64,'base64');
  let first=-1;for(let i=0;i<map.numberOfCells;i++)if(bits[i>>3]&(1<<(i&7))){first=i;break;}
  assert.ok(first>=0);
  const guide={verified:true,romSha256:t.romSha256,mapId:0,terrain:{...map,verified:true},
   warps:blocks.objects.warps};
  const out=terrainWarpHints(guide,{x:first%map.width,y:Math.floor(first/map.width)});
  assert.equal(out.verified,true);assert.equal(out.candidates.length,guide.warps.length);
  assert.equal(out.routeNavigableNowProven,false);
  assert.ok(out.candidates.every(w=>w.accessibleNow===null&&!w.exactMovementRouteVerified));
});
test('invalid SHA, coords and missing matrix must refuse route recommendation',()=>{
 assert.equal(terrainWarpHints({verified:true,romSha256:'0'.repeat(64),terrain:{verified:true}}, {x:1,y:1}).verified,false);
});