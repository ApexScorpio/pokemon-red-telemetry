'use strict';
// World objective planner. Routes are over the validated STATIC graph only;
// this is never a claim that a door, NPC or item is accessible in live play.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const id=n=>Number.isInteger(n)&&n>=0&&n<248;
const nonnegative=n=>Number.isInteger(n)&&n>=0;
const invalid=reason=>({verified:false,reason,objectives:[],
  routeGraphVerified:false,progressCompleteness:'UNKNOWN'});
function campaignObjectives({ledger,warpGraph,sourceMapId,maxResults=12}={}){
 if(ledger?.verified!==true||ledger.progressCompleteness!=='PARTIAL'||
    !isKnownAuditedRomSha(ledger.romSha256)||ledger.mapCount!==226||
    !Array.isArray(ledger.mapProgress)||ledger.mapProgress.length!==226)
  return invalid('Progresso ROM/RAM mundial ainda não comprovado');
 if(!id(sourceMapId)||!ledger.mapProgress.some(m=>m.mapId===sourceMapId))
  return invalid('Mapa atual não corresponde aos 226 cabeçalhos normais auditados');
 if(!Number.isInteger(maxResults)||maxResults<1||maxResults>50)
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
     for(const e of warpGraph.outdoorConnections.edges)
       add(e.sourceMapId,e.destinationMapId,'OUTDOOR_BOUNDARY',
         {direction:e.direction??null});
 }
 const prev=new Map([[sourceMapId,null]]);
 const queue=[sourceMapId];
 for(let index=0;index<queue.length;index++){
   const map=queue[index];
   for(const edge of links.get(map)||[]){
     if(prev.has(edge.destinationMapId))continue;
     prev.set(edge.destinationMapId,{from:map,edge});
     queue.push(edge.destinationMapId);
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
   mapCount:ledger.mapCount,mapsWithPending,mapsWithUnknown,
   totalObjectives:goals.length,objectives:goals.slice(0,maxResults),
   progressCompleteness:'PARTIAL',
   routeNavigableNowProven:false,
   warnings:[
     'Uma flag não ativada pode indicar evento não concluído, mas não prova acesso atual',
     'Distâncias são transições entre mapas estáticos, não passos nem rotas desbloqueadas',
     'LAST_MAP, elevadores, Cut/Surf/Strength, portas e scripts dinâmicos não estão resolvidos',
     'Os eventos sem flags mapeadas não são tratados como concluídos'
   ]};
}
module.exports={campaignObjectives};
