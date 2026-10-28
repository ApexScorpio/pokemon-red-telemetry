'use strict';
// Query a COMPLETE static per-map snapshot as far as the verified binary decoders reach.
// Never assert a trainer has been defeated, an item collected, a door unlocked,
// or that an encounter is eligible without evidence from the live emulator.
const SHA=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']);
const RIVAL=new Set([225,242,243]);
const weights=[51,51,39,25,25,25,13,13,11,3];
function speciesAt(profile,id){
 const p=profile.species?.[id-1];return p?.internalId===id?{internalId:id,dex:p.dex||null,name:p.name||null}: {internalId:id,dex:null,name:null};
}
function encountersFor(profile,wild){
 if(!wild)return {verified:false,reason:'Tabela de encontros ausente na ROM auditada',terrain:[]};
 const terrain=[];
 for(const medium of ['grass','water']){
  const d=wild[medium];if(!d||!Number.isInteger(d.rateByte)||d.rateByte<0||d.rateByte>255)continue;
  const slots=d.slots||[];
  if((d.rateByte===0&&slots.length!==0)||(d.rateByte>0&&slots.length!==10)||
    slots.some((s,i)=>s.slot!==i||s.level<1||s.level>100||
      !Number.isInteger(s.internalId)||s.internalId<1||s.internalId>190||
      (s.weight??s.rollWeight)!==weights[i])){
   terrain.push({medium,verified:false,reason:'Slots da ROM não coincidem com os pesos Gen I comprovados'});continue;
  }
  const distinct=new Map();
  for(const s of slots){const key=s.internalId+':'+s.level,prior=distinct.get(key);
   if(prior)prior.weight+=s.weight??s.rollWeight;
   else distinct.set(key,{...speciesAt(profile,s.internalId),level:s.level,weight:s.weight??s.rollWeight});
  }
  const levels=[...distinct.values()].map(x=>({...x,conditionalEncounterChance:{numerator:x.weight,denominator:256,percent:x.weight*100/256}}));
  terrain.push({medium,verified:true,rateByte:d.rateByte,
   conditionalRngCheck:{numerator:d.rateByte,denominator:256,percent:d.rateByte*100/256},
   chancePerStepVerified:false,requiredState:medium==='water'?'Surf, água e gates de movimento':'Relva e gates de movimento',
   speciesAndLevels:levels});
 }
 return {verified:terrain.every(x=>x.verified),terrain};
}
function trainersFor(profile,objects){
 const table=profile.trainerParties;
 return objects.filter(o=>o.kind==='trainer').map(o=>{
  const trainerClassId=o.metadata?.[0],trainerNumber=o.metadata?.[1];
  const index=trainerClassId-201;
  const members=table?.verified&&Array.isArray(table.rosters?.[index])&&
    Number.isInteger(trainerNumber)?table.rosters[index][trainerNumber-1]:null;
  const variantDependent=RIVAL.has(trainerClassId);
  return {x:o.x,y:o.y,ordinal:o.ordinal,trainerClassId,trainerNumber,
   defeated:null,defeatedStatus:'RAM_EVENT_FLAG_NOT_READ',
   variantDependent,
   party:!variantDependent&&Array.isArray(members)&&members.length?members.map(([id,level])=>({
    ...speciesAt(profile,id),level})):null,
   partyStatus:variantDependent?'SCRIPT_VARIANT_NOT_RESOLVED':
    members?'ROM_TEAM_STATIC_ONLY':'NOT_CONFIRMED',
   className:table?.classNames?.[index]||null};
 });
}
function staticMapGuide(profile,mapId){
 const sha=profile?.hash?.sha256?.toLowerCase();
 if(!SHA.has(sha)||profile.unknownLayout||!Number.isInteger(mapId)||mapId<0||mapId>247)
  return {verified:false,reason:'ROM e ID de mapa não comprovados'};
 const world=profile.world||{},maps=world.maps,wild=world.wildEncounters;
 if(maps?.valid!==true||!Array.isArray(maps.data)||wild?.valid!==true||!Array.isArray(wild.data))
  return {verified:false,reason:'Tabelas de mapas e encontros não validadas'};
 const m=maps.data.find(e=>e.mapId===mapId);
 const w=wild.data.find(e=>e.mapId===mapId);
 if(!m||!m.valid)return {verified:false,mapId,romSha256:sha,reason:'Mapa sem cabeçalho normal validado; não assumir que não tem eventos'};
 if(!w)return {verified:false,mapId,romSha256:sha,reason:'Tabela de encontros do mapa ausente'};
 const obj=m.objects||{},actors=obj.objects||[];
 const items=actors.filter(x=>x.kind==='item').map(o=>({x:o.x,y:o.y,
  ordinal:o.ordinal,itemId:o.metadata?.[0]??null,obtained:null,
  obtainedStatus:'RAM_EVENT_FLAG_NOT_READ'}));
 const hidden=world.hiddenItemScripts?.valid?world.hiddenItemScripts.items.filter(x=>x.mapId===mapId)
   .map(x=>({x:x.x,y:x.y,itemId:x.itemId,obtained:null,obtainedStatus:'RAM_HIDDEN_FLAGS_NOT_READ'})):null;
 const coins=world.hiddenItemScripts?.hiddenCoins?.valid?world.hiddenItemScripts.hiddenCoins.coins
  .filter(x=>x.mapId===mapId).map(x=>({x:x.x,y:x.y,coinAmount:x.coinAmount,
   collected:null,engineAwardConditionVerified:world.hiddenItemScripts.hiddenCoins.fortyCoinBranchVerified||false})):null;
 return {verified:true,source:'ROM_SHA256_LOCAL_MAP_HEADERS_WILD_AND_OBJECT_TABLES',
  romSha256:sha,mapId,layout:{bank:m.mapBank,widthTiles:m.widthTiles,heightTiles:m.heightTiles,
   tilesetId:m.tilesetId,connections:m.connectionFlags,blockHash:m.blockSha256||null},
  warps:(obj.warps||[]).map(v=>({...v,accessibleNow:null})),
  signs:obj.signs||[],npcs:actors.filter(x=>x.kind==='npc'),
  visibleItems:items,hiddenItems:hidden,hiddenCoins:coins,
  trainers:trainersFor(profile,actors),
  staticPokemon:actors.filter(x=>x.kind==='wildPokemon').map(x=>({x:x.x,y:x.y,
    metadata:x.metadata||[],battleTriggered:null})),
  encounters:encountersFor(profile,w),
  mapScripts:{decodedSemanticEvents:false,reason:'O ponteiro para código por mapa, só por si, não descodifica os estados dos scripts'},
  currentPositionVerified:false,currentEventFlagsVerified:false,
  allContentsKnown:false};
}
function mapGuideIndex(profile){
 if(!profile?.world?.maps?.data)return {verified:false,maps:[]};
 return {verified:true,romSha256:profile.hash.sha256,maps:profile.world.maps.data
  .map(m=>staticMapGuide(profile,m.mapId)),
  scope:'Catálogo estático indexado por 248 IDs; locais não validados assinalados, e nenhum estado atual atribuído'};
}
module.exports={staticMapGuide,mapGuideIndex,encountersFor,trainersFor};