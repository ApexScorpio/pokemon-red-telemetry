'use strict';
// Conservative route previews to known in-map warp locations.
// These are geometric suggestions, NOT a guarantee that a route can be walked
// in a live game: sprite, cut trees, strength boulders, scripted barriers etc.
const {findTerrainRoute}=require('./romTerrainAtlas');
const KNOWN=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']);
function terrainWarpHints(guide,coords,{maxWarps=24,maxSteps=2000}={}){
 const sha=String(guide?.romSha256||'').toLowerCase();
 if(!guide?.verified||!KNOWN.has(sha)||guide.terrain?.verified!==true||
    guide.terrain.mapId!==guide.mapId||!Array.isArray(guide.warps)||
    !coords||!Number.isInteger(coords.x)||!Number.isInteger(coords.y)||
    !Number.isInteger(maxWarps)||maxWarps<1||maxWarps>64)
   return {verified:false,reason:'Guia/ROM/posição RAM não confirmados'};
 const candidates=guide.warps.slice(0,maxWarps).map((w,index)=>{
   const route=findTerrainRoute(guide.terrain,coords,{x:w.x,y:w.y},{maxSteps});
   const next=route.verified&&route.path.length>1?route.path[1]:null;
   const nextInstruction=next?next.x>coords.x?'Este':next.x<coords.x?'Oeste':
     next.y>coords.y?'Sul':'Norte':null;
   return {warpIndex:index,x:w.x,y:w.y,destinationMapId:w.map??w.destinationMap,
    destinationWarpIndex:w.warp??w.destinationWarp,
    destinationRamResolved:w.ramResolvedDestinationVerified===true,
    theoreticalTerrainPathFound:route.verified===true,
    theoreticalSteps:route.verified?route.stepsOnStaticTerrain:null,
    nextTerrainTile:next,nextTerrainDirection:nextInstruction,
    inaccessibleNowProven:false,accessibleNow:null,
    reason:route.verified?null:route.reason||'Sem percurso estático certificado',
    landPairRulesConsidered:route.verified?route.landTilePairRulesApplied===true:null,
    exactMovementRouteVerified:false};
 });
 return {verified:true,mapId:guide.mapId,romSha256:sha,
    positionFromRam:{x:coords.x,y:coords.y},candidates,
    pathsWithStaticTerrainSolution:candidates.filter(c=>c.theoreticalTerrainPathFound).length,
    note:'Propostas por tilesets. Não inclui sprites, scripts, colisões móveis, Cut, Strength, Surf e barreiras de história. Não garante percurso.',
    routeNavigableNowProven:false,atomicSnapshotVerified:false};
}
module.exports={terrainWarpHints};