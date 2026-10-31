'use strict';
// Evidência conservadora: um objeto definido na ROM NÃO implica presença atual
// e a ausência na lista de sprites NÃO implica recolha/derrota.
// Só se identifica "observado" quando coincidem tipo, coordenadas e sprite.
function asInt(v) { return Number.isInteger(v) ? v : null; }
function sameKind(rom, live) {
  if (rom.kind === 'item') return live.isItem === true;
  if (rom.kind === 'trainer') return live.isItem !== true && live.isTrainer === true;
  return live.isItem !== true && live.isTrainer !== true;
}
function buildRomAreaEvidence(romMap, entities, itemNames, options={}) {
  if (!romMap || romMap.valid !== true || !romMap.objects ||
      !Array.isArray(romMap.objects.objects) || !options.romIdentityMatched) {
    return { verified:false, source:'ROM_NÃO_CONFIRMADA',
      items:[],trainers:[],npcs:[],reason:'Mapa ou identidade CRC32 indisponível' };
  }
  const spritesVerified=options.spritesVerified === true;
  const toggles=options.toggleables?.verified ? options.toggleables.entries : null;
  const trainerFlags=options.trainerFlags?.verified ? options.trainerFlags.entries : null;
  const stationaryFlags=options.stationaryPokemon?.verified ?
    options.stationaryPokemon.entries : null;
  const live=Array.isArray(entities) ? entities : [];
  // Slots RAM de sprites: 1..15. Proximidade nao prova identidade.
  // Duplicados no mesmo slot sao ambiguos, mesmo se os dados coincidirem.
  const spritesByOrdinal=new Map();
  if(spritesVerified){
    for(const sprite of live){
      if(!Number.isInteger(sprite?.spriteIndex)||
         sprite.spriteIndex<1||sprite.spriteIndex>15)continue;
      const entries=spritesByOrdinal.get(sprite.spriteIndex)||[];
      entries.push(sprite);
      spritesByOrdinal.set(sprite.spriteIndex,entries);
    }
  }
  const items=[],trainers=[],npcs=[],stationaryPokemon=[];
  for (let i=0;i<romMap.objects.objects.length;i++) {
    const obj=romMap.objects.objects[i];
    const id=asInt(obj.trainerClassOrItemId);
    // Compatibilidade com perfis anteriores: IDs < 200 são espécies fixas,
    // não classes de treinador humano (OPP_ID_OFFSET=200 na Gen I).
    const kind=obj.kind==='trainer'&&id!==null&&id>=1&&id<=190
      ? 'wildPokemon' : obj.kind;
    if (!['item','trainer','npc','wildPokemon'].includes(kind)) continue;
    const entry={
      mapId:romMap.mapId,objectOrdinal:i+1,kind,
      x:asInt(obj.x),y:asInt(obj.y),pictureId:asInt(obj.spriteId),
      itemId:kind==='item'?id:null,
      itemName:kind==='item' && id!==null
        ? ((itemNames && itemNames[id]) || 'Item #'+id+' (nome não confirmado pela ROM)') : null,
      trainerClassId:kind==='trainer'?id:null,
      trainerNumber:kind==='trainer'?asInt(obj.trainerNumberOrLevel):null,
      speciesInternalId:kind==='wildPokemon'?id:null,
      speciesName:kind==='wildPokemon' ?
        options.speciesName?.(id)||null : null,
      encounterLevel:kind==='wildPokemon'?asInt(obj.trainerNumberOrLevel):null,
      eventFlagSet:null,encounterGateClosed:null,captured:null,
      source:'OBJETO_DEFINIDO_NA_ROM_COM_CRC32_CORRESPONDENTE',
      existsInRom:true,observedInRam:null,
      collected:null,defeated:null,completionSource:'FLAG_ESPECÍFICA_NÃO_ASSOCIADA',
      visibilitySource:'RAM_DE_SPRITES_NÃO_CONFIRMADA',
      toggleableFlagIndex:null,removedFromMap:null,
      removedSource:'SEM_ASSOCIAÇÃO_ATUAL_ROM_RAM'
    };
    const toggle=toggles?.find(x=>x.spriteIndex===i+1);
    if(toggle){
      entry.toggleableFlagIndex=toggle.globalFlagIndex;
      entry.removedFromMap=toggle.removedFromMap;
      entry.removedSource=toggle.source;
      // Algumas entidades são removidas por scripts, não pela recolha ou derrota.
      // Nunca converter removedFromMap em collected/defeated por suposição.
    }
    // O classificador RAM de sprites só distingue NPCs e treinadores
    // textuais; não validar a presença de um Pokémon fixo por esse campo.
    if (spritesVerified && kind!=='wildPokemon' &&
        entry.x!==null && entry.y!==null) {
      const candidates=spritesByOrdinal.get(entry.objectOrdinal)||[];
      if(candidates.length>1){
        entry.observedInRam=null;
        entry.visibilitySource='RAM_SPRITE_ORDINAL_DUPLICADO_AMBIGUO';
      }else{
        const sprite=candidates[0];
        const exact=!!sprite&&
          Number.isInteger(sprite.x)&&Number.isInteger(sprite.y)&&
          sprite.x===entry.x&&sprite.y===entry.y&&
          asInt(sprite.pictureId)===entry.pictureId&&
          sameKind(entry,sprite);
        entry.observedInRam=exact;
        entry.visibilitySource=exact
          ?'RAM_SPRITE_ORDINAL_X_Y_PICTURE_KIND_EXATOS'
          :'NÃO_OBSERVADO_NA_RAM_NÃO_PROVA_CONCLUSÃO';
      }
    }
    if (kind==='trainer'){
      const roster=typeof options.trainerPartyForObject==='function'
        ? options.trainerPartyForObject(obj) : null;
      entry.trainerClassName=roster?.className||null;
      entry.team=roster?.team||null;
      entry.teamVariantDependent=roster?.variantDependent===true;
      entry.teamSource=roster?.source||'EQUIPA_TREINADOR_NÃO_VALIDADA_NESTA_ROM';
      const battle=trainerFlags?.find(x=>x.objectOrdinal===i+1);
      if(battle){
        // Apenas os scripts que executam SetEvent após confirmar que NÃO perdeu
        // permitem afirmar vitória. Nunca inferir derrota/vitória de flags genéricas.
        entry.defeated=battle.defeated===true?true:null;
        entry.victoryRecorded=battle.victoryRecorded??null;
        entry.battleWasPlayed=battle.battleWasPlayed??null;
        entry.scriptBattleName=battle.scriptBattleName??null;
        entry.outcomeEvidence=battle.outcomeEvidence??null;
        entry.battleGateClosed=battle.battleGateClosed;
        entry.eventFlagSet=battle.eventFlagSet;
        entry.eventBitIndex=battle.eventBitIndex;
        entry.completionSource=battle.source;
      }
    }
    if(kind==='wildPokemon'){
      const info=stationaryFlags?.find(x=>x.objectOrdinal===i+1);
      if(info){
        entry.eventBitIndex=info.eventBitIndex;
        entry.eventFlagSet=info.eventFlagSet;
        entry.encounterGateClosed=info.encounterGateClosed;
        entry.completionSource=info.source;
      }
    }
    if (kind==='item') items.push(entry);
    else if (kind==='trainer') trainers.push(entry);
    else if (kind==='wildPokemon') stationaryPokemon.push(entry);
    else npcs.push(entry);
  }
  return {verified:true,mapId:romMap.mapId,
    source:'ROM_COM_CRC32_CORRESPONDENTE + RAM_SE_VALIDADA',
    items,trainers,npcs,stationaryPokemon,
    note:'Objetos da ROM não comprovam recolha/derrota/captura. Ausência da RAM não comprova conclusão.',
    toggleableRamVerified:!!toggles,
    trainerEventRamVerified:!!trainerFlags,
    stationaryEncounterRamVerified:!!stationaryFlags,
    counts:{items:items.length,trainers:trainers.length,
      stationaryPokemon:stationaryPokemon.length,npcs:npcs.length}};
}
module.exports={buildRomAreaEvidence};
