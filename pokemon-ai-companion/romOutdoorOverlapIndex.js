'use strict';
// 78 global Kanto border overlaps with source+destination ROM collision grids.
// Purely static atlas: actor flags, scripts and executed crossing are unknown.
const {verifyTerrainVariant}=require('./romTerrainVariantGuard');
const {terrainBytes}=require('./romItemReachability');
const {mapArrival}=require('./romOutdoorAlignment');
const failure=reason=>({verified:false,reason,edges:[],
  gamePassagesVerified:0});
const edgeKey=e=>e.sourceMapId+':'+e.direction+':'+e.destinationMapId;
function buildOutdoorOverlapIndex({profile,alignment}={}){
 const sha=String(profile?.hash?.sha256||'').toLowerCase();
 if(!alignment?.verified||alignment.romSha256!==sha||
    alignment.verifiedConnections!==78||
    !Array.isArray(alignment.connections)||alignment.connections.length!==78||
    verifyTerrainVariant(profile).verified!==true)
   return failure('Alinhamento de 78 fronteiras ou 226 terrenos da mesma ROM não validado');
 const m=new Map(profile.world.terrainAtlas.maps.map(r=>[r.mapId,r]));
 const grids=new Map();
 const getGrid=id=>{
   if(!grids.has(id)){
     const raw=m.get(id);
     grids.set(id,raw?terrainBytes({...raw,verified:true},sha):null);
   }
   return grids.get(id);
 };
 const seen=new Set(),rows=[];
 let overlapPairs=0,landPairs=0,waterPairs=0,landEdges=0,waterEdges=0;
 for(const edge of alignment.connections){
   const k=edgeKey(edge),source=getGrid(edge.sourceMapId),
     destination=getGrid(edge.destinationMapId);
   if(seen.has(k)||!source||!destination||
      source.width!==edge.sourceWidthTiles||
      source.height!==edge.sourceHeightTiles||
      destination.width!==edge.destinationWidthTiles||
      destination.height!==edge.destinationHeightTiles||
      edge.descriptorPointerMatches!==true||
      edge.referenceOffsetCorroborated!==true)
     return failure('Matrizes ou ligação de referência incoerentes: '+k);
   seen.add(k);
   const border=[];
   if(edge.direction==='north'||edge.direction==='south'){
     const y=edge.direction==='north'?0:source.height-1;
     for(let x=0;x<source.width;x++)border.push({x,y});
   }else if(edge.direction==='west'||edge.direction==='east'){
     const x=edge.direction==='west'?0:source.width-1;
     for(let y=0;y<source.height;y++)border.push({x,y});
   }else return failure('Direção original inválida: '+k);
   let overlap=0,land=0,water=0,sourceBlocked=0,targetBlocked=0;
   const landSamples=[];
   for(const from of border){
     const to=mapArrival(edge.direction,edge.offsetBlocks,from,
       destination.width,destination.height);
     if(!to)continue;
     overlap++;
     const i=from.y*source.width+from.x,j=to.y*destination.width+to.x;
     const sw=(source.bits[i>>3]&(1<<(i&7)))!==0;
     const dw=(destination.bits[j>>3]&(1<<(j&7)))!==0;
     if(sw&&dw){
       land++;
       if(landSamples.length<4)landSamples.push({source:from,destination:to});
     }
     const possibleWater=[source.tiles[i],destination.tiles[j]]
       .some(t=>t===0x14||t===0x48);
     if(possibleWater)water++;
     if(!sw)sourceBlocked++;
     if(!dw)targetBlocked++;
   }
   if(overlap<1)return failure('Sobreposição de mapas vazia: '+k);
   overlapPairs+=overlap;landPairs+=land;waterPairs+=water;
   if(land)landEdges++;
   if(water)waterEdges++;
   rows.push({sourceMapId:edge.sourceMapId,
     destinationMapId:edge.destinationMapId,
     direction:edge.direction,offsetBlocks:edge.offsetBlocks,
     sourceEdgeTiles:border.length,overlappingTilePairs:overlap,
     staticLandCompatiblePairs:land,waterTerrainPairs:water,
     sourceStaticBlockedPairs:sourceBlocked,
     targetStaticBlockedPairs:targetBlocked,
     staticLandSamples:landSamples,
     sourceAndDestinationAlignmentVerified:true,
     activeTransitionObserved:false,
     currentAbilityAndScriptGatesVerified:false,
     maybeRequiresWaterOrEvent:land===0,
     accessibleNow:null});
 }
 // These independent totals are derived from the original 226-map terrain
 // archives. Never silently publish an inconsistent or incomplete index.
 if(seen.size!==78||overlapPairs!==1484||landPairs!==400||
    landEdges!==70||waterEdges!==24)
   return failure('Valores das 78 sobreposições divergem das três ROMs auditadas');
 return {verified:true,romSha256:sha,
   edges:rows,edgeCount:78,sourceMaps:36,
   overlappingTilePairs:overlapPairs,
   staticLandCompatiblePairs:landPairs,
   sourceMapsWithOutdoorConnections:36,
   bordersWithLandPairs:landEdges,
   bordersWithoutLandPairs:78-landEdges,
   bordersWithWaterTiles:waterEdges,
   gamePassagesVerified:0,snapshotAtomicVerified:false,
   activeRomFullSha256Verified:false,
   source:'78_ROM_HEADER_OFFSETS_AND_226_SHA_AUDITED_TERRAIN_GRIDS',
   warnings:['Sobreposição em ROM não prova travessia; personagens, scripts, portas e Surf não estão validados',
     'Zero pares de terreno terrestre não prova bloqueio definitivo',
     'Destinos baseados em cabeçalhos ROM e offsets corroborados, não em transições observadas']};
}
module.exports={buildOutdoorOverlapIndex};
