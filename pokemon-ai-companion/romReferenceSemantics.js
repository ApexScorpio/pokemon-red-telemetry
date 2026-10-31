'use strict';
// Symbolic names from a pinned pret/pokered disassembly, not text embedded
// in the cartridge. Never use a label as evidence an event actually occurred.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const eventTable=require('./data/gen1EventNamesPret.json');
const mapTable=require('./data/gen1MapNamesPret.json');
const COMMIT='171e2c204f9c1ff8e577ca387a4bbb009e130843';
const EXPECTED=Object.freeze({
  192:'EVENT_GOT_BICYCLE',
  342:'EVENT_SEEL_FAN_BOAST',
  343:'EVENT_PIKACHU_FAN_BOAST',
  1231:'EVENT_RESCUED_MR_FUJI',
  1406:'EVENT_GOT_DOME_FOSSIL'
});
const fail=reason=>({verified:false,reason,sourceIsExternalReference:true,
 gameplaySemanticsVerified:false,gameplayOutcomeObserved:false});
function valid(){
 if(eventTable.schema!=='pokeguide-reference-event-labels-v1'||
    mapTable.schema!=='pokeguide-reference-map-labels-v1'||
    eventTable.sourceCommit!==COMMIT||
    mapTable.sourceCommit!==COMMIT||
    eventTable.sourceIsExternalReference!==true||
    mapTable.sourceIsExternalReference!==true||
    eventTable.namedBitCount!==507||
    eventTable.totalWEventFlagsBits!==2560||
    mapTable.totalMapIds!==248||
    !Array.isArray(mapTable.mapNamesById)||
    mapTable.mapNamesById.length!==248||
    Object.keys(eventTable.eventNamesByBit||{}).length!==507||
    Object.entries(EXPECTED).some(([bit,name])=>
      eventTable.eventNamesByBit[bit]!==name)||
    mapTable.mapNamesById[148]!=='POKEMON_TOWER_7F'||
    mapTable.mapNamesById[149]!=='MR_FUJIS_HOUSE'||
    mapTable.mapNamesById[61]!=='MT_MOON_B2F')
  return false;
 return mapTable.mapNamesById.every(x=>typeof x==='string'&&
   /^[A-Z0-9_]+$/.test(x))&&
  Object.entries(eventTable.eventNamesByBit).every(([i,name])=>
   Number.isInteger(Number(i))&&Number(i)>=0&&Number(i)<2560&&
   /^EVENT_[A-Z0-9_]+$/.test(name));
}
function lookupRomReference({romSha256,mapId=null,eventBitIndex=null}={}){
 if(!isKnownAuditedRomSha(romSha256)||!valid())
  return fail('ROM SHA256 desconhecido ou indices externos invalidos');
 if((mapId!==null&&(!Number.isInteger(mapId)||mapId<0||mapId>=248))||
    (eventBitIndex!==null&&(!Number.isInteger(eventBitIndex)||
      eventBitIndex<0||eventBitIndex>=2560)))
  return fail('Mapa ou bit de evento fora do intervalo');
 const eventName=eventBitIndex===null?null:
  eventTable.eventNamesByBit[eventBitIndex]||null;
 return {verified:true,romSha256,mapId,eventBitIndex,
  referenceMapName:mapId===null?null:mapTable.mapNamesById[mapId],
  referenceEventName:eventName,
  knownNamedEventBit:eventName!==null,
  referenceLabelsSource:'pret/pokered',
  referenceLabelsCommit:COMMIT,
  mapNameComesFromRomBytes:false,eventNameComesFromRomBytes:false,
  sourceIsExternalReference:true,
  gameplaySemanticsVerified:false,gameplayOutcomeObserved:false,
  note:'Os rotulos do desassemblado nao provam que o script executou, que o evento aconteceu ou que o estado atual do jogador mudou'};
}
module.exports={lookupRomReference};
