'use strict';
// Search passable source-border cells for a ROM outdoor connection.
// The audited 78 connections name destinations but the retained descriptor
// records do not carry the full 11-byte spatial alignment or a live transfer
// frame. Edge tiles here are CANDIDATES, never proven crossing coordinates.
const {exactTilePath}=require('./romCrossMapItemRoute');
const {mapArrival}=require('./romOutdoorAlignment');
const DIRECTIONS=new Set(['north','south','west','east']);
const missing=reason=>({verified:false,reason,borderTiles:[],
  sourceBorderLandingProven:false,neighborAlignmentVerified:false});
function outdoorBoundaryCandidates({grid,direction,reachNormal,reachCut,
 reachSurf,reachBoth,canCut=null,canSurf=null,
 alignment=null,destinationGrid=null,maxCandidates=4}={}){
 if(!grid||!Number.isInteger(grid.width)||grid.width<1||
    !Number.isInteger(grid.height)||grid.height<1||
    !DIRECTIONS.has(direction)||!reachNormal||
    !reachCut||!reachSurf||!reachBoth||
    ![null,true,false].includes(canCut)||
    ![null,true,false].includes(canSurf)||
    !Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>16)
   return missing('Terreno, direção ou cenários de movimento não comprovados');
 const candidates=[],n=grid.width*grid.height;
 const aligned=alignment?.descriptorPointerMatches===true&&
   alignment?.referenceOffsetCorroborated===true&&
   alignment.direction===direction&&
   alignment.sourceWidthTiles===grid.width&&
   alignment.sourceHeightTiles===grid.height&&
   destinationGrid?.width===alignment.destinationWidthTiles&&
   destinationGrid?.height===alignment.destinationHeightTiles&&
   destinationGrid?.romSha256===grid.romSha256&&
   destinationGrid?.bits?.length===Math.ceil(
     destinationGrid.width*destinationGrid.height/8)&&
   destinationGrid?.tiles?.length===destinationGrid.width*destinationGrid.height;
 let overlappingTiles=0,compatibleDestinationTiles=0;
 if(![reachNormal,reachCut,reachSurf,reachBoth].every(r=>
    r?.width===grid.width&&r?.height===grid.height&&
    r?.prev?.length===2*n))
   return missing('Cenários BFS não correspondem à matriz ROM');
 const at=[];
 if(direction==='north'||direction==='south'){
   const y=direction==='north'?0:grid.height-1;
   for(let x=0;x<grid.width;x++)at.push({x,y});
 }else{
   const x=direction==='west'?0:grid.width-1;
   for(let y=0;y<grid.height;y++)at.push({x,y});
 }
 let reachableWithoutNewAbilities=0,requiresHypotheticalAbility=0;
 for(const tile of at){
   const destination=aligned?mapArrival(direction,alignment.offsetBlocks,
     tile,destinationGrid.width,destinationGrid.height):null;
   if(aligned&&!destination)continue;
   if(destination)overlappingTiles++;
   let destinationTerrainStatus=null;
   if(destination){
     const index=destination.y*destinationGrid.width+destination.x;
     const walkable=(destinationGrid.bits[index>>3]&(1<<(index&7)))!==0;
     const tileId=destinationGrid.tiles[index];
     const cut=destinationGrid.tilesetId===0&&tileId===0x3d;
     const surf=tileId===0x14||tileId===0x48;
     destinationTerrainStatus=walkable?'STATIC_LAND_CANDIDATE':
       cut?'CUT_REQUIRED_AT_DESTINATION':
       surf?'SURF_REQUIRED_AT_DESTINATION':
       'DESTINATION_STATIC_TERRAIN_BLOCKED';
     if(!walkable&&!cut&&!surf)continue;
     compatibleDestinationTiles++;
   }
   let route=exactTilePath(reachNormal,tile),status=null;
   if(route){
     status=route.usesCut?'TERRAIN_TO_BORDER_REQUIRES_CUT':
       route.usesSurf?'TERRAIN_TO_BORDER_REQUIRES_SURF':
       'TERRAIN_TO_BORDER_POSSIBLE';
     reachableWithoutNewAbilities++;
   }else{
     route=canCut===true?null:exactTilePath(reachCut,tile);
     if(route)status=canCut===false?'NEEDS_CUT':
       'CUT_CAPABILITY_UNKNOWN';
     else{
       route=canSurf===true?null:exactTilePath(reachSurf,tile);
       if(route)status=canSurf===false?'NEEDS_SURF':
         'SURF_CAPABILITY_UNKNOWN';
       else{
         route=exactTilePath(reachBoth,tile);
         if(route)status='NEEDS_CUT_AND_SURF_HYPOTHETICAL';
       }
     }
     if(route)requiresHypotheticalAbility++;
   }
   if(!route)continue;
   candidates.push({tile,
     destinationTile:destination??null,
     destinationTerrainStatus,steps:route.steps,
     firstTerrainStep:route.nextStep,
     terrainStatus:status,
     usesCut:route.usesCut,usesSurf:route.usesSurf,
     borderTransitionProven:false,
     destinationTileKnown:aligned&&destination!==null,
     destinationCanEnterNowProven:false});
 }
 const rank=c=>['TERRAIN_TO_BORDER_POSSIBLE',
   'TERRAIN_TO_BORDER_REQUIRES_CUT',
   'TERRAIN_TO_BORDER_REQUIRES_SURF'].includes(c.terrainStatus)?0:1;
 candidates.sort((a,b)=>rank(a)-rank(b)||
   a.steps-b.steps||a.tile.y-b.tile.y||a.tile.x-b.tile.x);
 return {verified:true,direction,
   edgeTileCount:at.length,
   terrainCandidateCount:candidates.length,
   reachableWithoutNewAbilities,requiresHypotheticalAbility,
   overlappingSourceTiles:aligned?overlappingTiles:null,
   destinationTerrainCompatibleTiles:aligned?compatibleDestinationTiles:null,
   neighborAlignmentVerified:aligned,
   compiledRomPointerFormulaMatched:aligned,
   borderTiles:candidates.slice(0,maxCandidates),
   candidatesTruncated:candidates.length>maxCandidates,
   sourceBorderLandingProven:false,
   accessibleNow:null,
   note:aligned?
     'Tiles correspondentes na borda de origem e destino, com deslocamento corroborado por ponteiros ROM. Passagem efetiva e scripts continuam por provar.':
     'Apenas tiles de origem alcançáveis na borda; não comprova sobreposição espacial com o mapa vizinho nem execução da transição.'};
}
module.exports={outdoorBoundaryCandidates};
