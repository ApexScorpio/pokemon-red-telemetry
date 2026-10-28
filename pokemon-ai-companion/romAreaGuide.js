'use strict';
// Query a COMPLETE static per-map snapshot as far as the verified binary decoders reach.
// Never assert a trainer has been defeated, an item collected, a door unlocked,
// or that an encounter is eligible without evidence from the live emulator.
const crypto=require('node:crypto');
const SHA=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']);
// Reference map constants: these 22 IDs have 0x0 dimensions in pret/pokered.
// This classification is NOT proof that arbitrary hacks lack custom content.
const REFERENCE_UNUSED_IDS=Object.freeze([11,105,106,107,109,110,111,112,114,115,116,117,
 204,205,206,231,237,238,241,242,243,244]);
const REFERENCE_UNUSED_SET=new Set(REFERENCE_UNUSED_IDS);
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
// The actual binary reader romWorldData.js returns independent fields, not
// synthetic metadata arrays. Preserve support for old exported JSON layouts.
function actorMetadata(actor) {
 const data=Array.isArray(actor?.metadata)?actor.metadata:[];
 return {
  ordinal:actor?.ordinal??null,
  itemOrClassId:actor?.trainerClassOrItemId??data[0]??null,
  numberOrLevel:actor?.trainerNumberOrLevel??data[1]??null,
  sprite:actor?.spriteId??actor?.sprite??null
 };
}
function normalizeWarp(w) {
 const map=w.destinationMap??w.map;
 const warp=w.destinationWarp??w.warp;
 if(!Number.isInteger(map)||map<0||map>255||
    !Number.isInteger(warp)||warp<0||warp>255)
  return {...w,verified:false,reason:'Par de destino ROM malformado'};
 return {
  ...w, map,warp,destinationMap:map,destinationWarp:warp,
  source:'ROM_MAP_OBJECT_WARP_BYTES',
  destinationMode:map===255?'LAST_MAP_FROM_RAM':'STATIC_MAP_ID',
  destinationMapRequiresRam:map===255,
  accessibleNow:null,
  runtimeDestinationConfirmed:false
 };
}
function trainersFor(profile,objects){
 const table=profile.trainerParties;
 return objects.filter(o=>o.kind==='trainer').map(o=>{
  const meta=actorMetadata(o);
  const trainerClassId=meta.itemOrClassId,trainerNumber=meta.numberOrLevel;
  const index=trainerClassId-201;
  const members=table?.verified&&Array.isArray(table.rosters?.[index])&&
    Number.isInteger(trainerNumber)?table.rosters[index][trainerNumber-1]:null;
  const variantDependent=RIVAL.has(trainerClassId);
  return {x:o.x,y:o.y,ordinal:meta.ordinal,trainerClassId,trainerNumber,
   defeated:null,defeatedStatus:'RAM_EVENT_FLAG_NOT_READ',
   variantDependent,
   party:!variantDependent&&Array.isArray(members)&&members.length?members.map(([id,level])=>({
    ...speciesAt(profile,id),level})):null,
   partyStatus:variantDependent?'SCRIPT_VARIANT_NOT_RESOLVED':
    members?'ROM_TEAM_STATIC_ONLY':'NOT_CONFIRMED',
   className:table?.classNames?.[index]||null};
 });
}
function validatedBlockGrid(m){
 if(typeof m.blockDataBase64!=='string'||!Number.isInteger(m.widthBlocks)||
    !Number.isInteger(m.heightBlocks)||!m.blockSha256)
   return {verified:false,reason:'Blocos 2D não disponíveis no perfil da ROM'};
 const data=Buffer.from(m.blockDataBase64,'base64');
 const expected=m.widthBlocks*m.heightBlocks;
 if(expected<1||expected>10000||data.length!==expected||
    crypto.createHash('sha256').update(data).digest('hex')!==m.blockSha256)
   return {verified:false,reason:'Dados de blocos 2D ou SHA incompatíveis'};
 return {verified:true,widthBlocks:m.widthBlocks,heightBlocks:m.heightBlocks,
   bytes:data.length,sha256:m.blockSha256,
   blockIdsBase64:m.blockDataBase64,
   interpretation:'IDs de metabloco verificados; NÃO é matriz de colisão nem pixels da tileset'};
}
// Only static inventory/offers come from ROM. Location bindings originate from
// pret/pokered reference map IDs and do not prove Green's modified script.
function staticServicesForMap(profile,mapId){
 const economy=profile?.economyTrades;
 if(economy?.verified!==true)return {verified:false,reason:'Catálogo ROM de economia ainda não validado'};
 const priceById=new Map(economy.itemPrices.items.map(i=>[i.id,i]));
 const tmById=new Map(economy.tmPrices.entries.map(i=>[i.itemId,i]));
 const shops=economy.martShops.shops.filter(i=>i.mapId===mapId).map(shop=>({
  label:shop.label,source:'ROM_SHOP_SCRIPT_AND_PRET_MAP_REFERENCE',mapAssociationProvenInActiveGame:false,
  inventory:shop.inventory.map(i=>({...i,pricePokedollars:(priceById.get(i.id)||tmById.get(i.id))?.pricePokedollars??null,
    stockAvailableNow:null})),shopIsOpenNow:null}));
 const trades=economy.npcTrades.trades.filter(i=>i.mapId===mapId).map(t=>({
  index:t.index,mapIdReferenceOnly:true,liveNpcScriptVerified:false,
  requested:speciesAt(profile,t.requestedInternalId),
  received:speciesAt(profile,t.receivedInternalId),nickname:t.receivedNickname,
  completed:null,playerHasRequestedPokemon:null}));
 const gameCorner=mapId===economy.prizeCorner.mapId?{
  menus:economy.prizeCorner.menus.map(m=>({kind:m.kind,products:m.products.map(p=>({
   ...p,species:m.kind==='pokemon'?speciesAt(profile,p.id):null,
   purchasableNow:null}))})),liveOfferVerified:false}:null;
 const vending=mapId===economy.vending.mapId?{
  inventory:economy.vending.items,liveVendingMachineVerified:false}:null;
 const fishing=economy.fishing.superRod.find(x=>x.mapId===mapId);
 return {verified:true,romSha256:economy.romSha256,shops,trades,gameCorner,vending,
  fishing:{superRod:fishing?{...fishing,currentTileCanFish:null}:null,
   goodRod:economy.fishing.goodRod,oldRod:economy.fishing.oldRod,
   rodInInventoryVerified:false,eligibleFishingActionVerified:false},
  referenceAssociationsRequireScriptValidation:true,hasLiveStateProof:false};
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
 if(!m||!m.valid){
  const reserved=REFERENCE_UNUSED_SET.has(mapId);
  return {verified:false,mapId,romSha256:sha,
    referenceUnusedSlot:reserved,
    status:reserved?'RESERVED_ID_NO_NORMAL_ROM_HEADER':'UNRESOLVED_MAP_HEADER',
    referenceSource:reserved?'pret/pokered constants/map_constants.asm UNUSED_MAP IDs with 0x0 dimensions':null,
    reason:reserved?
      'ID reservado na tabela de referência e sem cabeçalho normal descodificado; não inferir comportamento de hacks':
      'Mapa sem cabeçalho normal validado; não assumir que não tem eventos'};
 }
 if(!w)return {verified:false,mapId,romSha256:sha,reason:'Tabela de encontros do mapa ausente'};
 const obj=m.objects||{},actors=(obj.objects||[]).map((actor,index)=>({
  ...actor,ordinal:actor.ordinal??index+1}));
 const trainerEvents=new Map((m.trainerEvents||[]).map(e=>[e.objectOrdinal,e]));
 const stationaryEvents=new Map((m.staticEncounterEvents||[]).map(e=>[e.objectOrdinal,e]));
 const items=actors.filter(x=>x.kind==='item').map((o,i)=>({x:o.x,y:o.y,
  ordinal:o.ordinal??actors.indexOf(o)+1,itemId:actorMetadata(o).itemOrClassId,obtained:null,
  obtainedStatus:'RAM_EVENT_FLAG_NOT_READ'}));
 const hidden=world.hiddenItemScripts?.valid?world.hiddenItemScripts.items.filter(x=>x.mapId===mapId)
   .map(x=>({x:x.x,y:x.y,itemId:x.itemId,obtained:null,obtainedStatus:'RAM_HIDDEN_FLAGS_NOT_READ'})):null;
 const coins=world.hiddenItemScripts?.hiddenCoins?.valid?world.hiddenItemScripts.hiddenCoins.coins
  .filter(x=>x.mapId===mapId).map(x=>({x:x.x,y:x.y,coinAmount:x.coinAmount,
   collected:null,engineAwardConditionVerified:world.hiddenItemScripts.hiddenCoins.fortyCoinBranchVerified||false})):null;
 return {verified:true,source:'ROM_SHA256_LOCAL_MAP_HEADERS_WILD_AND_OBJECT_TABLES',
  romSha256:sha,mapId,layout:{bank:m.mapBank,widthTiles:m.widthTiles,heightTiles:m.heightTiles,
   tilesetId:m.tilesetId,connections:m.connectionFlags,blockHash:m.blockSha256||null,
   blockGrid:validatedBlockGrid(m)},
  warps:(obj.warps||[]).map(normalizeWarp),
  navigation:(world.warpGraph?.verified===true&&world.warpGraph?.romSha256===sha)?{
    verified:true,source:'ALL_813_ROM_WARP_ENTRIES_SHA256_VERIFIED',
    exits:world.warpGraph.edges.filter(edge=>edge.sourceMapId===mapId),
    outdoorExits:world.warpGraph.outdoorConnections?.edges.filter(edge=>edge.sourceMapId===mapId)||[],
    outdoorHeaderConnectionsDecoded:world.warpGraph.outdoorHeaderConnectionsDecoded===true,
    staticRouteOnly:true,scriptAndRamGatesUnresolved:true
  }:{verified:false,reason:'Grafo de saídas da ROM não comprovado no perfil atual'},
  signs:obj.signs||[],npcs:actors.filter(x=>x.kind==='npc'),
  visibleItems:items,hiddenItems:hidden,hiddenCoins:coins,
  trainers:trainersFor(profile,actors).map(t=>({
    ...t,eventFlagIndex:trainerEvents.get(t.ordinal)?.eventBitIndex??null,
    eventFlagSource:trainerEvents.get(t.ordinal)?.source??null,
    eventFlagValueFromRam:null,flagDoesNotProveVictory:true
  })),
  staticPokemon:actors.filter(x=>x.kind==='wildPokemon').map(x=>({
    x:x.x,y:x.y,
    speciesInternalId:x.wildSpeciesInternalId??actorMetadata(x).itemOrClassId,
    level:x.wildLevel??actorMetadata(x).numberOrLevel,
    objectOrdinal:x.ordinal,
    eventFlagIndex:stationaryEvents.get(x.ordinal)?.eventBitIndex??null,
    eventFlagSource:stationaryEvents.get(x.ordinal)?.source??null,
    eventFlagValueFromRam:null,battleTriggered:null,caughtFromThisEvent:null
  })), 
  encounters:encountersFor(profile,w),
  services:staticServicesForMap(profile,mapId),
  mapScripts:{decodedSemanticEvents:false,reason:'O ponteiro para código por mapa, só por si, não descodifica os estados dos scripts'},
  currentPositionVerified:false,currentEventFlagsVerified:false,
  allContentsKnown:false};
}
function mapGuideIndex(profile){
 if(!profile?.world?.maps?.data)return {verified:false,maps:[]};
 const guides=profile.world.maps.data.map(m=>staticMapGuide(profile,m.mapId));
 const reserved=guides.filter(m=>m.referenceUnusedSlot===true).length;
 return {verified:true,romSha256:profile.hash.sha256,maps:guides,
  normalHeadersValidated:guides.filter(m=>m.verified).length,
  reservedIdsWithoutHeader:reserved,
  unresolvedNonReservedIds:guides.filter(m=>!m.verified&&!m.referenceUnusedSlot).length,
  reservedClassification:'REFERENCE_MAP_CONSTANTS_AND_NO_DECODED_HEADER_NOT_LIVE_PROOF',
  scope:'Os IDs UNUSED_MAP de referência não são mapas jogáveis a descodificar; não validar conteúdo de hacks sem prova'};
}
module.exports={staticMapGuide,mapGuideIndex,encountersFor,trainersFor,staticServicesForMap,REFERENCE_UNUSED_IDS,actorMetadata,normalizeWarp};