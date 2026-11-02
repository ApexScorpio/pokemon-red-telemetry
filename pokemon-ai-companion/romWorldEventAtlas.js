'use strict';
// Named event and toggle-bit reference atlas for Gen I.
// This joins 507 independently named event constants and 228 reference
// toggle labels to live RAM, but never equates a bit with an observed action.
// Names/locations originate from bundled disassembly references. CRC32
// association does not prove the active ROM's full SHA-256.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const EVENT_REFERENCE=require('./data/exact_events.json');
const PINNED_EVENT_REFERENCE=require('./data/gen1EventNamesPret.json');
const TOGGLE_REFERENCE=require('./data/exact_visible_flags.json');
const hex=(values,count)=>Array.isArray(values)&&values.length===count&&
 values.every(x=>typeof x==='string'&&/^[a-f0-9]{2}$/i.test(x));
const invalid=reason=>({verified:false,reason,events:[],toggleFlags:[],
   summary:null,source:'REFERENCE_ATLAS_RAM_UNAVAILABLE'});
const MILESTONES=Object.freeze([
 'EVENT_GOT_STARTER','EVENT_GOT_POKEDEX','EVENT_BEAT_BROCK',
 'EVENT_BEAT_MISTY','EVENT_GOT_BICYCLE','EVENT_GOT_HM01',
 'EVENT_GOT_HM02','EVENT_GOT_HM03','EVENT_GOT_HM04',
 'EVENT_GOT_HM05','EVENT_GOT_POKE_FLUTE','EVENT_BEAT_SABRINA'
]);
function validateReferenceAtlas(){
 const list=Object.entries(EVENT_REFERENCE);
 if(list.length!==507||new Set(list.map(x=>x[1])).size!==507||
    list.some(([name,index])=>!/^EVENT_[A-Z0-9_]+$/.test(name)||
      !Number.isInteger(index)||index<0||index>=2560))
   return {verified:false,reason:'Constantes de eventos não correspondem às 507 referências'};
 // The two bundled references must point to the exact same W_EVENTFLAGS
 // bit for every external event label; names alone are insufficient proof.
 // Historical Lavender Town indices were offset by 45 bits, including the
 // Poke Flute, so a mismatch must reject every live story-flag inference.
 if(PINNED_EVENT_REFERENCE.sourceCommit!=='171e2c204f9c1ff8e577ca387a4bbb009e130843'||
    PINNED_EVENT_REFERENCE.namedBitCount!==507||
    PINNED_EVENT_REFERENCE.totalWEventFlagsBits!==2560||
    Object.keys(PINNED_EVENT_REFERENCE.eventNamesByBit||{}).length!==507||
    list.some(([name,index])=>PINNED_EVENT_REFERENCE.eventNamesByBit[index]!==name))
   return {verified:false,reason:'Divergencia entre indices de eventos RAM e referencia pret/pokered'};
 const toggles=Object.values(TOGGLE_REFERENCE);
 if(toggles.length!==228||
    toggles.some((row,index)=>row?.toggleIndex!==index||
      !/^TOGGLE_[A-Z0-9_]+$/.test(row.constant)||
      !Number.isInteger(row.mapId)||row.mapId<0||row.mapId>=248||
      row.byteIdx!==(index>>3)||row.bitIdx!==(index&7)))
   return {verified:false,reason:'Índices, mapas ou 228 toggles de referência incoerentes'};
 if(MILESTONES.some(name=>!Object.hasOwn(EVENT_REFERENCE,name)))
   return {verified:false,reason:'Faltam constantes de marcos previstas'};
 return {verified:true,eventCount:507,toggleCount:228};
}
const REFERENCE_VALIDATION=validateReferenceAtlas();
const bit=(hexData,index)=>(parseInt(hexData[index>>3],16)&(1<<(index&7)))!==0;
function buildWorldEventAtlas({romSha256,romIdentityMatched=false,
 mapWindowVerified=false,eventFlagsHex,toggleFlagsHex}={}){
 const sha=String(romSha256||'').toLowerCase();
 if(!REFERENCE_VALIDATION.verified)return invalid(REFERENCE_VALIDATION.reason);
 if(!isKnownAuditedRomSha(sha)||!romIdentityMatched||!mapWindowVerified)
   return invalid('Identidade de perfil ROM ou janela RAM não corroborada');
 if(!hex(eventFlagsHex,320)||!hex(toggleFlagsHex,32))
   return invalid('D747 (320 bytes) ou D5A6 (32 bytes) incompletos');
 const events=Object.entries(EVENT_REFERENCE).map(([name,index])=>({
   name,eventBitIndex:index,flagSet:bit(eventFlagsHex,index),
   flagMeaning:'FLAG_SET_ONLY',actionObserved:false,
   referenceLocation:'NÃO_DETERMINADA_NESTE_CATÁLOGO'
 }));
 const toggleFlags=Object.values(TOGGLE_REFERENCE).map(row=>({
   name:row.constant,mapId:row.mapId,referenceMapName:row.mapName,
   toggleIndex:row.toggleIndex,removedFlagSet:bit(toggleFlagsHex,row.toggleIndex),
   removedFromCurrentSceneConfirmed:false,
   obtainedItemConfirmed:false,objectKindConfirmed:false,
   mapAssociationFromReference:true
 }));
 const eventOn=events.reduce((count,row)=>count+Number(row.flagSet),0);
 const removed=toggleFlags.reduce((count,row)=>count+Number(row.removedFlagSet),0);
 const byMap=new Map();
 for(const row of toggleFlags){
   const group=byMap.get(row.mapId)||{
     mapId:row.mapId,referenceMapName:row.referenceMapName,
     referencedToggleFlags:0,removedFlagsSet:0,
     currentSceneVisibilityVerified:false
   };
   group.referencedToggleFlags++;
   if(row.removedFlagSet)group.removedFlagsSet++;
   byMap.set(row.mapId,group);
 }
 const milestones=MILESTONES.map(name=>({
   name,eventBitIndex:EVENT_REFERENCE[name],
   flagSet:bit(eventFlagsHex,EVENT_REFERENCE[name]),
   conditionSatisfiedNow:null,actionConfirmed:false
 }));
 return {verified:true,romSha256:sha,
   events,toggleFlags,milestones,mapToggleSummary:[...byMap.values()],
   summary:{namedEventBits:507,namedEventBitsSet:eventOn,
     namedEventBitsClear:507-eventOn,
     referenceToggleBits:228,toggleRemovedFlagBitsSet:removed,
     toggleRemovedFlagBitsClear:228-removed,
     referenceMapsWithToggles:byMap.size},
   referenceLabelsVerified:true,romBinaryScriptSemanticsVerified:false,
   activeRomFullSha256Verified:false,
   progressCompleteness:'PARTIAL',
   snapshotAtomicVerified:false,
   source:'BUNDLED_PRET_EVENT_AND_TOGGLE_REFERENCES + LIVE_RAM_SEQUENTIAL',
   warnings:['Uma flag EVENT_* pode marcar uma condição ou fase e não um objetivo terminado',
     'Uma flag TOGGLE_* indica estado de remoção, não prova recolha nem visibilidade atual',
     'Localização de eventos não é inferida do nome da constante',
     'Os nomes do catálogo de referência não provam equivalência binária com cada script da ROM ativa']};
}
module.exports={buildWorldEventAtlas,validateReferenceAtlas,MILESTONES};
