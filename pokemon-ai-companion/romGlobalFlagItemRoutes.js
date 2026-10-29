'use strict';
// Route candidate to specific REMOTE hidden-item/coin coordinates. Flags
// establish pending state only; no live passage, pickup or scripts proven.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {findCrossMapItemPaths}=require('./romCrossMapItemRoute');
const inMap=n=>Number.isInteger(n)&&n>=0&&n<248;
const coord=n=>Number.isInteger(n)&&n>=0&&n<160;
const fail=reason=>({verified:false,reason,items:[],accessibleNow:null,
  routeNavigableNowProven:false});
function selectGlobalFlagTargets({ledger,objectives,sourceMapId,maxTargets=4}={}){
 const sha=ledger?.romSha256;
 if(ledger?.verified!==true||ledger.progressCompleteness!=='PARTIAL'||
    !isKnownAuditedRomSha(sha)||ledger.mapCount!==226||
    !Array.isArray(ledger.mapProgress)||ledger.mapProgress.length!==226||
    objectives?.verified!==true||objectives.romSha256!==sha||
    objectives.sourceMapId!==sourceMapId||objectives.mapCount!==226||
    !Array.isArray(objectives.objectives)||!inMap(sourceMapId)||
    !Number.isInteger(maxTargets)||maxTargets<1||maxTargets>16)
   return fail('Mapa, ROM, flags globais ou objetivos estáticos sem prova compatível');
 const records=new Map();
 for(const map of ledger.mapProgress){
   if(!inMap(map.mapId)||records.has(map.mapId)||!map.flagRecords||
      !Array.isArray(map.flagRecords.hiddenItems)||
      !Array.isArray(map.flagRecords.hiddenCoins))
     return fail('Registos de flags dos 226 mapas incompletos ou duplicados');
   records.set(map.mapId,map);
 }

 // Prefer one pending item per distinct destination map before consuming a
 // second slot for the same map. Preserve the objective planner's map order.
 const seen=new Set(),buckets=[];
 for(const goal of objectives.objectives){
   if(!inMap(goal?.mapId)||goal.mapId===sourceMapId||
      !(goal.mapHopCount===null||
        (Number.isInteger(goal.mapHopCount)&&goal.mapHopCount>=1)))continue;
   const record=records.get(goal.mapId);
   if(!record)continue;
   const bucket=[];
   for(const [kind,items] of [
     ['HIDDEN_ITEM',record.flagRecords.hiddenItems],
     ['HIDDEN_COIN',record.flagRecords.hiddenCoins]
   ])for(const item of items){
     if(item.flagSet!==false||!coord(item.x)||!coord(item.y)||
        !Number.isInteger(item.bitIndex))continue;
     const key=kind+':'+goal.mapId+':'+item.bitIndex;
     if(seen.has(key))continue;
     seen.add(key);
     bucket.push({kind,mapId:goal.mapId,
       mapName:record.name||goal.mapName||'Mapa #'+goal.mapId,
       x:item.x,y:item.y,bitIndex:item.bitIndex,
       mapHopCount:goal.mapHopCount,
       staticRouteKnown:goal.mapHopCount!==null,
       flagPendingVerified:true,visibleNowVerified:false,
       collectedNow:false,accessibleNow:null,recordId:item.recordId||key});
   }
   if(bucket.length)buckets.push(bucket);
 }
 const out=[];
 while(out.length<maxTargets&&buckets.some(bucket=>bucket.length)){
   for(const bucket of buckets){
     if(!bucket.length)continue;
     out.push(bucket.shift());
     if(out.length===maxTargets)break;
   }
 }
 return {verified:true,romSha256:sha,sourceMapId,items:out,
   limited:buckets.some(bucket=>bucket.length>0),
   accessibleNow:null,routeNavigableNowProven:false};
}
function planGlobalFlagItemRoutes({ledger,objectives,terrainAtlas,warpGraph,
 outdoorAlignment=null,sourceMapId,position,positionVerified=false,
 currentModeByte=null,canCut=false,canSurf=false,spritesVerified=false,
 currentMapEntities=[],maxTargets=4,maxStates=180,maxTransitions=10}={}){
 const selected=selectGlobalFlagTargets({ledger,objectives,sourceMapId,maxTargets});
 if(!selected.verified)return selected;
 if(selected.items.length===0)return {...selected,foundCount:0,
   reason:'Sem alvos remotos com flags pendentes e rota estática conhecida'};
 if(!positionVerified||!coord(position?.x)||!coord(position?.y)||
    ![0,1,2].includes(currentModeByte)||
    typeof canCut!=='boolean'||typeof canSurf!=='boolean')
   return fail('Posição ou capacidade RAM não corroborada para pesquisa remota');

 const routable=selected.items.filter(item=>item.staticRouteKnown===true);
 if(!routable.length)return {...selected,foundCount:0,exploredStates:0,
   maxStatesExceeded:false,
   items:selected.items.map(item=>({...item,route:null,
     routeNotAttemptedReason:'NO_STATIC_MAP_ROUTE',
     accessibleNow:null,routeNavigableNowProven:false})),
   scriptsVerified:false,itemsCollectedNowProven:false};
 const paths=findCrossMapItemPaths({
   romSha256:selected.romSha256,terrainAtlas,warpGraph,outdoorAlignment,
   sourceMapId,position,positionVerified,currentModeByte,
   canCut,canSurf,spritesVerified,currentMapEntities,
   targets:routable.map(x=>({mapId:x.mapId,x:x.x,y:x.y,hidden:true})),
   maxStates,maxTransitions
 });
 if(paths?.verified!==true||paths.romSha256!==selected.romSha256||
    paths.sourceMapId!==sourceMapId||!Array.isArray(paths.results)||
    paths.results.length!==routable.length)
   return fail('Motor multimapa sem resultados correspondentes à ROM e origem');
 for(let i=0;i<routable.length;i++){
   const goal=routable[i],r=paths.results[i];
   if(r?.verified!==true||r.romSha256!==selected.romSha256||
      r.sourceMapId!==sourceMapId||
      r.target?.mapId!==goal.mapId||
      r.target?.x!==goal.x||r.target?.y!==goal.y||
      r.target?.hidden!==true||r.accessibleNow!==null||
      r.routeNavigableNowProven!==false)
     return fail('Percurso não corresponde ao mapa, tile ou SHA do item remoto');
 }
 let routeIndex=0;
 return {...selected,foundCount:paths.foundCount,
   exploredStates:paths.exploredStates,maxStatesExceeded:paths.maxStatesExceeded,
   items:selected.items.map(item=>item.staticRouteKnown===true?
     {...item,route:paths.results[routeIndex++],
       accessibleNow:null,routeNavigableNowProven:false}:
     {...item,route:null,routeNotAttemptedReason:'NO_STATIC_MAP_ROUTE',
       accessibleNow:null,routeNavigableNowProven:false}),
   scriptsVerified:false,itemsCollectedNowProven:false};
}
module.exports={selectGlobalFlagTargets,planGlobalFlagItemRoutes};
