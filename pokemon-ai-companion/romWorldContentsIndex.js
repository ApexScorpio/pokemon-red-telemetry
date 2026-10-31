'use strict';
// Read-only all-map contents index from the exact Gen I ROM profile.
// A catalogued object is not a currently reachable, collected or completed object.
// Calls never open the emulator, mutate saves or infer unlocked field moves.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const MAP_IDS=248, NORMAL_MAPS=226;
const ACTOR_KINDS=new Set(['item','trainer','npc','wildPokemon']);
const byte=n=>Number.isInteger(n)&&n>=0&&n<=255;
const coordinate=n=>Number.isInteger(n)&&n>=-4&&n<=255;
const unknown=()=>({accessibleNow:null,collected:null,completed:null,
  needsCut:null,needsSurf:null,reason:'Estado da RAM e scripts do jogo ainda nao comprovados'});
function reject(reason){return {verified:false,reason,maps:[],totals:null,
 source:'UNVERIFIED_ROM_PROFILE',runtimeStateVerified:false};}
function copyActor(a,ordinal){
 if(!ACTOR_KINDS.has(a?.kind)||!coordinate(a.x)||!coordinate(a.y)||
    !byte(a.spriteId)||!byte(a.textId))return null;
 const metadata=a.trainerClassOrItemId??null;
 return {ordinal,kind:a.kind,x:a.x,y:a.y,spriteId:a.spriteId,textId:a.textId,
  itemOrTrainerId:metadata,trainerNumberOrLevel:a.trainerNumberOrLevel??null,
  wildSpeciesInternalId:a.wildSpeciesInternalId??null,wildLevel:a.wildLevel??null,
  source:'ROM_MAP_OBJECT_BYTES',...unknown()};
}
function copyWarp(w,ordinal){
 const destinationMap=w?.destinationMap??w?.map;
 const destinationWarp=w?.destinationWarp??w?.warp;
 if(!coordinate(w?.x)||!coordinate(w?.y)||!byte(destinationMap)||!byte(destinationWarp))
  return null;
 return {ordinal,x:w.x,y:w.y,destinationMap,destinationWarp,
  destinationDynamic:destinationMap===255,
  source:'ROM_MAP_WARP_BYTES',...unknown()};
}
function copySign(s,ordinal){
 if(!coordinate(s?.x)||!coordinate(s?.y)||!byte(s?.textId))return null;
 return {ordinal,x:s.x,y:s.y,textId:s.textId,textMeaningVerified:false,
  source:'ROM_MAP_SIGN_BYTES',...unknown()};
}
function buildWorldContentsIndex(profile){
 const sha=profile?.hash?.sha256?.toLowerCase();
 const data=profile?.world?.maps?.data;
 if(!isKnownAuditedRomSha(sha)||profile.unknownLayout===true||
    profile.world?.maps?.valid!==true||
    profile.world.maps.validMapHeaders!==NORMAL_MAPS||
    !Array.isArray(data)||data.length!==MAP_IDS||
    data.some((m,id)=>m?.mapId!==id||typeof m.valid!=='boolean')||
    data.filter(m=>m.valid).length!==NORMAL_MAPS)
  return reject('Identidade ROM, 248 referencias ou 226 cabecalhos nao comprovados');
 const hidden=profile.world.hiddenItemScripts;
 const hiddenVerified=hidden?.valid===true&&hidden.sha256===sha&&
   Array.isArray(hidden.items)&&hidden.items.length===54&&
   hidden.items.every(h=>byte(h.mapId)&&byte(h.x)&&byte(h.y)&&
     byte(h.itemId)&&Number.isInteger(h.hiddenIndex)&&
     h.hiddenIndex>=0&&h.hiddenIndex<54)&&
   new Set(hidden.items.map(h=>h.hiddenIndex)).size===54;
 const hiddenByMap=new Map();
 if(hiddenVerified)for(const h of hidden.items){
  const existing=hiddenByMap.get(h.mapId)||[];
  existing.push({hiddenIndex:h.hiddenIndex,x:h.x,y:h.y,itemId:h.itemId,
   source:'ROM_HIDDEN_ITEM_SCRIPT_AND_COORDINATES',...unknown()});
  hiddenByMap.set(h.mapId,existing);
 }
 const maps=[];
 const totals={normalMaps:0,reservedOrUnresolvedMapIds:0,
  visibleItems:0,hiddenItems:0,hiddenItemsInNormalMaps:0,
  hiddenItemsWithoutNormalHeader:0,trainers:0,npcs:0,
  stationaryPokemon:0,signs:0,warps:0};
 for(const m of data){
  if(!m.valid){
   totals.reservedOrUnresolvedMapIds++;
   const unassignedHiddenItems=(hiddenByMap.get(m.mapId)||[]).map(h=>({
     ...h,mapId:m.mapId,mapReferenceStatus:'NO_NORMAL_MAP_HEADER',
     scriptBindingVerified:null,
     reason:'Referencia de item oculto presente na ROM, mas sem cabecalho normal deste ID'
   }));
   totals.hiddenItemsWithoutNormalHeader+=unassignedHiddenItems.length;
   maps.push({mapId:m.mapId,verified:false,
     status:'NO_NORMAL_MAP_HEADER',
     reason:'Sem cabecalho normal descodificado; nao assumir ausencia de eventos',
     contents:null,unassignedHiddenItems});
   continue;
  }
  const raw=m.objects;
  if(!raw||!Array.isArray(raw.objects)||!Array.isArray(raw.warps)||
     !Array.isArray(raw.signs))
   return reject('Formato de objetos incompleto no mapa '+m.mapId);
  const actors=raw.objects.map((a,i)=>copyActor(a,i+1));
  const warps=raw.warps.map((w,i)=>copyWarp(w,i+1));
  const signs=raw.signs.map((s,i)=>copySign(s,i+1));
  if(actors.some(a=>a===null)||warps.some(w=>w===null)||signs.some(s=>s===null))
   return reject('Coordenadas ou IDs de objetos invalidos no mapa '+m.mapId);
  const contents={
   visibleItems:actors.filter(a=>a.kind==='item'),
   hiddenItems:hiddenByMap.get(m.mapId)||[],
   trainers:actors.filter(a=>a.kind==='trainer'),
   npcs:actors.filter(a=>a.kind==='npc'),
   stationaryPokemon:actors.filter(a=>a.kind==='wildPokemon'),
   signs,warps
  };
  totals.normalMaps++;
  for(const key of Object.keys(contents))totals[key]+=contents[key].length;
  totals.hiddenItemsInNormalMaps+=contents.hiddenItems.length;
  maps.push({mapId:m.mapId,verified:true,
   mapBank:m.mapBank??null,
   widthBlocks:m.widthBlocks??null,heightBlocks:m.heightBlocks??null,
   status:'ROM_STATIC_CONTENTS',
   contents});
 }
 // Preserve hidden-item references on reserved IDs rather than silently
 // dropping them or claiming that those IDs are accessible locations.
 totals.hiddenItems+=totals.hiddenItemsWithoutNormalHeader;
 const unassignedHiddenItems=maps.flatMap(m=>m.unassignedHiddenItems||[]);
 if(hiddenVerified&&(totals.hiddenItems!==54||
     totals.hiddenItemsInNormalMaps+unassignedHiddenItems.length!==54))
  return reject('Indice global perdeu referencias de itens ocultos da ROM');
 return {verified:true,romSha256:sha,
  source:'SHA_AUDITED_ROM_PROFILE_ALL_MAP_HEADERS_AND_OBJECT_RECORDS',
  maps,totals,unassignedHiddenItems,hiddenItemCoordinatesVerified:hiddenVerified,
  runtimeStateVerified:false,
  totalMapsWithLiveCompletionVerified:0,
  globalMapCoverage:'248_REFERENCE_IDS_226_NORMAL_HEADERS',
  limitations:['A identidade do perfil nao comprova os bytes ativos no emulador',
   'A presenca na ROM nao prova acessibilidade atual, Cut, Surf ou Strength',
   'Ausencia de sprite nao prova recolha de item, vitoria ou captura',
   'Scripts ramificados e texto nao estao integralmente interpretados']};
}
function getMapContents(index,mapId){
 if(index?.verified!==true||!Array.isArray(index.maps)||index.maps.length!==MAP_IDS||
    !Number.isInteger(mapId)||mapId<0||mapId>=MAP_IDS)
  return {verified:false,mapId,reason:'Indice completo ou ID do mapa nao comprovado'};
 const m=index.maps[mapId];
 return m?.verified===true?{
  ...m,romSha256:index.romSha256,
  activeMapVerified:false,liveProgressVerified:false
 }:{...m,verified:false,romSha256:index.romSha256};
}
module.exports={buildWorldContentsIndex,getMapContents};
