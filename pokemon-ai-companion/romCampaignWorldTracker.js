'use strict';
// Campaign-wide, per-map read-only tracker. An advisor snapshot is only evidence
// for its exact ROM SHA and map ID; duplicate/stale snapshots cannot prove progress.
const {buildMapChecklist}=require('./romWorldChecklist');
const MAP_IDS=248, NORMAL_MAPS=226;
const invalid=reason=>({verified:false,reason,maps:[],summary:null});
function buildCampaignWorldTracker({index,evidenceByMap=[],currentMapId=null,
 currentMapVerified=false}={}){
 const maps=index?.maps;
 if(index?.verified!==true||!Array.isArray(maps)||maps.length!==MAP_IDS||
    maps.some((m,i)=>m?.mapId!==i||typeof m.verified!=='boolean')||
    maps.filter(m=>m.verified).length!==NORMAL_MAPS||
    !/^[a-f0-9]{64}$/i.test(index.romSha256||'')||
    !Array.isArray(evidenceByMap))
  return invalid('Indice global das 248 referencias ou 226 mapas nao verificado');
 // Don't accept more than one snapshot for a map, even if identical: their
 // RAM timestamps could refer to different game states.
 const advisors=new Map(),ambiguous=new Set();
 let rejectedSnapshots=0;
 for(const e of evidenceByMap){
  if(e?.verified!==true||e.romSha256!==index.romSha256||
     !Number.isInteger(e.mapId)||e.mapId<0||e.mapId>=MAP_IDS||
     maps[e.mapId].verified!==true||!Array.isArray(e.observations)){
   rejectedSnapshots++;
   continue;
  }
  if(advisors.has(e.mapId)){
   ambiguous.add(e.mapId);
   continue;
  }
  advisors.set(e.mapId,e);
 }
 for(const id of ambiguous)advisors.delete(id);
 const perMap=[],summary={
  normalMaps:0,unresolvedMapIds:0,allStaticActions:0,
  observedMapCount:0,confirmedHiddenCollected:0,confirmedHiddenNotCollected:0,
  conditionalNeedsCut:0,conditionalNeedsSurf:0,progressUnknown:0,
  unresolvedHiddenReferences:0,ambiguousMapSnapshots:ambiguous.size,
  rejectedSnapshots
 };
 for(let mapId=0;mapId<MAP_IDS;mapId++){
  const checklist=buildMapChecklist({index,mapId,advisor:advisors.get(mapId)||null});
  if(checklist.verified!==true){
   summary.unresolvedMapIds++;
   summary.unresolvedHiddenReferences+=checklist.unresolvedHiddenReferences?.length||0;
   perMap.push({mapId,verified:false,reason:checklist.reason,
    unresolvedHiddenReferences:checklist.unresolvedHiddenReferences||[],
    status:'NO_NORMAL_MAP_HEADER'});
   continue;
  }
  summary.normalMaps++;
  summary.allStaticActions+=checklist.summary.total;
  summary.confirmedHiddenCollected+=checklist.summary.confirmedCollected;
  summary.confirmedHiddenNotCollected+=checklist.summary.confirmedNotCollected;
  summary.conditionalNeedsCut+=checklist.summary.needsCutCandidates;
  summary.conditionalNeedsSurf+=checklist.summary.needsSurfCandidates;
  summary.progressUnknown+=checklist.summary.progressUnverified;
  if(checklist.advisorEvidenceMatched)summary.observedMapCount++;
  perMap.push({mapId,verified:true,status:'ROM_STATIC_MAP',
   evidenceMatched:checklist.advisorEvidenceMatched,
   summary:checklist.summary,actions:checklist.actions});
 }
 // Zero proof of complete story/quests merely from these observations.
 const activeMap=currentMapVerified===true&&
   Number.isInteger(currentMapId)&&currentMapId>=0&&currentMapId<MAP_IDS&&
   perMap[currentMapId]?.verified===true&&
   advisors.has(currentMapId)?currentMapId:null;
 return {verified:true,romSha256:index.romSha256,maps:perMap,
  summary,currentMapId:activeMap,
  currentMapConfirmed:activeMap!==null,
  storyCompletionVerified:false,
  globalAccessVerified:false,
  allQuestsCompletedVerified:false,
  progressSource:summary.confirmedHiddenCollected+summary.confirmedHiddenNotCollected>0?
   'ROM_AND_INDEPENDENT_HIDDEN_RAM_FLAGS_PARTIAL':'ROM_STATIC_ONLY',
  limitations:['Cada snapshot serve apenas para o seu mapa e ROM exatos',
   'Snapshots repetidos do mesmo mapa deixam o estado do mapa desconhecido',
   'Condições Cut e Surf são caminhos geométricos hipotéticos',
   'Dados sem flags RAM não provam ações concluídas',
   'Mapas sem cabeçalho normal mantêm as referências de itens sem atribuir acesso',
   'A conclusão da campanha e consequências dos scripts não estão comprovadas']};
}
module.exports={buildCampaignWorldTracker};
