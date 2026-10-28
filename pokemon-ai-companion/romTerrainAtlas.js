'use strict';
// PokéGuide — physical terrain grid read from the 3 original, exact, 1 MiB ROMs.
// Each 32x32 block is 4x4 8px tiles; 16px collision cells test their bottom-left 8px tile.
// DO NOT confuse static passable terrain with safe access in the live game.
const crypto=require('node:crypto');
const BANK=16384,ROM_BYTES=1048576,TILESETS=24,TILESET_HEADER=3*BANK+0x7be;
const EXPECTED=new Map([
 ['5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',48504],
 ['2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',48504],
 ['aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db',48570]
]);
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const checkInt=(n,l,h)=>Number.isInteger(n)&&n>=l&&n<=h;
const fail=(reason,detail)=>({verified:false,reason,detail:detail??null,semanticsCertified:false});
function readRomTerrain(rom,world){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_BYTES)return fail('ROM de 1 MiB não disponível');
 const sha=sha256(rom),expectedWalkable=EXPECTED.get(sha);
 if(expectedWalkable===undefined)return fail('SHA-256 da ROM não consta do conjunto auditado');
 const maps=world?.maps;
 if(maps?.valid!==true||!Array.isArray(maps.data)||maps.data.length!==248||
   maps.data.some((m,id)=>m.mapId!==id))return fail('Catálogo de 248 IDs de mapa não confirmado');
 const tileSets=[];
 for(let id=0;id<TILESETS;id++){
  const base=TILESET_HEADER+id*12,bank=rom[base];
  const blockCpu=rom.readUInt16LE(base+1),gfxCpu=rom.readUInt16LE(base+3),collCpu=rom.readUInt16LE(base+5);
  if(!checkInt(bank,1,63)||!checkInt(blockCpu,0x4000,0x7fff)||
     !checkInt(gfxCpu,0x4000,0x7fff)||!checkInt(collCpu,0x1000,0x3fff))
   return fail('Cabeçalho de tileset incompatível',id);
  const collisionIds=[];let at=collCpu,terminated=false;
  for(let n=0;n<96&&at<0x4000;n++,at++){
   const t=rom[at];if(t===255){terminated=true;break;}
   if(t>=0x60||collisionIds.includes(t))return fail('Colisão com tile ID inválido ou duplicado',id);
   collisionIds.push(t);
  }
  if(!terminated||!collisionIds.length)return fail('Tabela de colisões incompleta',id);
  tileSets.push({id,sourceBank:bank,blockPointerCpu:blockCpu,gfxPointerCpu:gfxCpu,
   collisionPointerCpu:collCpu,walkableTileIds:collisionIds,
   counterTileIds:[...rom.subarray(base+7,base+10)],
   grassTileId:rom[base+10],animationByte:rom[base+11],
   sourceFileOffset:base,walkableTileIdCount:collisionIds.length});
 }
 const results=[],usedSets=new Set();let passable=0,cells=0,blockCount=0;
 for(const m of maps.data){
  if(!m.valid)continue;
  if(!checkInt(m.tilesetId,0,23)||!checkInt(m.mapBank,1,63)||
     !checkInt(m.mapHeaderPointerCpu,0x4000,0x7fff)||
     !checkInt(m.blocksPointerCpu,0x4000,0x7fff))return fail('Metadados de mapa inválidos',m.mapId);
  const width=m.widthBlocks??m.widthTiles/2,height=m.heightBlocks??m.heightTiles/2;
  if(!checkInt(width,1,80)||!checkInt(height,1,80)||
     (m.widthTiles!==undefined&&m.widthTiles!==2*width)||
     (m.heightTiles!==undefined&&m.heightTiles!==2*height))return fail('Dimensões de mapa inválidas',m.mapId);
  const header=m.mapBank*BANK+m.mapHeaderPointerCpu-0x4000;
  const blocksAt=m.mapBank*BANK+m.blocksPointerCpu-0x4000;
  if(header+5>(m.mapBank+1)*BANK||blocksAt+width*height>(m.mapBank+1)*BANK||
     rom[header]!==m.tilesetId||rom[header+1]!==height||rom[header+2]!==width||
     rom.readUInt16LE(header+3)!==m.blocksPointerCpu)
   return fail('Mapa não coincide com o cabeçalho binário',m.mapId);
  const blocks=rom.subarray(blocksAt,blocksAt+width*height);
  const blockSha=sha256(blocks);
  if(m.blockSha256&&m.blockSha256!==blockSha)return fail('Mapa e matriz de blocos têm SHA divergentes',m.mapId);
  if(typeof m.blockDataBase64==='string'&&!blocks.equals(Buffer.from(m.blockDataBase64,'base64')))
   return fail('Matriz de blocos importada diverge da ROM',m.mapId);
  const ts=tileSets[m.tilesetId],walkable=new Set(ts.walkableTileIds),
   gridW=width*2,gridH=height*2,cellCount=gridW*gridH;
  const bitset=Buffer.alloc(Math.ceil(cellCount/8)),tileIds=Buffer.alloc(cellCount);
  let landWalkable=0;
  for(let y=0;y<gridH;y++)for(let x=0;x<gridW;x++){
   const blockId=blocks[Math.floor(y/2)*width+Math.floor(x/2)];
   // The collision tile of every 16×16 player cell is its bottom-left 8×8 tile.
   const tileOffset=4+(y%2)*8+(x%2)*2;
   const off=ts.sourceBank*BANK+ts.blockPointerCpu-0x4000+blockId*16+tileOffset;
   if(off<ts.sourceBank*BANK||off>=(ts.sourceBank+1)*BANK)
    return fail('ID de metabloco ultrapassa o banco do tileset',m.mapId);
   const tileId=rom[off];if(tileId>=0x60)return fail('Tileset contém ID gráfico fora de 0x00–0x5F',m.mapId);
   const index=y*gridW+x;tileIds[index]=tileId;
   if(walkable.has(tileId)){bitset[index>>3]|=1<<(index&7);landWalkable++;}
  }
  usedSets.add(m.tilesetId);passable+=landWalkable;cells+=cellCount;blockCount+=blocks.length;
  results.push({mapId:m.mapId,tilesetId:m.tilesetId,width: gridW,height:gridH,
   numberOfCells:cellCount,landTerrainWalkableCells:landWalkable,
   landTerrainBlockedCells:cellCount-landWalkable,
   tileIdsBase64:tileIds.toString('base64'),tileIdsSha256:sha256(tileIds),
   walkingBitsBase64:bitset.toString('base64'),walkingBitsSha256:sha256(bitset),
   blockDataSha256:blockSha,source:'EXACT_SHA256_ROM_TILESET_BLOCKS_COLLISION_TILE_IDS',
   liveSpriteGatesVerified:false,waterMovementVerified:false,ledgePairsVerified:false,
   currentPositionVerified:false,pathAccessibilityVerified:false});
 }
 if(results.length!==226||usedSets.size!==24||blockCount!==23783||
    cells!==95132||passable!==expectedWalkable)
  return fail('Cobertura ou contagem de terreno não coincide com as ROMs originais',
   {maps:results.length,tilesets:usedSets.size,blocks:blockCount,cells,passable,expectedWalkable});
 return {verified:true,romSha256:sha,source:'THREE_AUDITED_SHA256_ROM_BINARIES',
  tilesets:tileSets,maps:results,
  totals:{tilesets:24,maps:226,metablocks:blockCount,terrainCells:cells,
   walkableLandTerrainCells:passable,blockedLandTerrainCells:cells-passable},
  semanticsCertified:false,walkabilityType:'LAND_TILESET_BASE_ONLY',
  warnings:['Passável apenas de acordo com a lista estática do tileset',
   'Não inclui colisões com sprites, alterações por scripts, Surf, Strength, Cut, ledges ou estado de evento',
   'Este índice não demonstra percurso real nem pode prever colisões em tempo real']};
}
function inspectTerrainCell(map,x,y){
 if(!map||!checkInt(map.width,1,160)||!checkInt(map.height,1,160)||
    !checkInt(x,0,map.width-1)||!checkInt(y,0,map.height-1)||
    typeof map.tileIdsBase64!=='string'||typeof map.walkingBitsBase64!=='string')
  return fail('Célula ou matriz de tiles não verificada');
 const tiles=Buffer.from(map.tileIdsBase64,'base64'),bits=Buffer.from(map.walkingBitsBase64,'base64');
 if(tiles.length!==map.width*map.height||bits.length!==Math.ceil(tiles.length/8)||
    sha256(tiles)!==map.tileIdsSha256||sha256(bits)!==map.walkingBitsSha256)
  return fail('Integridade do mapa de colisões inválida');
 const i=y*map.width+x;
 return {verified:true,mapId:map.mapId,x,y,tileId:tiles[i],
  passableByStaticLandTileset:Boolean(bits[i>>3]&(1<<(i&7))),
  playerCanWalkHereNow:null,activeTerrainGatesVerified:false,
  source:'SHA_VERIFIED_TERRAIN_GRID_ONLY'};
}
// Shortest *static-terrain-only* walking path; excludes moving NPCs,
// ledge-direction rules, scene flags, Surf, scripts and warps. Never treat
// an absent static path as proof a destination is unreachable in the game.
function findTerrainRoute(map,from,to,{maxSteps=2000}={}){
 if(!map||!map.source||!checkInt(map.width,1,160)||!checkInt(map.height,1,160)||
    !checkInt(maxSteps,1,5000)||!from||!to||
    !checkInt(from.x,0,map.width-1)||!checkInt(from.y,0,map.height-1)||
    !checkInt(to.x,0,map.width-1)||!checkInt(to.y,0,map.height-1))
  return fail('Mapa/posições não validados para percurso de terreno');
 const bits=Buffer.from(map.walkingBitsBase64||'','base64');
 if(bits.length!==Math.ceil(map.width*map.height/8)||
    sha256(bits)!==map.walkingBitsSha256)return fail('Bitmap de terreno não confirmado');
 const width=map.width,limit=map.width*map.height,
  start=from.y*width+from.x,end=to.y*width+to.x;
 const walkable=i=>Boolean(bits[i>>3]&(1<<(i&7)));
 if(!walkable(start)||!walkable(end))return {
  verified:false,source:'STATIC_LAND_TILESET_ONLY',reason:'Origem ou destino estático não caminhável',
  inaccessibleInLiveGameProven:false};
 const queue=new Int32Array(limit),previous=new Int32Array(limit).fill(-1);
 let head=0,tail=0;queue[tail++]=start;previous[start]=start;
 while(head<tail){
  const i=queue[head++],x=i%width,y=Math.floor(i/width);
  if(i===end)break;
  const neighbors=[];
  if(y>0)neighbors.push(i-width);
  if(x+1<width)neighbors.push(i+1);
  if(y+1<map.height)neighbors.push(i+width);
  if(x>0)neighbors.push(i-1);
  for(const n of neighbors)if(previous[n]===-1&&walkable(n)){
   previous[n]=i;queue[tail++]=n;
  }
 }
 if(previous[end]===-1)return {verified:false,source:'STATIC_LAND_TILESET_ONLY',
  reason:'Não foi encontrado caminho apenas com colisão de terreno estático',
  inaccessibleInLiveGameProven:false};
 const route=[];for(let i=end;i!==start;i=previous[i])route.push({x:i%width,y:Math.floor(i/width)});
 route.push({...from});route.reverse();
 if(route.length-1>maxSteps)return {verified:false,
  reason:'Caminho de terreno mais longo do que o limite pedido',
  shortestTerrainLength:route.length-1,inaccessibleInLiveGameProven:false};
 return {verified:true,mapId:map.mapId,path:route,stepsOnStaticTerrain:route.length-1,
  routeNavigableNowProven:false,accessibilityFromRam:null,
  landTilePairRulesApplied:false,objectsAndScriptsApplied:false,
  source:'EXACT_ROM_SHA256_TERRAIN_ONLY',
  warning:'Percurso de terreno teórico: não inclui objetos, pessoas, ledges, eventos, Surf nem obstáculos dinâmicos'};
}
module.exports={readRomTerrain,inspectTerrainCell,findTerrainRoute,EXPECTED};