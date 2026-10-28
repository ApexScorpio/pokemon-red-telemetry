'use strict';
// Runtime annotation for the 251 LAST_MAP (=0xff) exits. Both D365 samples
// must match, and the target index must exist in the exact ROM's map list.
// Two matching sequential UDP reads are NOT an atomic emulator snapshot.
const KNOWN=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']);
function hexByte(x){return typeof x==='string'&&/^[0-9a-f]{2}$/i.test(x)?parseInt(x,16):null;}
function annotateLastMap(guide,profile,{firstByte,secondByte,mapSnapshotVerified=false}={}){
 const sha=String(profile?.hash?.sha256||'').toLowerCase();
 if(!guide?.verified||!mapSnapshotVerified||!KNOWN.has(sha)||guide.romSha256!==sha||
    !Array.isArray(guide.warps)||profile?.world?.maps?.valid!==true||
    !Array.isArray(profile.world.maps.data)||profile.world.maps.data.length!==248)
  return {verified:false,reason:'Guia/mapa RAM/ROM local não validados',atomicSnapshotVerified:false,guide};
 const initial=hexByte(firstByte),reread=hexByte(secondByte);
 if(initial===null||reread===null||initial!==reread)
  return {verified:false,reason:'D365 não foi lido duas vezes com o mesmo valor',atomicSnapshotVerified:false,guide};
 const target=profile.world.maps.data[initial];
 if(!target?.valid||target.mapId!==initial||!Array.isArray(target.objects?.warps))
  return {verified:false,reason:'LAST_MAP RAM aponta para mapa não validado na ROM',atomicSnapshotVerified:false,guide};
 const result=guide.warps.map(w=>{
  if(w.map!==255)return w;
  const landing=target.objects.warps[w.warp];
  if(!landing)return {...w,ramResolvedDestinationVerified:false,
   ramResolutionReason:'Índice do warp não existe no mapa LAST_MAP'};
  return {...w,ramResolvedDestinationVerified:true,
    resolvedMapId:initial,resolvedWarpIndex:w.warp,
    landingX:landing.x,landingY:landing.y,
    resolutionSource:'D365_START_END_MATCH_AND_EXACT_ROM_WARP_TABLE',
    atomicSnapshotVerified:false,accessibleNow:null};
 });
 return {verified:true,sequentialRamMatches:true,atomicSnapshotVerified:false,
   resolvedLastMapId:initial,
   resolvedWarpCount:result.filter(w=>w.map===255&&w.ramResolvedDestinationVerified).length,
   unresolvedWarpCount:result.filter(w=>w.map===255&&!w.ramResolvedDestinationVerified).length,
   guide:{...guide,warps:result,
    lastMapEvidence:{source:'RAM D365 reread + ROM map table',sequentiallyConsistent:true,
      atomicSnapshotVerified:false,romSha256:sha,readAddress:'D365'}},
   caution:'Duas leituras D365 iguais não provam snapshot atómico do frame ou que o jogo não mudará antes de atravessar a saída'};
}
module.exports={annotateLastMap};