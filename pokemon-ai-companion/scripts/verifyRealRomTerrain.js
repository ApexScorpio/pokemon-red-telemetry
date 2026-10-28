'use strict';
// Read-only, fail-closed 3-ROM audit. A missing ROM is a failure, not a skipped test.
const fs=require('node:fs'),path=require('node:path');
const {readRom}=require('../romComprehensiveAudit');
const {readRomTerrain}=require('../romTerrainAtlas');
const {readCollisionAtlas}=require('../romTilesetCollisionAudit');
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
  // Independent decoder: compare *every tile* instead of only the grand totals.
  // The 2 implementations use separate offset, block and collision parsers.
  const other=readCollisionAtlas(b,{valid:true,data:ref.catalogue.maps});
  if(!other.verified||other.romSha256!==expected[name]||
     other.totals.characterCells!==t.totals.terrainCells||
     other.totals.terrainAllowedCells!==t.totals.walkableLandTerrainCells)
    throw Error(name+': INDEPENDENT_DECODER_FAILED '+(other.reason||'count mismatch'));
  for(let i=0;i<24;i++){
    if(JSON.stringify(other.tilesets[i].walkableTileIds)!==
       JSON.stringify(t.tilesets[i].walkableTileIds))
      throw Error(name+': TILESET_PASSABLE_MISMATCH '+i);
  }
  const oldByMap=new Map(t.maps.map(m=>[m.mapId,m]));
  let compared=0;
  for(const m of other.mapTerrain){
    const old=oldByMap.get(m.mapId);
    if(!old||old.width!==m.widthTiles||old.height!==m.heightTiles)
      throw Error(name+': MAP_GEOMETRY_MISMATCH '+m.mapId);
    const tileBytes=Buffer.from(old.tileIdsBase64,'base64');
    const oldMask=Buffer.from(old.walkingBitsBase64,'base64');
    if(!tileBytes.equals(Buffer.from(m.collisionTilesBase64,'base64'))||
       !oldMask.equals(Buffer.from(m.terrainAllowMaskBase64,'base64')))
      throw Error(name+': TILE_BY_TILE_DIFFERENCE '+m.mapId);
    compared+=m.widthTiles*m.heightTiles;
  }
  const priorLand=t.landTilePairs.map(p=>[p.tilesetId,p.tile1,p.tile2]);
  const priorWater=t.waterTilePairs.map(p=>[p.tilesetId,p.tile1,p.tile2]);
  const otherLand=other.pairCollisions.land.map(p=>[p.tilesetId,p.first,p.second]);
  const otherWater=other.pairCollisions.water.map(p=>[p.tilesetId,p.first,p.second]);
  if(JSON.stringify(priorLand)!==JSON.stringify(otherLand)||
     JSON.stringify(priorWater)!==JSON.stringify(otherWater)||
     compared!==95132)
     throw Error(name+': PAIR_COLLISION_OR_COVERAGE_MISMATCH');
  sumCells+=t.totals.terrainCells;sumPassable+=t.totals.walkableLandTerrainCells;
  process.stdout.write('PASS_REAL_ROM '+name+' '+t.romSha256+' maps=226 tilesets=24 cells=95132 walkable='+t.totals.walkableLandTerrainCells+' independent_decoder_same_tiles=95132\n');
 }
 process.stdout.write('RESULTADO=3/3_ROMS_REAIS_VERIFICADAS cells='+sumCells+' walkable='+sumPassable+'\n');
}
try{main()}catch(e){console.error('RESULTADO=FALHOU '+e.message);process.exitCode=1;}