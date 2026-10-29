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
 const seen=new Set(),out=[];
 for(const goal of objectives.objectives){
   if(!inMap(goal?.mapId)||goal.mapId===sourceMapId||
      !Number.isInteger(goal.mapHopCount)||goal.mapHopCount<1)continue;
   const record=records.get(goal.mapId);
   if(!record)continue;
   for(const [kind,items] of [
     ['HIDDEN_ITEM',record.flagRecords.hiddenItems],
     ['HIDDEN_COIN',record.flagRecords.hiddenCoins]
   ]){
     for(const item of items){
       if(item.flagSet!==false||!coord(item.x)||!coord(item.y)||
          !Number.isInteger(item.bitIndex))continue;
       const key=kind+':'+goal.mapId+':'+item.bitIndex;
       if(seen.has(key))continue;
       seen.add(key);
       out.push({kind,mapId:goal.mapId,mapName:record.name||goal.mapName||
         'Mapa #'+goal.mapId,
         x:item.x,y:item.y,bitIndex:item.bitIndex,
         mapHopCount:goal.mapHopCount,
         flagPendingVerified:true,visibleNowVerified:false,
         collectedNow:false,accessibleNow:null,
         recordId:item.recordId||key});
       if(out.length===maxTargets)return {verified:true,romSha256:sha,
         sourceMapId,items:out,limited:true,accessibleNow:null,
         routeNavigableNowProven:false};
     }
   }
 }
 return {verified:true,romSha256:sha,sourceMapId,items:out,
   limited:false,accessibleNow:null,routeNavigableNowProven:false};
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
 const paths=findCrossMapItemPaths({
   romSha256:selected.romSha256,terrainAtlas,warpGraph,outdoorAlignment,
   sourceMapId,position,positionVerified,currentModeByte,
   canCut,canSurf,spritesVerified,currentMapEntities,
   targets:selected.items.map(x=>({mapId:x.mapId,x:x.x,y:x.y,hidden:true})),
   maxStates,maxTransitions
 });
 if(paths?.verified!==true||!Array.isArray(paths.results)||
    paths.results.length!==selected.items.length)
   return fail('O motor multimapa não validou a geometria dos alvos remotos');
 return {...selected,foundCount:paths.foundCount,
   exploredStates:paths.exploredStates,maxStatesExceeded:paths.maxStatesExceeded,
   items:selected.items.map((item,i)=>({...item,
     route:paths.results[i],
     accessibleNow:null,routeNavigableNowProven:false})),
   scriptsVerified:false,itemsCollectedNowProven:false};
}
module.exports={selectGlobalFlagTargets,planGlobalFlagItemRoutes};
