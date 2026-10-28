'use strict';
// Gen I land/surf terrain movement possibilities from existing SHA-audited
// terrain maps, but NEVER actual movement in a running game. Source:
// pret/pokered home/overworld.asm CollisionCheckOnLand/CollisionCheckOnWater.
const {inspectTerrainCell}=require('./romTerrainAtlas');
const {ledgeCandidate}=require('./romLedgeRules');
const valid=(n,lo,hi)=>Number.isInteger(n)&&n>=lo&&n<=hi;
const checks={
  noVerifiedPosition:'Amostra RAM / mapa inválidos',
  invalidMode:'Modo D700 não é um byte 0/1/2 confirmado'
};
function matchesPair(pairs,a,b){
 return pairs.some(p=>(p[0]===a&&p[1]===b)||(p[1]===a&&p[0]===b));
}
function inspectMovementOptions(terrainMap,worldTerrain,position,modeByte,{mapSnapshotVerified=false}={}){
 if(!terrainMap||!worldTerrain?.verified||
    !valid(terrainMap.mapId,0,247)||
    !Array.isArray(worldTerrain.maps)||
    !worldTerrain.maps.some(m=>m.mapId===terrainMap.mapId&&m.tileIdsSha256===terrainMap.tileIdsSha256)||
    !mapSnapshotVerified||!position||!valid(position.x,0,159)||!valid(position.y,0,159))
  return {verified:false,reason:checks.noVerifiedPosition,atomicSnapshotVerified:false};
 if(!valid(modeByte,0,2))
  return {verified:false,reason:checks.invalidMode,atomicSnapshotVerified:false};
 const here=inspectTerrainCell(terrainMap,position.x,position.y);
 if(!here.verified)return {verified:false,reason:here.reason||checks.noVerifiedPosition};
 const landPairs=terrainMap.landBlockedTilePairs;
 const waterPairs=worldTerrain.waterTilePairs?.filter(p=>p.tilesetId===terrainMap.tilesetId)
    .map(p=>[p.tile1,p.tile2]);
 if(!Array.isArray(landPairs)||!Array.isArray(waterPairs)||
    waterPairs.some(pair=>!Array.isArray(pair)||pair.length!==2))
  return {verified:false,reason:'Pares de colisão ROM não validados'};
 const directions=[['north',0,-1],['east',1,0],['south',0,1],['west',-1,0]];
 const neighbors=directions.map(([direction,dx,dy])=>{
  const x=position.x+dx,y=position.y+dy;
  if(x<0||y<0||x>=terrainMap.width||y>=terrainMap.height)
   return {direction,x,y,insideMap:false,staticOutcome:'OUTSIDE_MAP_NEEDS_BORDER',
    traversableNowVerified:false};
  const dest=inspectTerrainCell(terrainMap,x,y);
  if(!dest.verified)return {direction,x,y,insideMap:true,staticOutcome:'INCOMPLETE_TERRAIN_EVIDENCE',
    traversableNowVerified:false};
  const blockedLandPair=matchesPair(landPairs,here.tileId,dest.tileId);
  const blockedWaterPair=matchesPair(waterPairs,here.tileId,dest.tileId);
  const ledge=modeByte!==2?ledgeCandidate({romSha256:worldTerrain.romSha256,
    tilesetId:terrainMap.tilesetId,standingTileId:here.tileId,
    ledgeTileId:dest.tileId,direction}):
    {verified:false,ledgeCandidate:false,reason:'Surf não usa saltos de ledge terrestre'};
  let outcome;
  if(modeByte===2){
   if(blockedWaterPair)outcome='SURF_PAIR_COLLISION';
   else if(dest.tileId===0x14||dest.tileId===0x48||
           (dest.tileId===0x32&&terrainMap.tilesetId!==14))
    outcome='SURF_CAN_CONTINUE_IF_NO_DYNAMIC_OBSTACLE';
   else if(dest.passableByStaticLandTileset)outcome='SURF_CAN_DISEMBARK_IF_NO_DYNAMIC_OBSTACLE';
   else outcome='SURF_STATIC_BLOCKED';
  }else if(ledge.verified&&ledge.ledgeCandidate)
    outcome='LAND_LEDGE_HOP_CANDIDATE_REQUIRES_JOYPAD_AND_FLAGS';
  else if(blockedLandPair)outcome='LAND_PAIR_COLLISION_POSSIBLE_LEDGE_EXCEPTION';
  else if(dest.passableByStaticLandTileset)outcome='LAND_STATIC_PERMITTED_IF_NO_DYNAMIC_OBSTACLE';
  else outcome='LAND_STATIC_BLOCKED_POSSIBLE_LEDGE_EXCEPTION';
  return {direction,x,y,insideMap:true,tileId:dest.tileId,
   destinationLandPassable:dest.passableByStaticLandTileset,
   pairCollision:modeByte===2?blockedWaterPair:blockedLandPair,
   staticOutcome:outcome,traversableNowVerified:false,srcTileId:here.tileId,
   ledgeEvidence:ledge,ledgeJumpInCurrentFrameVerified:false};
 });
 return {verified:true,mapId:terrainMap.mapId,position:{x:position.x,y:position.y},
  modeByte,mode:modeByte===2?'SURF':modeByte===1?'BIKE':'WALK',neighbors,
  source:'SHA_VERIFIED_TILESETS + RAM_D700_MOVEMENT_MODE_SEQUENTIAL',
  constraints:['NPC or object collisions','jumping ledges and movement flags',
   'surf exit animation','event scripts and Cut/Strength',
   'same-frame timing not proven','cross-map movement'],
  actualMovementVerified:false,atomicSnapshotVerified:false};
}
module.exports={inspectMovementOptions};