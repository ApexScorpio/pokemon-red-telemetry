'use strict';
// A worldwide *read-only* index of verified event flags. Do not conflate
// item pickup, trainer gate closure, script victory, capture and live access.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {trainerFlagsForCurrentMap}=require('./romTrainerEvents');
const {stationaryPokemonEvents}=require('./romStaticEncounterEvents');
const {fromKnownRom,decodeHiddenCoins}=require('./romEventState');
const {bindMartPrices}=require('./romMartPriceBinding');
const auditedEconomy=require('./data/gen1EconomyTradesAudited.json');
const goodHex=(xs,n)=>Array.isArray(xs)&&xs.length===n&&
 xs.every(x=>typeof x==='string'&&/^[\da-f]{2}$/i.test(x));
const bit=(xs,i)=>((parseInt(xs[i>>3],16)>>(i&7))&1)===1;
// Keep the original four-field tuple for profiles without text evidence.
const interactionTuple=(ordinal,x,y,textId,evidence,romSha256,mapId)=>{
 const tuple=[ordinal,x,y,textId];
 if(evidence?.verified===true){
   tuple.push(evidence.command,evidence.romBank,evidence.textPointerCpu);
   const items=evidence.mart?.itemIds;
   if(evidence.command==='SCRIPT_MART'&&evidence.mart?.verified===true&&
      Array.isArray(items)&&items.length>0&&items.length<=32&&
      items.every(id=>Number.isInteger(id)&&id>0&&id<255))
   {
     tuple.push([...items]);
     const pricing=bindMartPrices({romSha256,mapId,itemIds:items,
       catalogue:auditedEconomy});
     if(pricing.verified===true)tuple.push(pricing.offers);
   }
   // Optional eighth field for TX_FAR is a typed preview, not a mart list.
   // Never read it as proof of dialogue, NPC choice or completed event.
   const p=evidence.staticTextPreview;
   if(evidence.command==='TX_FAR'&&p?.verified===true&&
      p.firstStringOnly===true&&p.dialogueExecuted===false&&
      p.textOutcomeVerified===false&&
      typeof p.text==='string'&&p.text.trim().length>0&&
      p.text.length<=240&&typeof p.containsRuntimeVariables==='boolean')
     {
       const preview={verified:true,firstStringOnly:true,text:p.text,
         containsRuntimeVariables:p.containsRuntimeVariables,
         dialogueExecuted:false,textOutcomeVerified:false};
       const program=p.program;
       if(program?.verified===true&&program.scriptComplete===true&&
          program.dialogueExecuted===false&&
          program.textOutcomeVerified===false&&
          program.scriptEffectsVerified===false&&
          typeof program.text==='string'&&program.text.length>0&&
          program.text.length<=760&&
          Number.isInteger(program.segmentCount)&&
          program.segmentCount>=1&&program.segmentCount<=12&&
          typeof program.containsRuntimeText==='boolean'&&
          typeof program.containsRuntimeCommands==='boolean')
         preview.program={verified:true,scriptComplete:true,
           text:program.text,segmentCount:program.segmentCount,
           containsRuntimeText:program.containsRuntimeText,
           containsRuntimeCommands:program.containsRuntimeCommands,
           dialogueExecuted:false,textOutcomeVerified:false,
           scriptEffectsVerified:false};
       tuple.push(preview);
     }
 }
 return tuple;
};
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
   visibleItems:{objects:0,unresolved:0,collectedConfirmed:0},
   interactions:{npcObjects:0,signs:0,unresolved:0,coordinatesUnverified:0,
     textPointersVerified:0},
   interactionRecords:{npcs:[],signs:[]},
   trainers:{objects:0,flagsMapped:0,gatesClosed:0,gatesOpen:0,
     unknown:0,scriptedVictories:0,battlesPlayed:0},
   stationaryPokemon:{flagsMapped:0,gatesClosed:0,gatesOpen:0,
     unknown:0},
   flagRecords:{hiddenItems:[],hiddenCoins:[],visibleItems:[],
     trainers:[],stationaryPokemon:[]},
   scriptEffectsComplete:false,
   accessCurrentlyProven:false
 }]));
 for(const row of hidden){
   const m=byMap.get(row.mapId);
   if(!m)return invalid('Item oculto referencia mapa não normal #'+row.mapId);
   m.hiddenItems.total++;
   const flagSet=bit(hiddenItemHex,row.hiddenIndex);
   m.flagRecords.hiddenItems.push({
     recordId:'hidden-item-'+row.hiddenIndex,bitIndex:row.hiddenIndex,
     flagSet,x:row.x,y:row.y,
     itemId:Number.isInteger(row.itemId)?row.itemId:null,
     source:'ROM_HIDDEN_ITEM_INDEX + RAM_D6F0'
   });
   if(flagSet)m.hiddenItems.collected++;
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
     summary.flagRecords.hiddenCoins.push({
       recordId:'hidden-coin-'+coin.hiddenIndex,bitIndex:coin.hiddenIndex,
       flagSet:coin.isCollected===true,x:coin.x,y:coin.y,
       source:'ROM_HIDDEN_COIN_INDEX + RAM_D6FE'
     });
     if(coin.isCollected===true)summary.hiddenCoins.collected++;
     else summary.hiddenCoins.notCollected++;
   }
   const actors=map.objects.objects;
   // Game Freak's ROM object format has signs and NPCs even without a
   // matching global event flag. Index their coordinates/text ID but never
   // interpret an interaction's dialogue as already completed.
   const signs=map.objects.signs??[];
   if(!Array.isArray(signs))
     return invalid('Lista ROM de sinais não validada no mapa #'+map.mapId);
   for(let ordinal=0;ordinal<signs.length;ordinal++){
     const sign=signs[ordinal];
     summary.interactions.signs++;
     summary.interactions.unresolved++;
     if(!Number.isInteger(sign?.x)||!Number.isInteger(sign?.y)||
        sign.x<0||sign.y<0||sign.x>255||sign.y>255){
       summary.interactions.coordinatesUnverified++;
       continue;
     }
     // Compact tuples: [ordinal in ROM, X, Y, text ID or null].
     if(sign.textPointerEvidence?.verified===true)
       summary.interactions.textPointersVerified++;
     summary.interactionRecords.signs.push(interactionTuple(
       ordinal+1,sign.x,sign.y,
       Number.isInteger(sign.textId)&&sign.textId>=0&&sign.textId<=255?
         sign.textId:null,sign.textPointerEvidence,sha,map.mapId));
   }
   for(let ordinal=0;ordinal<actors.length;ordinal++){
     const actor=actors[ordinal];
     if(actor?.kind!=='npc')continue;
     summary.interactions.npcObjects++;
     summary.interactions.unresolved++;
     if(!Number.isInteger(actor.x)||!Number.isInteger(actor.y)||
        actor.x<0||actor.y<0||actor.x>255||actor.y>255){
       summary.interactions.coordinatesUnverified++;
       continue;
     }
     if(actor.textPointerEvidence?.verified===true)
       summary.interactions.textPointersVerified++;
     summary.interactionRecords.npcs.push(interactionTuple(
       ordinal+1,actor.x,actor.y,
       Number.isInteger(actor.textId)&&actor.textId>=0&&actor.textId<=255?
         actor.textId:null,actor.textPointerEvidence,sha,map.mapId));
   }
   // Static visible objects are present in ROM, but unlike hidden-item flags
   // there is no corroborated world-wide pickup bitmap here. Never call
   // them uncollected or collected based on their ROM object definition.
   for(let ordinal=0;ordinal<actors.length;ordinal++){
     const actor=actors[ordinal];
     if(actor?.kind!=='item')continue;
     if(!Number.isInteger(actor.x)||!Number.isInteger(actor.y)||
        actor.x<0||actor.y<0||actor.x>255||actor.y>255)
       return invalid('Coordenada de item visível ROM inválida no mapa #'+map.mapId);
     summary.visibleItems.objects++;
     summary.visibleItems.unresolved++;
     summary.flagRecords.visibleItems.push({
       recordId:'visible-item-'+map.mapId+'-'+(ordinal+1),
       objectOrdinal:ordinal+1,x:actor.x,y:actor.y,
       itemId:Number.isInteger(actor.trainerClassOrItemId)?
         actor.trainerClassOrItemId:null,
       collected:null,removedFromCurrentMap:null,
       source:'ROM_MAP_OBJECT_STATIC_NO_GLOBAL_PICKUP_FLAG'
     });
   }
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
         const actor=actors[entry.objectOrdinal-1];
         summary.flagRecords.trainers.push({
           recordId:'trainer-'+entry.objectOrdinal,
           bitIndex:entry.eventBitIndex,flagSet:entry.eventFlagSet===true,
           objectOrdinal:entry.objectOrdinal,x:actor?.x??null,y:actor?.y??null,
           outcomeEvidence:entry.outcomeEvidence??null,
           source:entry.source
         });
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
       for(const entry of f.entries){
         const actor=actors[entry.objectOrdinal-1];
         summary.flagRecords.stationaryPokemon.push({
           recordId:'stationary-'+entry.objectOrdinal,
           bitIndex:entry.eventBitIndex,flagSet:entry.encounterGateClosed===true,
           objectOrdinal:entry.objectOrdinal,x:actor?.x??null,y:actor?.y??null,
           speciesInternalId:entry.speciesInternalId,
           source:entry.source
         });
       }
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
   visibleItemObjects:0,visibleItemsCollectionUnresolved:0,
   npcObjects:0,signObjects:0,interactionOutcomesUnresolved:0,
   interactionCoordinatesUnverified:0,interactionTextPointersVerified:0,
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
   total.visibleItemObjects+=s.visibleItems.objects;
   total.visibleItemsCollectionUnresolved+=s.visibleItems.unresolved;
   total.npcObjects+=s.interactions.npcObjects;
   total.signObjects+=s.interactions.signs;
   total.interactionOutcomesUnresolved+=s.interactions.unresolved;
   total.interactionCoordinatesUnverified+=s.interactions.coordinatesUnverified;
   total.interactionTextPointersVerified+=s.interactions.textPointersVerified;
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
   flagRecordCompleteness:'KNOWN_ROM_MAPPING_ONLY',
   bitwiseEventEvidenceAvailable:true,
   trainerGateClosedIsVictory:false,stationaryGateClosedIsCaptured:false,
   accessCurrentlyProven:false,
   limitations:['Flags de eventos não são prova universal de vitória ou recolha de itens visíveis',
     'Snapshots RAM sequenciais; não há atomicidade comprovada',
     'Scripts, NPCs e percursos globais não estão semanticamente completos',
     'As ROMs conhecidas não comprovam o hash da ROM efetivamente executada no emulador']};
}
module.exports={buildCampaignLedger};
