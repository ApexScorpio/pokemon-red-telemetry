'use strict';
// A worldwide *read-only* index of verified event flags. Do not conflate
// item pickup, trainer gate closure, script victory, capture and live access.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {trainerFlagsForCurrentMap}=require('./romTrainerEvents');
const {stationaryPokemonEvents}=require('./romStaticEncounterEvents');
const {fromKnownRom,decodeHiddenCoins}=require('./romEventState');
const goodHex=(xs,n)=>Array.isArray(xs)&&xs.length===n&&
 xs.every(x=>typeof x==='string'&&/^[\da-f]{2}$/i.test(x));
const bit=(xs,i)=>((parseInt(xs[i>>3],16)>>(i&7))&1)===1;
const invalid=reason=>({verified:false,reason,progressCompleteness:'UNKNOWN',
 mapCount:0,mapProgress:[],totals:null});
function buildCampaignLedger({profile,romIdentityMatched=false,
 mapWindowVerified=false,eventFlagsHex,hiddenItemHex,hiddenCoinHex}={}){
 const sha=String(profile?.hash?.sha256||'').toLowerCase();
 const mapIndex=profile?.world?.maps;
 if(!isKnownAuditedRomSha(sha)||profile?.unknownLayout===true||
    mapIndex?.valid!==true||!Array.isArray(mapIndex.data)||
    mapIndex.data.length!==248||
    mapIndex.data.some((m,id)=>m?.mapId!==id))
  return invalid('Perfil de mapa/ROM SHA-256 inválido ou não auditado');
 if(!romIdentityMatched||!mapWindowVerified)
  return invalid('Identidade ROM ou janela do mapa atual não corroboradas na RAM');
 if(!goodHex(eventFlagsHex,320)||!goodHex(hiddenItemHex,14)||
    !goodHex(hiddenCoinHex,2))
  return invalid('Flags RAM incompletas: D747 (320 bytes), D6F0 (14), D6FE (2)');
 const maps=mapIndex.data.filter(m=>m.valid===true);
 if(maps.length!==226||maps.some(m=>!Array.isArray(m.objects?.objects)))
  return invalid('226 mapas normais e objetos ROM não validados');
 const hidden=fromKnownRom(profile);
 if(!Array.isArray(hidden)||hidden.length!==54||
    hidden.some((h,i)=>h.hiddenIndex!==i||!Number.isInteger(h.mapId)||
      !Number.isInteger(h.x)||!Number.isInteger(h.y)))
  return invalid('Tabela ROM dos 54 itens ocultos não validada');
 const byMap=new Map(maps.map(m=>[m.mapId,{
   mapId:m.mapId,name:m.name||'Mapa #'+m.mapId,
   hiddenItems:{total:0,collected:0,notCollected:0},
   hiddenCoins:{total:0,collected:0,notCollected:0},
   trainers:{objects:0,flagsMapped:0,gatesClosed:0,gatesOpen:0,
     unknown:0,scriptedVictories:0,battlesPlayed:0},
   stationaryPokemon:{flagsMapped:0,gatesClosed:0,gatesOpen:0,
     unknown:0},scriptEffectsComplete:false,
   accessCurrentlyProven:false
 }]));
 for(const row of hidden){
   const m=byMap.get(row.mapId);
   if(!m)return invalid('Item oculto referencia mapa não normal #'+row.mapId);
   m.hiddenItems.total++;
   if(bit(hiddenItemHex,row.hiddenIndex))m.hiddenItems.collected++;
   else m.hiddenItems.notCollected++;
 }
 let coinCount=0;
 for(const map of maps){
   const summary=byMap.get(map.mapId);
   const coins=decodeHiddenCoins(profile,map.mapId,hiddenCoinHex);
   if(coins?.verified!==true||!Array.isArray(coins.coins))
     return invalid('Falha no bitmap independente de moedas ocultas no mapa #'+map.mapId);
   coinCount+=coins.coins.length;
   for(const coin of coins.coins){
     summary.hiddenCoins.total++;
     if(coin.isCollected===true)summary.hiddenCoins.collected++;
     else summary.hiddenCoins.notCollected++;
   }
   const actors=map.objects.objects;
   const trainers=actors.filter(x=>x.kind==='trainer'&&
     !(Number.isInteger(x.trainerClassOrItemId)&&
       x.trainerClassOrItemId>=1&&x.trainerClassOrItemId<=190));
   const t=summary.trainers;
   t.objects=trainers.length;
   if(trainers.length){
     const flags=trainerFlagsForCurrentMap(profile,map,eventFlagsHex);
     if(flags.verified===true&&Array.isArray(flags.entries)){
       t.flagsMapped=flags.entries.length;
       t.unknown=Math.max(0,trainers.length-flags.entries.length);
       for(const entry of flags.entries){
         if(entry.eventFlagSet===true)t.gatesClosed++;
         else if(entry.eventFlagSet===false)t.gatesOpen++;
         if(entry.victoryRecorded===true)t.scriptedVictories++;
         if(entry.battleWasPlayed===true)t.battlesPlayed++;
       }
     }else t.unknown=trainers.length;
   }
   const fixed=actors.filter(x=>x.kind==='wildPokemon'||(
     x.kind==='trainer'&&Number.isInteger(x.trainerClassOrItemId)&&
     x.trainerClassOrItemId>=1&&x.trainerClassOrItemId<=190));
   if(fixed.length){
     const f=stationaryPokemonEvents(profile,map,eventFlagsHex);
     if(f.verified===true&&Array.isArray(f.entries)){
       summary.stationaryPokemon.flagsMapped=f.entries.length;
       summary.stationaryPokemon.gatesClosed=f.entries.filter(x=>
         x.encounterGateClosed===true).length;
       summary.stationaryPokemon.gatesOpen=f.entries.filter(x=>
         x.encounterGateClosed===false).length;
       summary.stationaryPokemon.unknown=Math.max(0,fixed.length-f.entries.length);
     }else summary.stationaryPokemon.unknown=fixed.length;
   }
 }
 if(coinCount!==12)return invalid('Tabela das 12 fichas ocultas incompleta: '+coinCount);
 const total={mapHeaders:maps.length,hiddenItems:54,hiddenCoins:12,
   hiddenItemsCollected:0,hiddenItemsNotCollected:0,
   hiddenCoinsCollected:0,hiddenCoinsNotCollected:0,
   trainerObjects:0,trainerFlagsMapped:0,trainerGatesClosed:0,
   trainerGatesOpen:0,trainersUnknown:0,scriptedVictories:0,
   battlesPlayed:0,stationaryFlagsMapped:0,stationaryGatesClosed:0,
   stationaryGatesOpen:0,stationaryUnknown:0};
 for(const s of byMap.values()){
   total.hiddenItemsCollected+=s.hiddenItems.collected;
   total.hiddenItemsNotCollected+=s.hiddenItems.notCollected;
   total.hiddenCoinsCollected+=s.hiddenCoins.collected;
   total.hiddenCoinsNotCollected+=s.hiddenCoins.notCollected;
   total.trainerObjects+=s.trainers.objects;
   total.trainerFlagsMapped+=s.trainers.flagsMapped;
   total.trainerGatesClosed+=s.trainers.gatesClosed;
   total.trainerGatesOpen+=s.trainers.gatesOpen;
   total.trainersUnknown+=s.trainers.unknown;
   total.scriptedVictories+=s.trainers.scriptedVictories;
   total.battlesPlayed+=s.trainers.battlesPlayed;
   total.stationaryFlagsMapped+=s.stationaryPokemon.flagsMapped;
   total.stationaryGatesClosed+=s.stationaryPokemon.gatesClosed;
   total.stationaryGatesOpen+=s.stationaryPokemon.gatesOpen;
   total.stationaryUnknown+=s.stationaryPokemon.unknown;
 }
 return {verified:true,romSha256:sha,mapCount:maps.length,
   mapProgress:[...byMap.values()],totals:total,
   progressCompleteness:'PARTIAL',snapshotAtomicVerified:false,
   trainerGateClosedIsVictory:false,stationaryGateClosedIsCaptured:false,
   accessCurrentlyProven:false,
   limitations:['Flags de eventos não são prova universal de vitória ou recolha de itens visíveis',
     'Snapshots RAM sequenciais; não há atomicidade comprovada',
     'Scripts, NPCs e percursos globais não estão semanticamente completos',
     'As ROMs conhecidas não comprovam o hash da ROM efetivamente executada no emulador']};
}
module.exports={buildCampaignLedger};
