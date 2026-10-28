'use strict';
// Read-only, fail-closed 3-ROM audit. A missing ROM is a failure, not a skipped test.
const fs=require('node:fs'),path=require('node:path');
const {readRom}=require('../romComprehensiveAudit');
const {readRomTerrain}=require('../romTerrainAtlas');
const expected={
 red:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 blue:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 green:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'};
function main(){
 const dir=process.env.POKEMON_ROM_DIR;
 const filename={red:process.env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon - Red Version (UE)[!].zip')),
  blue:process.env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
  green:process.env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon%20Green%20International%20v1.2.1.gb'))};
 const atlasPath=process.env.POKEGUIDE_ATLAS_JSON;
 if(!atlasPath||!fs.existsSync(atlasPath)||Object.values(filename).some(f=>!f||!fs.existsSync(f)))
  throw Error('PROVA_NÃO_EXECUTADA: POKEGUIDE_ATLAS_JSON e as três ROMs originais são obrigatórios');
 const atlas=JSON.parse(fs.readFileSync(atlasPath,'utf8'));
 if(!atlas?.variants)throw Error('Atlas sem três variantes');
 let sumCells=0,sumPassable=0;
 for(const name of Object.keys(expected)){
  const b=readRom(filename[name]),ref=atlas.variants?.[name];
  if(!ref?.identity||ref.identity.sha256!==expected[name])throw Error(name+': atlas SHA incompatível');
  const t=readRomTerrain(b,{maps:{valid:true,data:ref.catalogue.maps}});
  if(!t.verified||t.romSha256!==expected[name]||t.maps.length!==226||
     t.tilesets.length!==24||t.landTilePairs?.length!==11||t.waterTilePairs?.length!==3||
     t.totals.terrainCells!==95132||t.totals.walkableLandTerrainCells!==(name==='green'?48570:48504))
    throw Error(name+': FAIL '+(t.reason||'contagens ROM distintas'));
  sumCells+=t.totals.terrainCells;sumPassable+=t.totals.walkableLandTerrainCells;
  process.stdout.write('PASS_REAL_ROM '+name+' '+t.romSha256+' maps=226 tilesets=24 cells=95132 walkable='+t.totals.walkableLandTerrainCells+'\n');
 }
 process.stdout.write('RESULTADO=3/3_ROMS_REAIS_VERIFICADAS cells='+sumCells+' walkable='+sumPassable+'\n');
}
try{main()}catch(e){console.error('RESULTADO=FALHOU '+e.message);process.exitCode=1;}