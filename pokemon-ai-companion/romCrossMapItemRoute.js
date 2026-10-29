'use strict';
// Bounded multi-map ROUTE HYPOTHESIS for SHA-audited Gen I ROM maps.
// Crosses only static warps with verified landing coordinates. Neither a
// candidate path nor failure to find one proves actual access or blockage.
const {terrainBytes,computeReach,candidatePath}=require('./romItemReachability');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const byte=x=>Number.isInteger(x)&&x>=0&&x<248;
const pos=p=>Number.isInteger(p?.x)&&Number.isInteger(p?.y)&&p.x>=0&&p.y>=0;
const reject=reason=>({verified:false,found:false,reason,
  accessibleNow:null,routeNavigableNowProven:false});
function exactTilePath(reach,p){
 if(!reach||!pos(p)||p.x>=reach.width||p.y>=reach.height)return null;
 const n=reach.width*reach.height,index=p.y*reach.width+p.x;
 let best=null;
 for(const mode of [0,1]){
   let cursor=index+mode*n;
   if(reach.prev[cursor]===-1)continue;
   let steps=0,usesCut=false,usesSurf=false,usesLedge=false,first=null;
   while(cursor!==reach.startIndex){
     const parent=reach.prev[cursor];
     if(parent===-1||parent===cursor||steps>=reach.length){steps=-1;break;}
     usesCut=usesCut||reach.changes[cursor]===1;
     usesSurf=usesSurf||reach.changes[cursor]===2;
     usesLedge=usesLedge||reach.jump[cursor]===1;
     if(parent===reach.startIndex){
       const cell=cursor%n;
       first={x:cell%reach.width,y:Math.floor(cell/reach.width)};
     }
     cursor=parent;steps++;
   }
   if(steps<0)continue;
   const candidate={steps,nextStep:first,usesCut,usesSurf,usesLedge,
     arrivalTile:{x:p.x,y:p.y}};
   if(!best||steps<best.steps)best=candidate;
 }
 return best;
}
function findCrossMapItemPath({romSha256,terrainAtlas,warpGraph,
 sourceMapId,position,target,positionVerified=false,
 currentModeByte=null,canCut=false,canSurf=false,
 spritesVerified=false,currentMapEntities=[],maxTransitions=10,
 maxStates=180}={}){
 const sha=String(romSha256||'').toLowerCase();
 if(!isKnownAuditedRomSha(sha)||!positionVerified||!byte(sourceMapId)||
    !byte(target?.mapId)||!pos(position)||!pos(target)||
    ![0,1,2].includes(currentModeByte)||typeof canCut!=='boolean'||
    typeof canSurf!=='boolean'||!Number.isInteger(maxTransitions)||
    maxTransitions<0||maxTransitions>20||!Number.isInteger(maxStates)||
    maxStates<1||maxStates>500)
  return reject('ROM SHA, mapa, posição RAM, capacidades ou limites não comprovados');
 if(terrainAtlas?.verified!==true||terrainAtlas.romSha256!==sha||
    !Array.isArray(terrainAtlas.maps)||terrainAtlas.maps.length!==226||
    warpGraph?.verified!==true||warpGraph.romSha256!==sha||
    warpGraph.totalWarpEntries!==813||warpGraph.normalMapHeaders!==226||
    !Array.isArray(warpGraph.edges)||warpGraph.edges.length!==813)
  return reject('Índice de 226 mapas ou 813 warps da ROM não validado');
 const maps=new Map();
 for(const m of terrainAtlas.maps){
   if(!byte(m.mapId)||maps.has(m.mapId))return reject('Terreno de mapa duplicado ou inválido');
   maps.set(m.mapId,m);
 }
 if(!maps.has(sourceMapId)||!maps.has(target.mapId))
  return reject('Origem ou destino fora dos 226 mapas de terreno auditados');
 const exits=new Map();
 for(const e of warpGraph.edges){
   if(e?.status!=='STATIC_DESTINATION_WARP_VALIDATED')continue;
   if(!maps.has(e.sourceMapId)||!maps.has(e.destinationMapId)||
      e.landing?.mapId!==e.destinationMapId||
      !pos(e)||!pos(e.landing))continue;
   if(!exits.has(e.sourceMapId))exits.set(e.sourceMapId,[]);
   exits.get(e.sourceMapId).push(e);
 }
 const grids=new Map();
 const gridFor=id=>{
   if(grids.has(id))return grids.get(id);
   const m=maps.get(id);
   const verified=terrainBytes({...m,verified:true},sha);
   grids.set(id,verified);return verified;
 };
 const first=gridFor(sourceMapId);
 if(!first||position.x>=first.width||position.y>=first.height)
  return reject('Coordenadas RAM fora do terreno da ROM de origem');
 const key=(id,x,y)=>id+':'+x+':'+y;
 const seen=new Set([key(sourceMapId,position.x,position.y)]);
 const queue=[{mapId:sourceMapId,x:position.x,y:position.y,
   segments:[],steps:0}];
 let explored=0;
 for(let cursor=0;cursor<queue.length&&explored<maxStates;cursor++){
   const state=queue[cursor],grid=gridFor(state.mapId);
   explored++;
   if(!grid||state.x>=grid.width||state.y>=grid.height)continue;
   const reach=computeReach(grid,{x:state.x,y:state.y},{
     canCut,canSurf,
     currentSurf:state.segments.length===0&&currentModeByte===2,
     actors:state.segments.length===0?currentMapEntities:[],
     spritesVerified:state.segments.length===0&&spritesVerified
   });
   if(!reach)continue;
   if(state.mapId===target.mapId&&target.x<grid.width&&target.y<grid.height){
     const last=candidatePath(reach,target,{hidden:target.hidden===true});
     if(last)return {verified:true,found:true,sourceMapId,
       target:{mapId:target.mapId,x:target.x,y:target.y,
         hidden:target.hidden===true},
       romSha256:sha,warpTransitions:state.segments.length,
       theoreticalSteps:state.steps+last.steps,
       segments:state.segments,finalLocalRoute:last,
       nextTerrainTile:state.segments[0]?.localRoute?.nextStep||
         last.nextStep||null,
       exploredStates:explored,
       routeNavigableNowProven:false,accessibleNow:null,
       scriptsAndDynamicBarriersVerified:false,
       snapshotAtomicVerified:false,
       scope:'STATIC_WARPS_ONLY_NO_OUTDOOR_CONNECTIONS',
       note:'Hipótese topológica e de terreno ROM. Falta validar portas, NPC, flags, Surf/Cut e warps ativos.'};
   }
   if(state.segments.length>=maxTransitions)continue;
   for(const e of exits.get(state.mapId)||[]){
     if(e.x>=grid.width||e.y>=grid.height)continue;
     const approach=exactTilePath(reach,e);
     if(!approach)continue;
     const landing=e.landing,nextGrid=gridFor(landing.mapId);
     if(!nextGrid||landing.x>=nextGrid.width||landing.y>=nextGrid.height)continue;
     const nextKey=key(landing.mapId,landing.x,landing.y);
     if(seen.has(nextKey))continue;
     seen.add(nextKey);
     queue.push({mapId:landing.mapId,x:landing.x,y:landing.y,
       steps:state.steps+approach.steps,
       segments:[...state.segments,{
         sourceMapId:state.mapId,sourceWarpIndex:e.sourceWarpIndex,
         sourceWarpTile:{x:e.x,y:e.y},
         destinationMapId:landing.mapId,destinationWarpIndex:landing.warpIndex,
         landing:{x:landing.x,y:landing.y},localRoute:approach,
         transitionGuaranteed:false}]});
   }
 }
 return {verified:true,found:false,romSha256:sha,sourceMapId,
   target:{mapId:target.mapId,x:target.x,y:target.y},
   exploredStates:explored,maxStatesExceeded:queue.length>maxStates,
   accessibleNow:null,routeNavigableNowProven:false,
   reason:'Sem percurso neste cenário de terreno, warps estáticos e capacidades consideradas. '+
     'Isso não prova bloqueio: faltam ligações exteriores, Cut/Surf dinâmicos, elevadores e scripts.'};
}
module.exports={findCrossMapItemPath,exactTilePath};
