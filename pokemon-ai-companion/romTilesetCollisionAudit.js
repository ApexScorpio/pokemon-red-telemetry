'use strict';
// Gen I ROM terrain audit: 24 tileset headers (12 bytes each), walkable tile
// whitelists, 4x4 8px metatile blocks, and pair-collision tables. The tile
// sampled at an overworld character coordinate is the lower-left 8px tile
// of its 2x2 quadrant. This is *terrain-only*, not a playable route proof.
// Sources: pret/pokered data/tilesets/{tileset_headers,collision_tile_ids,
// pair_collision_tile_ids}.asm; home/overworld.asm DrawTileBlock and
// CheckTilePassable; engine/overworld/player_state.asm GetTileAndCoordsInFrontOfPlayer.
const crypto=require('node:crypto');
const BANK=0x4000,SIZE=1048576,HEADER_AT=0xc7be,HEADERS=24,ROW=12;
const PAIR_LAND_AT=0x0c7e,PAIR_WATER_AT=0x0ca0;
const HASHES=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
]);
const MAPS=248;
const integerByte=n=>Number.isInteger(n)&&n>=0&&n<=255;
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const word=(b,i)=>b[i]+256*b[i+1];
function fileAddr(bank,cpu){
 if(!Number.isInteger(bank)||bank<1||bank>=64||cpu<0x4000||cpu>=0x8000)return null;
 return bank*BANK+cpu-0x4000;
}
function fail(reason,other={}) {return {verified:false,reason,...other};}
function pairsFromRom(rom,at,limit){
 const records=[];let p=at;
 while(records.length<=limit&&p<0x4000){
  const tilesetId=rom[p];
  if(tilesetId===255)return {verified:records.length===limit,entries:records,terminatedAt:p};
  if(tilesetId>=HEADERS||p+2>=0x4000)return {verified:false,entries:[],reason:'Par de colisão fora dos limites'};
  const first=rom[p+1],second=rom[p+2];
  records.push({tilesetId,first,second,sourceRomOffset:p});p+=3;
 }
 return {verified:false,entries:[],reason:'Tabela de pares sem terminador'};
}
function readTilesets(rom){
 const rows=[];
 for(let id=0;id<HEADERS;id++){
  const p=HEADER_AT+id*ROW,bank=rom[p],blockPtr=word(rom,p+1),gfxPtr=word(rom,p+3),collPtr=word(rom,p+5);
  const blockAt=fileAddr(bank,blockPtr),gfxAt=fileAddr(bank,gfxPtr);
  if(blockAt===null||gfxAt===null||collPtr<1||collPtr>=0x4000)
   return fail('Tileset #'+id+': ponteiros do cabeçalho incompatíveis');
  const allowed=[];let q=collPtr;
  while(q<0x4000&&rom[q]!==255&&allowed.length<80)allowed.push(rom[q++]);
  if(q>=0x4000||rom[q]!==255||allowed.length<3||allowed.length!==new Set(allowed).size)
   return fail('Tileset #'+id+': lista de colisões não terminada ou repetida');
  rows.push({id,bank,headerRomOffset:p,blocksPointerCpu:blockPtr,
   blocksRomOffset:blockAt,gfxPointerCpu:gfxPtr,gfxRomOffset:gfxAt,
   collisionPointerCpu:collPtr,collisionListRomOffset:collPtr,
   counterTileIds:[rom[p+7],rom[p+8],rom[p+9]],grassTileId:rom[p+10],
   animationByte:rom[p+11],walkableTileIds:allowed,
   source:'12-BYTE_TILESET_ROM_HEADER_AND_TERMINATED_PASSABLE_TILE_IDS'});
 }
 return {verified:true,rows};
}
function readCollisionAtlas(rom,maps){
 if(!Buffer.isBuffer(rom)||rom.length!==SIZE)return fail('ROM não é um binário de 1 MiB');
 const sha256=digest(rom);
 if(!HASHES.has(sha256))return fail('SHA-256 não corresponde às três ROMs auditadas',{sha256});
 if(!maps?.valid||!Array.isArray(maps.data)||maps.data.length!==MAPS||
    maps.data.some((m,i)=>m.mapId!==i))return fail('Catálogo de 248 IDs de mapas ainda não confirmado');
 const tiles=readTilesets(rom);
 if(!tiles.verified)return tiles;
 const landPairs=pairsFromRom(rom,PAIR_LAND_AT,11),waterPairs=pairsFromRom(rom,PAIR_WATER_AT,3);
 if(!landPairs.verified||!waterPairs.verified||
    landPairs.terminatedAt!==PAIR_WATER_AT-1)
  return fail('Tabelas de colisões por pares não são as da ROM auditada');
 const seenBlocks=Array.from({length:HEADERS},()=>new Set());
 const outputs=[];let mapCount=0,blockCells=0,characterCells=0,terrainAllowedCells=0;
 for(const m of maps.data){
  if(!m.valid)continue;
  const bank=m.mapBank,headerAt=fileAddr(bank,m.mapHeaderPointerCpu);
  if(headerAt===null||headerAt+10>(bank+1)*BANK)
   return fail('Mapa #'+m.mapId+': cabeçalho fora do banco');
  const t=rom[headerAt],bh=rom[headerAt+1],bw=rom[headerAt+2],ptr=word(rom,headerAt+3);
  if(t>=HEADERS||bh<1||bh>80||bw<1||bw>80||
     m.tilesetId!==t||m.heightTiles!==bh*2||m.widthTiles!==bw*2||
     m.blocksPointerCpu!==ptr)
   return fail('Mapa #'+m.mapId+': cabeçalho da ROM divergente');
  const gridAt=fileAddr(bank,ptr);
  if(gridAt===null||gridAt+bw*bh>(bank+1)*BANK)
   return fail('Mapa #'+m.mapId+': matriz de blocos fora do banco');
  const grid=rom.subarray(gridAt,gridAt+bw*bh);
  if(m.blockSha256&&digest(grid)!==m.blockSha256)
   return fail('Mapa #'+m.mapId+': blocos diferem do SHA previamente auditado');
  if(m.blockDataBase64){
   const prior=Buffer.from(m.blockDataBase64,'base64');
   if(!prior.equals(grid))return fail('Mapa #'+m.mapId+': bloco importado difere da ROM');
  }
  const w=bw*2,h=bh*2,out=Buffer.alloc(w*h),passable=Buffer.alloc(Math.ceil(w*h/8));
  const tileset=tiles.rows[t],allowed=new Set(tileset.walkableTileIds);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const blockId=grid[Math.floor(y/2)*bw+Math.floor(x/2)];
   if(blockId>127)return fail('Mapa #'+m.mapId+': ID de bloco fora de 0..127');
   seenBlocks[t].add(blockId);
   const tileAt=tileset.blocksRomOffset+16*blockId+4+8*(y&1)+2*(x&1);
   if(tileAt>=(tileset.bank+1)*BANK)
    return fail('Mapa #'+m.mapId+': metabloco atravessa fronteira bancária');
   const tile=rom[tileAt],at=y*w+x;
   out[at]=tile;
   if(allowed.has(tile)){passable[at>>3]|=1<<(at&7);terrainAllowedCells++;}
  }
  outputs.push({mapId:m.mapId,tilesetId:t,widthTiles:w,heightTiles:h,
   blockMapSha256:digest(grid),collisionTilesBase64:out.toString('base64'),
   terrainAllowMaskBase64:passable.toString('base64'),
   source:'VERIFIED_MAP_BLOCKS_4x4_METATILES_AND_TILESET_PASSABLE_WHITELIST',
   scriptOrSpriteGatesProven:false,waterEligibilityProven:false,
   movementFullyCertified:false});
  mapCount++;blockCells+=grid.length;characterCells+=w*h;
 }
 if(mapCount!==226||blockCells!==23783||characterCells!==4*blockCells)
  return fail('Incompleto: contagem de 226 mapas/23783 metabloco não coincide',
   {mapCount,blockCells,characterCells});
 for(let t=0;t<HEADERS;t++){
  const ids=seenBlocks[t];if(!ids.size)return fail('Tileset #'+t+' não usado nos mapas verificados');
  const count=Math.max(...ids)+1,row=tiles.rows[t],end=row.blocksRomOffset+16*count;
  if(end>(row.bank+1)*BANK)return fail('Tabela de metabloco atravessa banco: tileset #'+t);
  row.referencedBlocks=ids.size;row.maxReferencedBlockId=count-1;
  row.requiredBlockTableBytes=count*16;
  row.blocksBase64=rom.subarray(row.blocksRomOffset,end).toString('base64');
  row.requiredBlockTableSha256=digest(rom.subarray(row.blocksRomOffset,end));
 }
 return {verified:true,romSha256:sha256,
  tilesetHeaderFileOffset:HEADER_AT,tilesets:tiles.rows,
  pairCollisions:{land:landPairs.entries,water:waterPairs.entries,
   source:'ROM_0C7E_AND_0CA0_PRET_POKERED_PAIR_COLLISIONS'},
  mapTerrain:outputs,
  totals:{tilesets:HEADERS,normalMaps:mapCount,mapBlockCells:blockCells,
   characterCells,terrainAllowedCells,terrainDisallowedCells:characterCells-terrainAllowedCells,
   uniqueReferencedMetablocks:seenBlocks.reduce((n,x)=>n+x.size,0),
   landBlockedPairs:landPairs.entries.length,waterBlockedPairs:waterPairs.entries.length},
  gameplayLimitations:{liveSpriteCollisionsKnown:false,scriptedTileChangesKnown:false,
   strengthsSurfAndBikeKnown:false,ledgeDirectionsKnown:false,
   fullCollisionEngineCertified:false},
  description:'Conjunto de tiles de passagem permitida por tileset, sem garantia de que o jogador possa caminhar agora'};
}
function terrainAt(atlas,mapId,x,y){
 if(atlas?.verified!==true)return fail('Atlas de terreno não validado');
 const m=atlas.mapTerrain?.find(m=>m.mapId===mapId);
 if(!m)return fail('Mapa não descodificado');
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||
   x>=m.widthTiles||y>=m.heightTiles)return fail('Coordenada fora do mapa');
 const tileData=Buffer.from(m.collisionTilesBase64,'base64');
 const mask=Buffer.from(m.terrainAllowMaskBase64,'base64');
 const at=y*m.widthTiles+x;
 if(tileData.length!==m.widthTiles*m.heightTiles||mask.length!==Math.ceil(tileData.length/8))
  return fail('Dados de mapa inconsistentes');
 const tileId=tileData[at],terrainAllowed=!!(mask[at>>3]&(1<<(at&7)));
 return {verified:true,mapId,x,y,tilesetId:m.tilesetId,tileId,terrainAllowed,
  currentlyWalkable:null,canSurf:null,canCrossWithScript:null,
  scope:'Somente whitelist de colisão estática do tileset; não inclui terreno em execução, pares, NPCs, flags ou obstáculos'};
}
function pairBoundaryBlocked(atlas,tilesetId,fromTileId,toTileId,mode='land'){
 if(!atlas?.verified||!integerByte(fromTileId)||!integerByte(toTileId)||
    !Number.isInteger(tilesetId)||tilesetId<0||tilesetId>=HEADERS||
    !['land','water'].includes(mode))return fail('Dados de transição inválidos');
 const rows=atlas.pairCollisions[mode];
 return {verified:true,blockedByStaticPair:rows.some(p=>p.tilesetId===tilesetId&&
   (p.first===fromTileId&&p.second===toTileId||p.first===toTileId&&p.second===fromTileId)),
   transitionFullyCertified:false};
}
module.exports={readCollisionAtlas,terrainAt,pairBoundaryBlocked};