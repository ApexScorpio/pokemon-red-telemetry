'use strict';
// Pokémon Gen I: SHA-pinned ROM-only tile collision evidence. Tile IDs are
// extracted from 16-byte blockset entries; the engine samples the lower-left
// 8x8 tile of the 16x16 logical cell. Dynamic sprites, Surf, ledges, event
// scripts, map edges and emulator frame timing are NOT certified here.
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const ROM_SIZE=1048576,BANK=16384,HEADER=0xC7BE,NUMBER_TILESETS=24;
const SHA=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
]);
const DIRECTIONS=[[-1,0,'west'],[1,0,'east'],[0,-1,'north'],[0,1,'south']];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const validInt=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const u16=(b,i)=>b[i]|(b[i+1]<<8);
function fromCpu(bank,cpu){
 return validInt(bank,1,63)&&validInt(cpu,0x4000,0x7fff)?bank*BANK+cpu-0x4000:null;
}
function signedByte(b){return b>=128?b-256:b;}
function readCollisionList(rom,cpu){
 if(!validInt(cpu,0x0100,0x3fff))return null;
 const ids=[],seen=new Set();
 for(let i=cpu;i<Math.min(cpu+96,BANK);i++){
  if(rom[i]===255)return ids.length>0?ids:null;
  const x=rom[i];if(x>0x5f||seen.has(x))return null;
  seen.add(x);ids.push(x);
 }
 return null;
}
function readPairList(rom,offset,max){
 let i=offset;const pairs=[];
 while(i<offset+max*3+1){
  if(rom[i]===255)return pairs.length?pairs:null;
  if(i+2>=BANK)return null;
  const [tilesetId,a,b]=[rom[i],rom[i+1],rom[i+2]];
  if(tilesetId>=NUMBER_TILESETS||a>0x5f||b>0x5f)return null;
  pairs.push({tilesetId,tileA:a,tileB:b,romOffset:i});i+=3;
 }
 return null;
}
function readTilesets(rom){
 if(rom.length!==ROM_SIZE||!rom.subarray(HEADER,HEADER+5).equals(Buffer.from([0x19,0xe0,0x45,0,0x40])))
  return null;
 const tilesets=[];
 for(let id=0;id<NUMBER_TILESETS;id++){
  const p=HEADER+12*id,bank=rom[p],blockCpu=u16(rom,p+1),gfxCpu=u16(rom,p+3),collCpu=u16(rom,p+5);
  const blockOffset=fromCpu(bank,blockCpu),gfxOffset=fromCpu(bank,gfxCpu);
  const landPassable=readCollisionList(rom,collCpu);
  if(blockOffset===null||gfxOffset===null||!landPassable||
     ![0,1,2].includes(rom[p+11])||
     [...rom.subarray(p+7,p+11)].some(x=>x!==255&&x>0x5f))return null;
  tilesets.push({id,headerRomOffset:p,bank,blockCpu,gfxCpu,collCpu,
   blockFileOffset:blockOffset,gfxFileOffset:gfxOffset,grassTileId:rom[p+10],
   counterTileIds:[rom[p+7],rom[p+8],rom[p+9]],animationId:rom[p+11],
   landPassableTileIds:landPassable,collisionEndFileOffset:collCpu+landPassable.length});
 }
 return tilesets;
}
function auditTerrainCollision(rom,maps){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_SIZE||!maps?.valid||
    !Array.isArray(maps.data)||maps.data.length!==248)
  return {verified:false,reason:'ROM de 1 MiB ou 248 mapas não confirmados'};
 const sha=hash(rom);
 if(!SHA.has(sha))return {verified:false,reason:'SHA-256 desta ROM não auditado'};
 const tilesets=readTilesets(rom);
 const landPairs=readPairList(rom,0xc7e,11),waterPairs=readPairList(rom,0xca0,3);
 if(!tilesets||landPairs?.length!==11||waterPairs?.length!==3)
  return {verified:false,reason:'Cabeçalhos tileset, listas passáveis ou colisão por pares divergentes'};
 const result=[],byTileset=Object.fromEntries(Array.from({length:NUMBER_TILESETS},(_,t)=>[t,{maps:0,tiles:0}]));
 let sourceBlockCount=0,logicalTiles=0,basePassable=0;
 for(let id=0;id<maps.data.length;id++){
  const m=maps.data[id];
  if(m.mapId!==id)return {verified:false,reason:'IDs de mapa não sequenciais em '+id};
  if(!m.valid)continue;
  const t=tilesets[m.tilesetId],w=m.widthTiles,h=m.heightTiles;
  if(!t||!validInt(w,2,160)||!validInt(h,2,160)||(w%2)||(h%2)||
     !validInt(m.mapBank,1,63)||!validInt(m.blocksPointerCpu,0x4000,0x7fff))
   return {verified:false,reason:'Dimensões ou tileset inválidos no mapa '+id};
  const bw=w/2,bh=h/2,blockCount=bw*bh,blockOff=fromCpu(m.mapBank,m.blocksPointerCpu);
  if(blockOff===null||blockOff+blockCount>(m.mapBank+1)*BANK)
   return {verified:false,reason:'Ponteiro do mapa fora do banco '+id};
  const blocks=rom.subarray(blockOff,blockOff+blockCount);
  if(hash(blocks)!==m.blockSha256)return {verified:false,reason:'SHA de blocos do mapa '+id+' não coincide'};
  const tileBytes=Buffer.alloc(w*h),passSet=new Set(t.landPassableTileIds);
  let ownPassable=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const blockId=blocks[Math.floor(y/2)*bw+Math.floor(x/2)];
   const tileAt=t.blockFileOffset+blockId*16+(y%2*2+1)*4+x%2*2;
   if(tileAt>=Math.floor(t.blockFileOffset/BANK)*BANK+BANK)
    return {verified:false,reason:'Metabloco fora do banco tileset mapa '+id};
   const tile=rom[tileAt];
   if(tile>0x5f)return {verified:false,reason:'Tile não 8×8 válido no mapa '+id};
   tileBytes[y*w+x]=tile;
   if(passSet.has(tile))ownPassable++;
  }
  result.push({mapId:id,tilesetId:m.tilesetId,widthTiles:w,heightTiles:h,
   sourceBlockSha256:m.blockSha256,blockCount,byteCount:tileBytes.length,
   tileSha256:hash(tileBytes),landBasePassableCount:ownPassable,
   tileIdsDeflateBase64:zlib.deflateRawSync(tileBytes,{level:9}).toString('base64'),
   sampleRule:'logical x,y -> block(x>>1,y>>1), lower-left sub-tile at (2*(x%2),2*(y%2)+1)',
   livePlayerPositionVerified:false,collisionOutcomeIncludesDynamicState:false});
  byTileset[m.tilesetId].maps++;byTileset[m.tilesetId].tiles+=w*h;
  sourceBlockCount+=blockCount;logicalTiles+=w*h;basePassable+=ownPassable;
 }
 if(result.length!==226||sourceBlockCount!==23783||logicalTiles!==95132)
  return {verified:false,reason:'Número de mapas, metabloco ou posições não corresponde às três ROMs auditadas',
   decodedMaps:result.length,sourceBlockCount,logicalTiles};
 return {verified:true,romSha256:sha,tilesetCount:tilesets.length,decodedMapCount:result.length,
  sourceBlockCount,logicalTiles,basePassable,baseBlocked:logicalTiles-basePassable,
  tilesets,landPairs,waterPairs,maps:result,byTileset,
  provenance:'24 headers at 03:47BE and collision lists bank 00, 16-byte tileset blocks, 226 SHA-audited map matrices',
  sourceReferences:['pret/pokered data/tilesets/tileset_headers.asm','data/tilesets/collision_tile_ids.asm',
    'data/tilesets/pair_collision_tile_ids.asm','engine/overworld/player_state.asm _GetTileAndCoordsInFrontOfPlayer',
    'home/overworld.asm CheckTilePassable'],
  roomWalkabilityVerified:false,dynamicObstaclesVerified:false,surfStateVerified:false,
  flagsAndLedgesVerified:false,romIdentityInEmulatorShaVerified:false};
}
// Imported profiles contain only derived ROM data. Do not accept a catalog
// unless all 226 source block hashes and map dimensions match that exact
// profile, as well as the known ROM SHA and verified tileset structures.
function matchDerivedTerrain(profile,catalogue){
 const sha=String(profile?.hash?.sha256||'').toLowerCase();
 const p=profile?.world?.maps;
 const candidate=catalogue?.versions?.[sha];
 if(!SHA.has(sha)||candidate?.verified!==true||candidate.romSha256!==sha||
    candidate.tilesetCount!==24||candidate.decodedMapCount!==226||
    candidate.logicalTiles!==95132||candidate.sourceBlockCount!==23783||
    !Array.isArray(candidate.maps)||candidate.maps.length!==226||
    !Array.isArray(candidate.tilesets)||candidate.tilesets.length!==24||
    !Array.isArray(candidate.landPairs)||candidate.landPairs.length!==11||
    !Array.isArray(candidate.waterPairs)||candidate.waterPairs.length!==3||
    p?.valid!==true||!Array.isArray(p.data)||p.data.length!==248)
  return null;
 for(const m of candidate.maps){
  const old=p.data[m.mapId];
  if(!old?.valid||old.mapId!==m.mapId||old.tilesetId!==m.tilesetId||
     old.widthTiles!==m.widthTiles||old.heightTiles!==m.heightTiles||
     old.blockSha256!==m.sourceBlockSha256||
     !/^[a-f0-9]{64}$/.test(m.tileSha256||'')||
     typeof m.tileIdsDeflateBase64!=='string')return null;
 }
 return {...candidate,
  source:'DERIVED_FROM_THREE_EXACT_SHA256_ROMS_AND_226_MATCHING_MAP_BLOCK_HASHES',
  runtimeRomSha256Verified:false,liveCollisionVerified:false};
}
function terrainTileAt(atlas,mapId,x,y){
 if(!atlas?.verified||!SHA.has(atlas.romSha256)||
    !validInt(mapId,0,247)||!validInt(x,0,159)||!validInt(y,0,159))
  return {verified:false,reason:'Identidade ROM ou coordenadas inválidas'};
 const m=atlas.maps?.find(m=>m.mapId===mapId);
 if(!m||x>=m.widthTiles||y>=m.heightTiles)
  return {verified:false,reason:'Coordenada fora do mapa confirmado'};
 const t=atlas.tilesets?.[m.tilesetId];
 if(!t||!Array.isArray(t.landPassableTileIds))return {verified:false,reason:'Tileset ausente'};
 let grid;
 try{grid=zlib.inflateRawSync(Buffer.from(m.tileIdsDeflateBase64,'base64'),{maxOutputLength:m.byteCount});}
 catch{return {verified:false,reason:'Grelha comprimida inválida'};}
 if(grid.length!==m.widthTiles*m.heightTiles||hash(grid)!==m.tileSha256)
  return {verified:false,reason:'Tamanho ou SHA do mapa alterado'};
 const tileId=grid[y*m.widthTiles+x],basePassable=t.landPassableTileIds.includes(tileId);
 return {verified:true,mapId,x,y,tileId,tilesetId:m.tilesetId,
  landBasePassable:basePassable,terrainSource:'ROM_EXACT_SHA256_LOWER_LEFT_TILE',
  actualPlayerLocationVerified:false,walkableNowVerified:false};
}
function terrainStepEvidence(atlas,mapId,from,to){
 if(!from||!to||!validInt(from.x,0,159)||!validInt(from.y,0,159)||
    !validInt(to.x,0,159)||!validInt(to.y,0,159)||
    Math.abs(from.x-to.x)+Math.abs(from.y-to.y)!==1)
  return {verified:false,reason:'Movimento não é um passo cardinal válido'};
 const a=terrainTileAt(atlas,mapId,from.x,from.y),b=terrainTileAt(atlas,mapId,to.x,to.y);
 if(!a.verified||!b.verified)return {verified:false,reason:a.reason||b.reason};
 const blockedPair=atlas.landPairs.some(p=>p.tilesetId===a.tilesetId&&
  ((p.tileA===a.tileId&&p.tileB===b.tileId)||(p.tileA===b.tileId&&p.tileB===a.tileId)));
 return {verified:true,source:a,target:b,landPairForbidden:blockedPair,
  landTargetListedAsPassable:b.landBasePassable,
  terrainBasePermitsStep:b.landBasePassable&&!blockedPair,
  status:b.landBasePassable&&!blockedPair?'STATIC_TERRAIN_PERMITS_PENDING_GAME_STATE':
   'STATIC_TERRAIN_BLOCKS_PENDING_LEDGE_OR_SCRIPT',
  walkableNowVerified:false,actualPlayerPositionVerified:false,
  conditionsNotCovered:['NPC collision','ledge jumps','scripted movement','Surf state',
    'water landings','doors and warps','event flags','per-frame RAM']};
}
module.exports={auditTerrainCollision,terrainTileAt,terrainStepEvidence,matchDerivedTerrain,readTilesets,readPairList};