'use strict';
// Topological loops around a current-map obstruction. A map cycle is NOT a
// path to the other side of a ledge: destination coordinates, border offsets,
// NPCs and scripts still need explicit ROM/RAM verification.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const validId=n=>Number.isInteger(n)&&n>=0&&n<248;
const fail=reason=>({verified:false,reason,candidates:[],
  targetAccessProven:false,currentTraversalProven:false});
function suggestWorldDetours({warpGraph,localExits,romSha256,
 mapId,target,localPathAbsent=false,maxHops=9,maxStates=800,
 maxSuggestions=4}={}){
 const sha=String(romSha256||'').toLowerCase();
 if(!isKnownAuditedRomSha(sha)||!validId(mapId)||
    !localPathAbsent||target?.mapId!==mapId||
    !Number.isInteger(target.x)||target.x<0||
    !Number.isInteger(target.y)||target.y<0||
    !Number.isInteger(maxHops)||maxHops<2||maxHops>16||
    !Number.isInteger(maxStates)||maxStates<1||maxStates>3000||
    !Number.isInteger(maxSuggestions)||maxSuggestions<1||maxSuggestions>12)
   return fail('Item, limites ou identidade de mapa/ROM não corroborados');
 if(warpGraph?.verified!==true||warpGraph.romSha256!==sha||
    warpGraph.totalWarpEntries!==813||warpGraph.normalMapHeaders!==226||
    !Array.isArray(warpGraph.edges)||warpGraph.edges.length!==813||
    localExits?.verified!==true||localExits.romSha256!==sha||
    localExits.mapId!==mapId||localExits.truncated===true||
    !Array.isArray(localExits.exits))
   return fail('Grafo ROM ou saídas geométricas da zona incompletos');
 const links=new Map();
 const add=e=>{
   if(!validId(e.sourceMapId)||!validId(e.destinationMapId))return;
   if(!links.has(e.sourceMapId))links.set(e.sourceMapId,[]);
   links.get(e.sourceMapId).push(e);
 };
 for(const e of warpGraph.edges){
   if(e.status==='STATIC_DESTINATION_WARP_VALIDATED'&&
      e.landing?.mapId===e.destinationMapId)
     add({kind:'WARP',sourceMapId:e.sourceMapId,
       destinationMapId:e.destinationMapId,
       sourceWarpIndex:e.sourceWarpIndex,
       destinationWarpIndex:e.destinationWarpIndex});
 }
 const borders=warpGraph.outdoorConnections;
 if(borders?.verified===true&&borders.romSha256===sha&&
    borders.edgeCount===78&&borders.reciprocalConnections===78&&
    Array.isArray(borders.edges)&&borders.edges.length===78)
   for(const e of borders.edges)add({kind:'OUTDOOR_BORDER',
     sourceMapId:e.sourceMapId,destinationMapId:e.destinationMapId,
     direction:e.direction});
 const evidenceFor=e=>localExits.exits.find(x=>
   x.kind===e.kind&&x.destinationMapId===e.destinationMapId&&
   (e.kind!=='WARP'||x.sourceWarpIndex===e.sourceWarpIndex)&&
   (e.kind!=='OUTDOOR_BORDER'||x.direction===e.direction))||null;
 const firstRank=e=>{
   const current=evidenceFor(e);
   if(!current)return 4;
   if(['THEORETICAL_TERRAIN_PATH',
     'TERRAIN_PATH_REQUIRES_CUT_ACTION',
     'TERRAIN_PATH_REQUIRES_SURF_ACTION'].includes(current.terrainStatus))return 0;
   if(current.terrainStatus==='BORDER_SOURCE_TERRAIN_CANDIDATES_ALIGNMENT_UNKNOWN')
     return 1;
   if(['CUT_NOT_USABLE_IN_CURRENT_PARTY','SURF_NOT_USABLE_IN_CURRENT_PARTY',
     'CUT_CAPABILITY_NOT_VERIFIED','SURF_CAPABILITY_NOT_VERIFIED',
     'CUT_AND_SURF_HYPOTHETICAL',
     'BORDER_SOURCE_NEEDS_CAPABILITY_ALIGNMENT_UNKNOWN'].includes(current.terrainStatus))
     return 2;
   if(['NO_REACHABLE_BORDER_TILE_NOT_PROOF_OF_LOCK',
     'NO_LOCAL_TERRAIN_PATH_NOT_PROOF_OF_LOCK',
     'ROM_EXIT_TILE_OUTSIDE_MAP'].includes(current.terrainStatus))
     return 3;
   return 4;
 };
 const firsts=(links.get(mapId)||[]).slice().sort((a,b)=>
   firstRank(a)-firstRank(b));
 const candidates=[],seenCycles=new Set();
 const queue=firsts.map(edge=>({
   mapId:edge.destinationMapId,
   steps:[edge],maps:[mapId,edge.destinationMapId],
   visited:new Set([mapId,edge.destinationMapId]),
   firstRank:firstRank(edge)
 }));
 let explored=0;
 // Search only simple map cycles, never a loop of two reciprocal borders.
 while(queue.length&&explored<maxStates&&candidates.length<maxSuggestions){
   const state=queue.shift();explored++;
   if(state.steps.length>=maxHops)continue;
   for(const e of links.get(state.mapId)||[]){
     if(e.destinationMapId===mapId){
       const first=state.steps[0],last=e;
       if(state.steps.length===1&&
          ((first.kind==='OUTDOOR_BORDER'&&last.kind==='OUTDOOR_BORDER')||
           (first.kind==='WARP'&&last.kind==='WARP'&&
            last.destinationWarpIndex===first.sourceWarpIndex)))continue;
       const path=[...state.steps,e],maps=[...state.maps,mapId];
       const signature=maps.join(':');
       if(seenCycles.has(signature))continue;
       seenCycles.add(signature);
       candidates.push({mapIds:maps,transitions:path.length,
         transitionsEvidence:path,firstExitTerrainRank:state.firstRank,
         startsWithConditionalCapability:state.firstRank===2,
         includesOutdoorBorder:path.some(x=>x.kind==='OUTDOOR_BORDER'),
         firstExitEvidence:(()=>{
           const observed=evidenceFor(first);
           if(!observed)return {known:false};
           const borderTile=observed.kind==='OUTDOOR_BORDER'?
             observed.borderEvidence?.borderTiles?.[0]?.tile:null;
           const firstStep=observed.kind==='OUTDOOR_BORDER'?
             observed.borderEvidence?.borderTiles?.[0]?.firstTerrainStep:
             observed.approach?.nextStep;
           return {known:true,kind:first.kind,
             fromMapId:mapId,toMapId:first.destinationMapId,
             terrainStatus:observed.terrainStatus,
             firstTerrainStep:firstStep??null,
             candidateBorderTile:borderTile??null,
             crossingAlignmentVerified:false,
             canTraverseNowProven:false};
         })(),
         scriptsAndDynamicBarriersVerified:false,
         returnsToTargetSideProven:false,
         passageIntoItemTileProven:false,usableNow:null});
     }else if(!state.visited.has(e.destinationMapId)&&
       state.steps.length+1<maxHops){
       queue.push({mapId:e.destinationMapId,
         steps:[...state.steps,e],
         maps:[...state.maps,e.destinationMapId],
         visited:new Set([...state.visited,e.destinationMapId]),
         firstRank:state.firstRank});
     }
     if(candidates.length>=maxSuggestions)break;
   }
 }
 candidates.sort((a,b)=>a.firstExitTerrainRank-b.firstExitTerrainRank||
   a.transitions-b.transitions||a.mapIds.join(':').localeCompare(b.mapIds.join(':')));
 return {verified:true,romSha256:sha,mapId,
   target:{mapId,x:target.x,y:target.y},
   candidates,exploredStates:explored,
   searchBudgetExhausted:queue.length>0&&explored>=maxStates,
   suggestionsTruncated:queue.length>0&&candidates.length>=maxSuggestions,
   targetAccessProven:false,currentTraversalProven:false,
   geometryBeyondFirstMapVerified:false,
   includesOnlyStaticMapLinks:true,
   warning:'Ciclos topológicos, não caminhos até ao item: falta comprovar em que tile se regressa ao mapa, Cut/Surf, colisões e scripts.'};
}
module.exports={suggestWorldDetours};
