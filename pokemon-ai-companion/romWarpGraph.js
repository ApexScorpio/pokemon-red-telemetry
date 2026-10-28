'use strict';
// Entire map-warp graph for the three exact 1 MiB ROMs. Never infer dynamic
// LAST_MAP or elevator floor destinations from static object bytes.
const KNOWN=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']);
const RESERVED=new Set([11,105,106,107,109,110,111,112,114,115,116,117,
 204,205,206,231,237,238,241,242,243,244]);
const intByte=n=>Number.isInteger(n)&&n>=0&&n<=255;
function normalizedWarp(w){
 if(!w||!intByte(w.x)||!intByte(w.y))return null;
 const map=w.destinationMap??w.map,warp=w.destinationWarp??w.warp;
 if(!intByte(map)||!intByte(warp))return null;
 return {x:w.x,y:w.y,destinationMap:map,destinationWarp:warp};
}
function buildWarpGraph(profile){
 const sha=String(profile?.hash?.sha256||'').toLowerCase();
 const maps=profile?.world?.maps;
 if(!KNOWN.has(sha)||profile.unknownLayout===true||maps?.valid!==true||
    !Array.isArray(maps.data)||maps.data.length!==248||
    maps.data.some((m,id)=>m.mapId!==id))
  return {verified:false,reason:'Identidade SHA da ROM ou 248 mapas ainda não validados'};
 const byId=new Map(maps.data.filter(m=>m.valid).map(m=>[m.mapId,m]));
 const edges=[];
 for(const m of maps.data){
  if(!m.valid)continue;
  const warps=m.objects?.warps;
  if(!Array.isArray(warps))return {verified:false,reason:'Warps ausentes no mapa #'+m.mapId};
  for(let i=0;i<warps.length;i++){
   const w=normalizedWarp(warps[i]);
   if(!w)return {verified:false,reason:'Warp não tem quatro bytes válidos: mapa #'+m.mapId+' índice '+i};
   const dest=byId.get(w.destinationMap);
   let status,landing=null;
   if(w.destinationMap===255)status='LAST_MAP_RAM_REQUIRED';
   else if(dest){
    const other=dest.objects?.warps||[];
    if(w.destinationWarp>=other.length)status='STATIC_DESTINATION_WARP_INDEX_INVALID';
    else {
     const target=normalizedWarp(other[w.destinationWarp]);
     if(!target)return {verified:false,reason:'Warp de destino malformado: mapa #'+dest.mapId};
     status='STATIC_DESTINATION_WARP_VALIDATED';
     landing={mapId:dest.mapId,warpIndex:w.destinationWarp,x:target.x,y:target.y};
    }
   }else if(w.destinationMap===237&&m.mapId===236)
    status='SILPH_ELEVATOR_SCRIPT_PATCH_REQUIRED';
   else status=RESERVED.has(w.destinationMap)?
    'RESERVED_MAP_REFERENCE_REQUIRES_SCRIPT':'UNRESOLVED_DESTINATION_MAP';
   edges.push({sourceMapId:m.mapId,sourceWarpIndex:i,
    x:w.x,y:w.y,destinationMapId:w.destinationMap,
    destinationWarpIndex:w.destinationWarp,status,landing,
    accessibleNow:null,scriptGateVerified:false,liveRamDestinationProven:false});
  }
 }
 const counts={};for(const edge of edges)counts[edge.status]=(counts[edge.status]||0)+1;
 return {verified:true,romSha256:sha,normalMapHeaders:byId.size,
  reservedReferenceMapIds:RESERVED.size,totalWarpEntries:edges.length,
  statusCounts:counts,edges,
  completeness:'ALL_ROM_OBJECT_WARPS_ONLY',
  outdoorHeaderConnectionsDecoded:false,scriptGatesResolved:false,
  liveDestinationProof:false,
  notes:'Static warp transitions are not proof of access. LAST_MAP requires wLastMap RAM; elevators patch wWarpEntries.'};
}
function findStaticWarpRoute(graph,sourceId,targetId,{maxHops=24}={}){
 if(!graph?.verified||!intByte(sourceId)||!intByte(targetId)||
    !Number.isInteger(maxHops)||maxHops<1||maxHops>64)
  return {verified:false,reason:'Grafo ou argumentos não validados'};
 const eligible=graph.edges.filter(e=>e.status==='STATIC_DESTINATION_WARP_VALIDATED');
 if(sourceId===targetId)return {verified:true,sourceMapId:sourceId,targetMapId:targetId,
    edges:[],hopCount:0,routeNavigableNowProven:false,includesOutdoorConnections:false};
 const visited=new Set([sourceId]),queue=[{id:sourceId,path:[]}];
 for(let qi=0;qi<queue.length;qi++){
  const item=queue[qi];if(item.path.length>=maxHops)continue;
  for(const e of eligible){
   if(e.sourceMapId!==item.id||visited.has(e.destinationMapId))continue;
   const path=[...item.path,e];
   if(e.destinationMapId===targetId)return {verified:true,sourceMapId:sourceId,
     targetMapId:targetId,hopCount:path.length,edges:path,
     routeNavigableNowProven:false,includesOutdoorConnections:false,
     warning:'Somente warps estáticos: faltam ligações de fronteira, elevadores e condições de scripts/RAM'};
   visited.add(e.destinationMapId);queue.push({id:e.destinationMapId,path});
  }
 }
 return {verified:false,sourceMapId:sourceId,targetMapId:targetId,
  reason:'Não há percurso por warps estáticos; isso não prova inacessibilidade no jogo',
  pathUnavailableIsNotUnreachable:true};
}
module.exports={buildWarpGraph,findStaticWarpRoute,normalizedWarp};