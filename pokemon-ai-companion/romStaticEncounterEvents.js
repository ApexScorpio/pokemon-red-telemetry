'use strict';
// Lutas fixas contra Pokémon (não treinadores humanos).
// Flags extraídas e verificadas nos três ficheiros ROM Red, Blue, Green Intl 1.2.1.
// A flag indica que o evento deixou de estar disponível; NÃO prova captura.
const KNOWN_ROM_HASHES=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
]);
// [objectOrdinal, speciesInternalId, level, eventBitIndex]
const KNOWN_FIXED_ENCOUNTERS={
  83:[[1,6,40,1121],[2,6,40,1122],[3,6,40,1123],[4,141,43,1124],
      [5,6,40,1125],[6,6,40,1126],[7,141,43,1127],[8,6,40,1128],[9,75,50,1129]],
  162:[[3,74,50,2522]],
  194:[[6,73,50,1342]],
  227:[[1,131,70,2241]]
};
function stationaryPokemonEvents(profile,romMap,eventHex){
 const sha=profile?.hash?.sha256?.toLowerCase();
 const mapId=romMap?.mapId;
 if(!romMap?.valid||!Array.isArray(romMap.objects?.objects))
  return {verified:false,source:'MAPA_ROM_DESCONHECIDO',entries:[]};
 if(!Array.isArray(eventHex)||eventHex.length!==320||
    eventHex.some(x=>typeof x!=='string'||!/^[0-9a-f]{2}$/i.test(x)))
  return {verified:false,source:'RAM_W_EVENT_FLAGS_INCOMPLETA',entries:[]};
 const objects=romMap.objects.objects;
 let rows=null,source='';
 if(Array.isArray(romMap.staticEncounterEvents) &&
    Number.isInteger(profile?.world?.maps?.staticEncountersVerified) &&
    profile.world.maps.staticEncountersVerified>0 &&
    profile.world.maps.data?.[mapId]?.mapId===mapId &&
    /^[a-f0-9]{64}$/.test(sha||'')){
   rows=romMap.staticEncounterEvents.map(e=>[
     e.objectOrdinal,e.speciesInternalId,e.level,e.eventBitIndex
   ]);
   source='ROM_LOCAL_TEXTO_CABEÇALHO_POKÉMON';
 }else if(KNOWN_ROM_HASHES.has(sha)&&KNOWN_FIXED_ENCOUNTERS[mapId]){
   rows=KNOWN_FIXED_ENCOUNTERS[mapId];
   source='12_CABEÇALHOS_FIXOS_VERIFICADOS_NAS_3_ROMS';
 }
 if(!rows||!rows.length)
  return {verified:false,source:'SEM_ENCONTROS_FIXOS_CONFIRMADOS_NESTE_MAPA',entries:[]};
 const seen=new Set(),entries=[];
 for(const [ordinal,speciesId,level,bit] of rows){
   const obj=objects[ordinal-1],id=obj?.wildSpeciesInternalId??obj?.trainerClassOrItemId;
   const lv=obj?.wildLevel??obj?.trainerNumberOrLevel;
   if(seen.has(ordinal)||!obj||
     !['trainer','wildPokemon'].includes(obj.kind)||id!==speciesId||lv!==level||
     !Number.isInteger(bit)||bit<0||bit>=2560)
     return {verified:false,source:'CONFLITO_ATLAS_ROM_E_OBJETOS',entries:[]};
   seen.add(ordinal);
   const eventFlagSet=!!(parseInt(eventHex[bit>>3],16)&(1<<(bit&7)));
   entries.push({objectOrdinal:ordinal,speciesInternalId:id,level,
     eventBitIndex:bit,eventFlagSet,encounterGateClosed:eventFlagSet,
     captured:null,defeated:null,source});
 }
 return {verified:true,mapId,source:source+' + RAM_D747',
   entries,semantics:'Flag indica que encontro foi marcado concluído/desativado; não demonstra captura.'};
}
module.exports={stationaryPokemonEvents,KNOWN_FIXED_ENCOUNTERS};
