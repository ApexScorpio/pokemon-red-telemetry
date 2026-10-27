'use strict';
// Dados extraídos diretamente das ROMs Red, Blue e Green International 1.2.1.
// Cada registo de 4 bytes é [mapId, objectOrdinal, eventBitLo, eventBitHi].
// Trajeto verificado: object.textId -> text pointer -> TEXT_ASM routine ->
// LD HL,trainerHeader -> CALL TalkToTrainer (direto/JR) -> trainerHeader ->
// bitOffset + 8*(wEventFlagsPointer - 0xD747). Em 3 ROMs os 312 registos coincidem.
// 34 NPCs com scripts especiais não foram interpretados: NUNCA adivinhar flag.
const ROM_HASHES=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
]);
const ATLAS_BASE64=
'DgLiAw4D4wMOBOQDDgXlAw4G5gMOB+cDDgjoAw4J6QMPAvIDEQERBBECEgQRAxMEEQQUBBEFFQQRBhYEEwExBBMCMgQTAzMEEwQ0BBMFNQQTBjYEEwc3BBMIOAQTCTkEFAFBBBQCQgQUA0MEFAREBBQFRQQUBkYEFAdHBBQISAQUCUkEFQFRBBUCUgQVA1MEFQRUBBUFVQQVBlYEFgFxBBYCcgQWA3MEFgR0BBYFdQQWBnYEFgd3BBYIeAQWCXkEFgp6BBcCggQXA4MEFwSEBBcFhQQXBoYEFweHBBcIiAQYAZEEGAKSBBgDkwQYBJQEGAWVBBgGlgQYB5cEGAiYBBgJmQQYCpoEGQGhBBkCogQZA6MEGQSkBBkFpQQZBqYEGQenBBkIqAQZCakEGQqqBBoBsQQaArIEGgOzBBoEtAQaBbUEGga2BBoHtwQaCLgEGgm5BBoKugQbAcEEGwLCBBsDwwQbBMQEGwXFBBsGxgQcAdEEHALSBBwD0wQcBNQEHAXVBBwG1gQcB9cEHAjYBBwJ2QQcCtoEHQHhBB0C4gQdA+MEHgHxBB4C8gQeA/MEHgT0BB4F9QQeBvYEHgf3BB4I+AQeCfkEHgr6BB8BAQUfAgIFHwMDBR8EBAUfBQUFHwYGBR8HBwUfCAgFHwkJBR8KCgUgAREFIAISBSADEwUgBBQFIAUVBSAGFgUgBxcFIAgYBSAJGQUjAkIFIwNDBSMERAUjBUUFIwZGBSMHRwUkAVEFJAJSBSQDUwUkBFQFJAVVBSQGVgUkB1cFJAhYBSQJWQUtAlIALQNTAC0EVAAtBVUALQZWAC0HVwAtCFgALQlZADMCYgUzA2MFMwRkBTYCcgA7AXEFOwJyBTsDcwU7BHQFOwV1BTsGdgU7B3cFPQJ6BT0DewU9BHwFPQV9BUECugBBA7sAUgFZBFICWgRSA1sEUgRcBFIFXQRSBl4EUgdfBFwCYgFcA2MBXARkAWMExAVjBcUFZgHxBWYC8gVmA/MFZgT0BWcBAQZnAgIGZwMDBmcEBAZoAREGaAISBmgDEwZoBBQGaAUVBmgGFgZsAREJbAISCXEB+QiGAqoBhgOrAYYErAGGBa0BhgauAYYHrwGGCLABkAHxAJAC8gCQA/MAkQH5AJEC+gCRA/sAkgICAZIDAwGSBAQBkgUFAZMBCQGTAgoBkwMLAZQBEQGUAhIBlAMTAZ0CWgKdA1sCnQRcAp0FXQKdBl4CnQdfAqUBiQKxAlIDsQNTA7EEVAOxBVUDsgJiA7IDYwOyBGQDsgVlA7IGZgOyB2cDsghoA8IBOQXCAjoFwgM7BcIEPAXCBT0FwgY+BcYBYQbGAmIGxgNjBsYEZAbHAXEGxwJyBscDcwbHBHQGxwV1BsgBgQbJAZEGyQKSBsoCogbKA6MGygSkBs8C8gbPA/MGzwT0Bs8F9QbQAgIH0AMDB9ECEgfRAxMH0QQUB9ICIgfSAyMH0gQkB9IFJQfTBjYH0wc3B9MIOAfUBUUH1AZGB9QHRwfUCEgH1QJSB9UDUwfVBFQH1gEBCNcBEQjXAhII2AEhCNgCIgjjAcEI6AGxCegCsgnoA7MJ6AS0CegFtQnoBrYJ6Ae3CegIuAnpAmIH6QNjB+kEZAfqAXEH6gJyB+sEhAfrBYUH9QHhCPYB6Qj3AfEI';
const ATLAS=(()=>{
 const bytes=Buffer.from(ATLAS_BASE64,'base64');
 if(bytes.length!==312*4)throw Error('Atlas de treinadores corrompido');
 const index=new Map();
 for(let i=0;i<bytes.length;i+=4){
  const map=bytes[i],ordinal=bytes[i+1],bit=bytes[i+2]|(bytes[i+3]<<8);
  if(ordinal<1||bit>=2560)throw Error('Registo de treinador inválido');
  if(!index.has(map))index.set(map,new Map());
  if(index.get(map).has(ordinal))throw Error('Treinador duplicado no atlas ROM');
  index.get(map).set(ordinal,bit);
 }
 return index;
})();
// Casos de script especial, extraídos e verificados nas três ROMs completas.
// Verificação binária: text_asm (0x08), LD A,[wEventFlags+n] (0xFA),
// BIT b,A (0xCB,0x47+8*b) no início do script do objeto treinador.
// Não extrapolar para ROMs com outros SHA-256.
const SPECIAL_SCRIPT_EVENTS={
  45:{1:81},    // Viridian Gym: Giovanni
  54:{1:119},   // Pewter Gym: Brock
  65:{1:191},   // Cerulean Gym: Misty
  92:{1:359},   // Vermilion Gym: Lt. Surge
  134:{1:425},  // Celadon Gym: Erika
  157:{1:601},  // Fuchsia Gym: Koga
  166:{1:665,2:666,3:667,4:668,5:669,6:670,7:671,8:672},
  178:{1:865},  // Saffron Gym: Sabrina
  202:{1:1703}  // Rocket Hideout B4F: Giovanni
};
const SPECIAL_INDEX=new Map(Object.entries(SPECIAL_SCRIPT_EVENTS).map(([map,ordinals])=>
 [Number(map),new Map(Object.entries(ordinals).map(([ordinal,bit])=>[Number(ordinal),bit]))]));
const VERIFIED_BY_MAP=Object.fromEntries([...ATLAS].map(([map,ordinals])=>
 [map,[...ordinals.values()]]));
function trainerFlagsForCurrentMap(profile,romMap,eventHex){
 const sha=profile?.hash?.sha256?.toLowerCase(),mapId=romMap?.mapId;
 if(!romMap?.valid)return {verified:false,source:'MAPA_ROM_NÃO_VALIDADO',entries:[]};
 const objects=romMap.objects?.objects;
 if(!Array.isArray(objects))return {verified:false,source:'OBJETOS_ROM_AUSENTES',entries:[]};
 if(!Array.isArray(eventHex)||eventHex.length!==320||
    eventHex.some(x=>typeof x!=='string'||!/^[a-fA-F0-9]{2}$/.test(x)))
    return {verified:false,source:'FLAGS_RAM_D747_INCOMPLETAS',entries:[]};
 // Perfis novos são produzidos diretamente da ROM que está no PC.
 // Perfis anteriores (v4) usam apenas atlas auditado por SHA-256 exato.
 let expected,source;
 if(Array.isArray(romMap.trainerEvents)&&
    profile?.world?.maps?.trainerEventsVerified>0 &&
    profile?.world?.maps?.data?.[mapId]?.mapId===mapId &&
    /^[0-9a-f]{64}$/.test(sha||'')){
   expected=new Map(romMap.trainerEvents.map(v=>[v.objectOrdinal,v.eventBitIndex]));
   source='ROM_PERFIL_LOCAL_TEXTO_CABEÇALHO';
 }else if(ROM_HASHES.has(sha)&&ATLAS.has(mapId)){
   expected=new Map(ATLAS.get(mapId));
   source='312_CABECALHOS_VALIDOS_NAS_3_ROMS';
 }else{
   expected=new Map();
   source='SEM_CABECALHO_TREINADOR_NORMAL';
 }
 // Estes 16 casos são scripts especiais: líder ou evento que usa
 // CheckEvent diretamente em vez de TalkToTrainer.
 if(ROM_HASHES.has(sha)&&SPECIAL_INDEX.has(mapId)){
   for(const [ordinal,bit] of SPECIAL_INDEX.get(mapId)){
     if(expected.has(ordinal)&&expected.get(ordinal)!==bit)
       return {verified:false,source:'CONFLITO_ENTRE_CABECALHOS_ROM',entries:[]};
     expected.set(ordinal,bit);
   }
   source+=(source==='SEM_CABECALHO_TREINADOR_NORMAL'?'':' + ')+
     '16_CHECKEVENT_ESPECIAIS_COMPROVADOS_NAS_3_ROMS';
 }
 // Perfis JSON antigos assinalavam Pokémon selvagens fixos como "trainer".
 // Não contam para vitórias de treinadores humanos (OPP_ID_OFFSET=200).
 for(const [ordinal] of expected){
   const actor=objects[ordinal-1];
   const speciesId=actor?.trainerClassOrItemId;
   if(actor?.kind==='wildPokemon'||
      (actor?.kind==='trainer'&&Number.isInteger(speciesId)&&
       speciesId>=1&&speciesId<=190))expected.delete(ordinal);
 }
 if(!expected.size)return {verified:false,source:'MAPA_SEM_TREINADORES_HUMANOS_AUDITADOS',entries:[]};
 const entries=[];
 for(const [ordinal,eventBitIndex] of expected){
  if(!Number.isInteger(ordinal)||ordinal<1||ordinal>objects.length||
     objects[ordinal-1]?.kind!=='trainer'||
     !Number.isInteger(eventBitIndex)||eventBitIndex<0||eventBitIndex>=2560)
     return {verified:false,source:'ORDINAL_ROM_OU_EVENT_BIT_INVÁLIDO',entries:[]};
  const eventFlagSet=!!(parseInt(eventHex[eventBitIndex>>3],16)&(1<<(eventBitIndex&7)));
  entries.push({objectOrdinal:ordinal,eventBitIndex,eventFlagSet,
    // Alguns scripts dos ginásios ativam flags após derrotar o LÍDER, sem
    // que o jogador tenha combatido individualmente cada treinador.
    defeated:null,
    battleGateClosed:eventFlagSet,
    source:source+' + RAM_D747'});
 }
 const n=objects.filter(x=>x.kind==='trainer' &&
   !(Number.isInteger(x.trainerClassOrItemId)&&
     x.trainerClassOrItemId>=1&&x.trainerClassOrItemId<=190)).length;
 return {verified:true,mapId,source:source+' + RAM_D747',
  entries,verifiedTrainerCount:entries.length,
  unknownTrainerCount:n-entries.length,fullyMapped:n===entries.length,
  semantics:'eventFlagSet significa combate desativado/marcado concluído; não comprova historicamente vitória individual'};
}
module.exports={trainerFlagsForCurrentMap,VERIFIED_BY_MAP,SPECIAL_SCRIPT_EVENTS};
