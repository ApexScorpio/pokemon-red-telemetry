'use strict';
// World objective planner. Routes are over the validated STATIC graph only;
// this is never a claim that a door, NPC or item is accessible in live play.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const id=n=>Number.isInteger(n)&&n>=0&&n<248;
const nonnegative=n=>Number.isInteger(n)&&n>=0;
const invalid=reason=>({verified:false,reason,objectives:[],
  routeGraphVerified:false,progressCompleteness:'UNKNOWN'});
function campaignObjectives({ledger,warpGraph,sourceMapId,
 firstMapTerrainHints=null,firstMapExitAccess=null,
 outdoorOverlapIndex=null,position=null,maxResults=12}={}){
 if(ledger?.verified!==true||ledger.progressCompleteness!=='PARTIAL'||
    !isKnownAuditedRomSha(ledger.romSha256)||ledger.mapCount!==226||
    !Array.isArray(ledger.mapProgress)||ledger.mapProgress.length!==226)
  return invalid('Progresso ROM/RAM mundial ainda não comprovado');
 if(!id(sourceMapId)||!ledger.mapProgress.some(m=>m.mapId===sourceMapId))
  return invalid('Mapa atual não corresponde aos 226 cabeçalhos normais auditados');
 if(!Number.isInteger(maxResults)||maxResults<1||maxResults>226)
  return invalid('Limite de sugestões inválido');
 const mapIds=new Set();
 for(const m of ledger.mapProgress){
   if(!id(m?.mapId)||mapIds.has(m.mapId)||
      ![m.hiddenItems?.notCollected,m.hiddenCoins?.notCollected,
        m.trainers?.gatesOpen,m.trainers?.unknown,
        m.stationaryPokemon?.gatesOpen,m.stationaryPokemon?.unknown]
       .every(nonnegative))
     return invalid('Mapa duplicado ou progresso por flag malformado');
   mapIds.add(m.mapId);
 }
 // The traversal is one BFS across all eligible links, rather than running
 // an expensive one-to-one route search for each possible goal.
 const graphOK=warpGraph?.verified===true&&
   warpGraph.romSha256===ledger.romSha256&&
   Array.isArray(warpGraph.edges)&&warpGraph.edges.length===813&&
   warpGraph.totalWarpEntries===813&&warpGraph.normalMapHeaders===226;
 const overlapsOK=graphOK&&outdoorOverlapIndex?.verified===true&&
   outdoorOverlapIndex.romSha256===ledger.romSha256&&
   outdoorOverlapIndex.edgeCount===78&&
   outdoorOverlapIndex.edges?.length===78;
 const overlapped=overlapsOK?new Map(outdoorOverlapIndex.edges.map(e=>[
   e.sourceMapId+':'+e.direction+':'+e.destinationMapId,e])):null;
 const links=new Map();
 const add=(source,dest,kind,detail)=>{
   if(!mapIds.has(source)||!mapIds.has(dest))return;
   if(!links.has(source))links.set(source,[]);
   links.get(source).push({sourceMapId:source,destinationMapId:dest,
     kind,...detail});
 };
 if(graphOK){
   for(const e of warpGraph.edges){
     if(e.status==='STATIC_DESTINATION_WARP_VALIDATED'&&
        e.landing?.mapId===e.destinationMapId)
       add(e.sourceMapId,e.destinationMapId,'STATIC_WARP',
         {sourceWarpIndex:e.sourceWarpIndex});
   }
   if(warpGraph.outdoorConnections?.verified===true&&
      Array.isArray(warpGraph.outdoorConnections.edges))
     for(const e of warpGraph.outdoorConnections.edges){
       const match=overlapped?.get(
         e.sourceMapId+':'+e.direction+':'+e.destinationMapId);
       add(e.sourceMapId,e.destinationMapId,'OUTDOOR_BOUNDARY',
         {direction:e.direction??null,
          romAlignedBorder:match?.sourceAndDestinationAlignmentVerified===true,
          staticLandCompatiblePairs:match?.staticLandCompatiblePairs??null,
          waterTerrainPairs:match?.waterTerrainPairs??null,
          passageObserved:false});
     }
 }
 // Order the FIRST transition by corroborated *static land* terrain.
 // A failed land-only route is not proof of a game lock: Surf, Cut, scripted
 // doors and moved sprites can make another outcome possible.
 const hintsOK=graphOK&&firstMapTerrainHints?.verified===true&&
   firstMapTerrainHints.mapId===sourceMapId&&
   firstMapTerrainHints.romSha256===ledger.romSha256&&
   firstMapTerrainHints.positionFromRam?.x===position?.x&&
   firstMapTerrainHints.positionFromRam?.y===position?.y&&
   Array.isArray(firstMapTerrainHints.candidates);
 // The local exit engine knows Cut/Surf capabilities from the current
 // verified RAM window. Prefer it to the old land-only terrain preview.
 const exitsOK=graphOK&&firstMapExitAccess?.verified===true&&
   firstMapExitAccess.romSha256===ledger.romSha256&&
   firstMapExitAccess.mapId===sourceMapId&&
   firstMapExitAccess.positionFromRam?.x===position?.x&&
   firstMapExitAccess.positionFromRam?.y===position?.y&&
   Array.isArray(firstMapExitAccess.exits)&&
   firstMapExitAccess.truncated!==true;
 const evidenceFor=edge=>{
   if(!exitsOK)return null;
   if(edge.kind==='STATIC_WARP')return firstMapExitAccess.exits.find(x=>
     x.kind==='WARP'&&x.sourceWarpIndex===edge.sourceWarpIndex&&
     x.destinationMapId===edge.destinationMapId&&
     x.staticDestinationStatus==='STATIC_DESTINATION_WARP_VALIDATED')||null;
   if(edge.kind==='OUTDOOR_BOUNDARY')return firstMapExitAccess.exits.find(x=>
     x.kind==='OUTDOOR_BORDER'&&x.direction===edge.direction&&
     x.destinationMapId===edge.destinationMapId)||null;
   return null;
 };
 const firstRank=edge=>{
   const local=evidenceFor(edge);
   if(local){
     switch(local.terrainStatus){
       case 'THEORETICAL_TERRAIN_PATH':
       case 'TERRAIN_PATH_REQUIRES_CUT_ACTION':
       case 'TERRAIN_PATH_REQUIRES_SURF_ACTION':
       case 'BORDER_ALIGNED_TERRAIN_CANDIDATES_TRANSFER_UNVERIFIED':return 0;
       case 'BORDER_SOURCE_TERRAIN_CANDIDATES_ALIGNMENT_UNKNOWN':return 1;
       case 'BORDER_ALIGNED_REQUIRES_CAPABILITY_TRANSFER_UNVERIFIED':
       case 'BORDER_SOURCE_NEEDS_CAPABILITY_ALIGNMENT_UNKNOWN':
       case 'NO_REACHABLE_BORDER_TILE_NOT_PROOF_OF_LOCK':return 2;
       case 'NO_LOCAL_TERRAIN_PATH_NOT_PROOF_OF_LOCK':
       case 'ROM_EXIT_TILE_OUTSIDE_MAP':
       case 'CUT_NOT_USABLE_IN_CURRENT_PARTY':
       case 'SURF_NOT_USABLE_IN_CURRENT_PARTY':
       case 'CUT_CAPABILITY_NOT_VERIFIED':
       case 'SURF_CAPABILITY_NOT_VERIFIED':
       case 'CUT_AND_SURF_HYPOTHETICAL':return 2;
       default:return 1;
     }
   }
   if(edge.kind!=='STATIC_WARP'||!hintsOK)return 1;
   const h=firstMapTerrainHints.candidates.find(x=>
     x.warpIndex===edge.sourceWarpIndex&&
     x.destinationMapId===edge.destinationMapId);
   if(!h)return 1;
   return h.theoreticalTerrainPathFound===true?0:
     h.theoreticalTerrainPathFound===false?2:1;
 };
 const labels=['LOCAL_TERRAIN_PATH_CANDIDATE','TERRAIN_NOT_VERIFIED',
   'NO_LOCAL_LAND_PATH_FOUND_NOT_PROOF_OF_BLOCK'];
 const prev=new Map([[sourceMapId,null]]);
 const firstTerrain=new Map([[sourceMapId,'CURRENT_MAP']]);
 // Three BFS waves. Prefer a first warp with a static-terrain solution,
 // even if another first warp offers fewer map hops. Within each wave,
 // the BFS is shortest in static transitions, never in player steps.
 for(const tier of [0,1,2]){
   const queue=[];
   for(const edge of links.get(sourceMapId)||[]){
     if(firstRank(edge)!==tier||prev.has(edge.destinationMapId))continue;
     prev.set(edge.destinationMapId,{from:sourceMapId,edge});
     firstTerrain.set(edge.destinationMapId,labels[tier]);
     queue.push(edge.destinationMapId);
   }
   for(let index=0;index<queue.length;index++){
     const map=queue[index];
     for(const edge of links.get(map)||[]){
       if(prev.has(edge.destinationMapId))continue;
       prev.set(edge.destinationMapId,{from:map,edge});
       firstTerrain.set(edge.destinationMapId,labels[tier]);
       queue.push(edge.destinationMapId);
     }
   }
 }
 const pathTo=target=>{
   if(!graphOK||!prev.has(target))return null;
   const result=[];let current=target;
   while(current!==sourceMapId){
     const parent=prev.get(current);
     if(!parent||result.length>=226)return null;
     result.push(parent.edge);current=parent.from;
   }
   return result.reverse();
 };
 const goals=[];
 let mapsWithPending=0, mapsWithUnknown=0;
 for(const m of ledger.mapProgress){
   const pending={
     hiddenItems:m.hiddenItems.notCollected,
     hiddenCoins:m.hiddenCoins.notCollected,
     trainerGatesOpen:m.trainers.gatesOpen,
     stationaryGatesOpen:m.stationaryPokemon.gatesOpen
   };
   const unknown={
     trainers:m.trainers.unknown,
     stationaryPokemon:m.stationaryPokemon.unknown
   };
   const pendingFlags=Object.values(pending).reduce((a,b)=>a+b,0);
   const unknownFlags=Object.values(unknown).reduce((a,b)=>a+b,0);
   if(pendingFlags>0)mapsWithPending++;
   if(unknownFlags>0)mapsWithUnknown++;
   if(!pendingFlags&&!unknownFlags)continue;
   const route=pathTo(m.mapId);
   goals.push({mapId:m.mapId,mapName:m.name||'Mapa #'+m.mapId,
     pending,unknown,pendingFlags,unknownFlags,
     routeGraphVerified:graphOK,
     // A topological link count, NOT walking steps or current reachability.
     mapHopCount:route?.length??null,
     route:route?.map(e=>({...e}))??null,
     firstTransitionTerrainEvidence:route?
       (firstTerrain.get(m.mapId)||'TERRAIN_NOT_VERIFIED'):null,
     firstTransitionConditionalAccess:route?.[0]?
       (evidenceFor(route[0])?.terrainStatus??null):null,
     routeNavigableNowProven:false,
     locationAccessibleNow:null,
     kind:pendingFlags>0?'VERIFIED_OPEN_FLAGS':'UNRESOLVED_FLAGS_ONLY'
   });
 }
 goals.sort((a,b)=>{
   const pendingA=a.pendingFlags>0?0:1,pendingB=b.pendingFlags>0?0:1;
   if(pendingA!==pendingB)return pendingA-pendingB;
   // For connected objectives prefer fewer static map transitions.
   const hopsA=a.mapHopCount??Infinity,hopsB=b.mapHopCount??Infinity;
   if(hopsA!==hopsB)return hopsA-hopsB;
   if(a.pendingFlags!==b.pendingFlags)return b.pendingFlags-a.pendingFlags;
   return a.mapId-b.mapId;
 });
 return {verified:true,romSha256:ledger.romSha256,
   sourceMapId,routeGraphVerified:graphOK,
   firstMapTerrainHintsCorroborated:hintsOK,
   firstMapExitAccessCorroborated:exitsOK,
   outdoorGlobalOverlapCorroborated:overlapsOK,
   mapCount:ledger.mapCount,mapsWithPending,mapsWithUnknown,
   totalObjectives:goals.length,objectives:goals.slice(0,maxResults),
   catalogueTruncated:goals.length>maxResults,
   progressCompleteness:'PARTIAL',
   routeNavigableNowProven:false,
   warnings:[
     'Uma flag não ativada pode indicar evento não concluído, mas não prova acesso atual',
     'Distâncias são transições entre mapas estáticos, não passos nem rotas desbloqueadas',
     'Apenas a primeira transição usa terreno local; as ligações seguintes carecem de geometria e scripts',
     'A preferência por Cut/Surf depende de capacidades na RAM e não confirma que a ação do jogo tenha ocorrido',
     'O alinhamento de bordas via ponteiros ROM não prova a execução da transição na partida',
     'Zero pares terrestres numa fronteira pode exigir água, Cut ou script; não prova bloqueio',
     'Ausência de caminho terrestre não prova bloqueio: Surf e Cut podem mudar o resultado',
     'LAST_MAP, elevadores, Cut/Surf/Strength, portas e scripts dinâmicos não estão resolvidos',
     'Os eventos sem flags mapeadas não são tratados como concluídos'
   ]};
}
module.exports={campaignObjectives};
