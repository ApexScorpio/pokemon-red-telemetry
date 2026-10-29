'use strict';
// Conditional exits of ANY of the 226 normal Gen I ROM maps. Only the first
// map has verified tile geometry; outer borders and elevator choices are
// topological possibilities, not actions confirmed in live gameplay.
const {terrainBytes,computeReach}=require('./romItemReachability');
const {exactTilePath}=require('./romCrossMapItemRoute');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const validId=x=>Number.isInteger(x)&&x>=0&&x<248;
const validPos=x=>Number.isInteger(x?.x)&&x.x>=0&&
  Number.isInteger(x?.y)&&x.y>=0;
const reject=reason=>({verified:false,reason,exits:[],
  accessNowProven:false,firstMapTerrainCorroborated:false});
function localExitAccess({profile,warpGraph,mapId,position,
 mapSnapshotVerified=false,positionVerified=false,modeByte=null,
 canCut=null,canSurf=null,spritesVerified=false,mapEntities=[],
 elevatorChoices=null,maxResults=96}={}){
 const sha=String(profile?.hash?.sha256||'').toLowerCase();
 const atlas=profile?.world?.terrainAtlas;
 if(!isKnownAuditedRomSha(sha)||profile?.unknownLayout===true||
    !mapSnapshotVerified||!positionVerified||!validId(mapId)||
    !validPos(position)||![0,1,2].includes(modeByte)||
    ![null,true,false].includes(canCut)||![null,true,false].includes(canSurf)||
    !Array.isArray(mapEntities)||typeof spritesVerified!=='boolean'||
    !Number.isInteger(maxResults)||maxResults<1||maxResults>128)
   return reject('ROM, posição, modo, sprites ou estado do mapa não corroborados');
 if(atlas?.verified!==true||atlas.romSha256!==sha||
    !Array.isArray(atlas.maps)||atlas.maps.length!==226||
    warpGraph?.verified!==true||warpGraph.romSha256!==sha||
    warpGraph.totalWarpEntries!==813||warpGraph.normalMapHeaders!==226||
    !Array.isArray(warpGraph.edges)||warpGraph.edges.length!==813)
   return reject('Atlas de terreno ou índice de 813 warps/226 mapas não validado');
 const local=atlas.maps.find(m=>m.mapId===mapId);
 const grid=terrainBytes({...local,verified:local?.mapId===mapId},sha);
 if(!grid||position.x>=grid.width||position.y>=grid.height)
   return reject('Matriz ROM do mapa atual ou coordenadas RAM não confirmadas');
 const opts={currentSurf:modeByte===2,actors:mapEntities,spritesVerified};
 const base=computeReach(grid,position,{...opts,
   canCut:canCut===true,canSurf:canSurf===true});
 const cut=canCut===true?base:computeReach(grid,position,{...opts,
   canCut:true,canSurf:canSurf===true});
 const surf=canSurf===true?base:computeReach(grid,position,{...opts,
   canCut:canCut===true,canSurf:true});
 const both=computeReach(grid,position,{...opts,canCut:true,canSurf:true});
 const pathOf=(reach,e)=>exactTilePath(reach,{x:e.x,y:e.y});
 const statusFor=e=>{
   if(!validPos(e)||e.x>=grid.width||e.y>=grid.height)
     return {status:'ROM_EXIT_TILE_OUTSIDE_MAP',approach:null};
   let approach=pathOf(base,e);
   if(approach)return {
     status:approach.usesCut?'TERRAIN_PATH_REQUIRES_CUT_ACTION':
       approach.usesSurf?'TERRAIN_PATH_REQUIRES_SURF_ACTION':
       'THEORETICAL_TERRAIN_PATH',
     approach};
   approach=canCut===true?null:pathOf(cut,e);
   if(approach)return {
     status:canCut===false?'CUT_NOT_USABLE_IN_CURRENT_PARTY':
       'CUT_CAPABILITY_NOT_VERIFIED',approach};
   approach=canSurf===true?null:pathOf(surf,e);
   if(approach)return {
     status:canSurf===false?'SURF_NOT_USABLE_IN_CURRENT_PARTY':
       'SURF_CAPABILITY_NOT_VERIFIED',approach};
   approach=pathOf(both,e);
   if(approach)return {status:'CUT_AND_SURF_HYPOTHETICAL',approach};
   return {status:'NO_LOCAL_TERRAIN_PATH_NOT_PROOF_OF_LOCK',approach:null};
 };
 const exits=[];
 for(const w of warpGraph.edges){
   if(w?.sourceMapId!==mapId)continue;
   const {status,approach}=statusFor(w);
   exits.push({kind:'WARP',sourceMapId:mapId,
     sourceWarpIndex:w.sourceWarpIndex,sourceTile:{x:w.x,y:w.y},
     destinationMapId:w.status==='STATIC_DESTINATION_WARP_VALIDATED'?
       w.destinationMapId:null,
     staticDestinationStatus:w.status,
     destinationRequiresScript:w.status!=='STATIC_DESTINATION_WARP_VALIDATED',
     destinationWarpIndex:w.destinationWarpIndex,
     landing:w.status==='STATIC_DESTINATION_WARP_VALIDATED'?
       {mapId:w.landing.mapId,x:w.landing.x,y:w.landing.y}:null,
     terrainStatus:status,approach,
     accessibleNow:null,routeNavigableNowProven:false});
 }
 const outdoors=warpGraph.outdoorConnections;
 if(outdoors?.verified===true&&outdoors.romSha256===sha&&
    outdoors.edgeCount===78&&outdoors.reciprocalConnections===78&&
    Array.isArray(outdoors.edges)&&outdoors.edges.length===78)
   for(const e of outdoors.edges){
     if(e.sourceMapId!==mapId||!validId(e.destinationMapId))continue;
     exits.push({kind:'OUTDOOR_BORDER',sourceMapId:mapId,
       direction:e.direction,destinationMapId:e.destinationMapId,
       terrainStatus:'BORDER_CROSSING_TILE_NOT_VERIFIED',
       approach:null,accessibleNow:null,routeNavigableNowProven:false,
       passageGeometryVerified:false});
   }
 if(elevatorChoices?.verified===true&&elevatorChoices.romSha256===sha&&
    elevatorChoices.mapId===mapId&&elevatorChoices.hasElevator===true&&
    Array.isArray(elevatorChoices.options))
   for(const e of elevatorChoices.options){
     if(!validId(e.destinationMapId)||!Number.isInteger(e.floorMenuIndex)||
        !Number.isInteger(e.destinationWarpIndex))continue;
     exits.push({kind:'ELEVATOR_MENU_CHOICE',sourceMapId:mapId,
       floorMenuIndex:e.floorMenuIndex,
       destinationMapId:e.destinationMapId,
       destinationWarpIndex:e.destinationWarpIndex,
       terrainStatus:'FLOOR_SELECTION_AND_SCRIPT_NOT_VERIFIED',
       approach:null,accessibleNow:null,routeNavigableNowProven:false});
   }
 const countByKind={};
 for(const e of exits)countByKind[e.kind]=(countByKind[e.kind]||0)+1;
 return {verified:true,romSha256:sha,mapId,
   positionFromRam:{x:position.x,y:position.y},
   capabilityEvidence:{cut:canCut,surf:canSurf,
     spritesVerified,modeByte},
   totalExits:exits.length,shownExits:Math.min(maxResults,exits.length),
   truncated:exits.length>maxResults,counts:countByKind,
   exits:exits.slice(0,maxResults),
   accessNowProven:false,firstMapTerrainCorroborated:true,
   snapshotAtomicVerified:false,
   note:'Só a primeira zona tem geometria de tiles validada. Falta validar scripts, comandos, fronteiras, coordenadas posteriores e escolhas reais de piso.'};
}
module.exports={localExitAccess};
