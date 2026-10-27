'use strict';
// Confronta os IDs usados pela app com as tabelas oficiais do pret/pokered.
// Modo apenas de leitura: node verifyGen1Ids.js
const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;
const registry = require('./data/gen1CanonicalIds.json');
const runtime = require('./data/pokemonData');
const moves = require('./data/exact_moves.json');
const items = require('./data/exact_items.json');
const norm = x => String(x || '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/♂/g, 'M').replace(/♀/g, 'F')
  .replace(/[^A-Z0-9]/g, '')
  .replace(/^PSYCHICM$/, 'PSYCHIC'); // ID 94: constante PSYCHIC_M, nome apresentado Psychic

function addressFromSym(lines, symbol) {
  const re = new RegExp('^00:([0-9a-f]{4}) ' + symbol + '$', 'im');
  const m = lines.match(re);
  assert.ok(m, 'Símbolo em falta: ' + symbol);
  return parseInt(m[1], 16);
}
const sym = fs.readFileSync(path.join(__dirname, 'data/pokered.sym'),'utf8');
const expectedAddresses = {
  wBoxMon1:0xda96, wBoxCount:0xda80, wDayCareInUse:0xda48,
  wDayCareMon:0xda5f, wDayCareMonExp:0xda6d,
  wPlayTimeHours:0xda41, wPlayTimeMinutes:0xda43,
  wPlayTimeSeconds:0xda44, wNumBoxItems:0xd53a,
  wBoxItems:0xd53b, wPartyCount:0xd163, wPartyMon1:0xd16b,
  wPokedexOwned:0xd2f7, wPokedexSeen:0xd30a,
  wIsInBattle:0xd057, wEventFlags:0xd747,
  wGrassRate:0xd887, wRepelRemainingSteps:0xd0db
};
for (const [symbol, address] of Object.entries(expectedAddresses)) {
  assert.equal(addressFromSym(sym,symbol), address, symbol);
}
let speciesChecked=0;
for (const [id,entry] of Object.entries(registry.internalPokemonIds)) {
  if (entry.dex===0) continue;
  const p = runtime.INTERNAL_TO_POKEMON[id];
  assert.ok(p, 'Pokémon em falta: ID '+id);
  assert.equal(p.dex,entry.dex, 'Dex de '+id);
  assert.equal(norm(p.name),norm(entry.symbol), 'Nome do Pokémon '+id);
  assert.ok(!(p.types||[]).includes('Fairy') && !(p.types||[]).includes('Steel'),
    'Tipo de geração posterior no ID '+id);
  speciesChecked++;
}
assert.equal(speciesChecked,151);
const glitchIds=registry.glitchIndices;
assert.equal(glitchIds.length,39);
for (const id of glitchIds) assert.equal(runtime.INTERNAL_TO_POKEMON[id]?.dex,0,
  'ID MissingNo atribuído a Pokémon normal: '+id);
let movesChecked=0;
for (const [id,symbol]of Object.entries(registry.moveIds)) {
  assert.ok(runtime.MOVES[id], 'Golpe inexistente ID '+id);
  assert.equal(norm(runtime.MOVES[id].name),norm(symbol), 'Golpe '+id);
  assert.equal(norm(moves[id]?.name),norm(symbol),'Tabela JSON de golpe '+id);
  movesChecked++;
}
assert.equal(movesChecked,165);
let itemChecked=0, itemDisplayExceptions=[];
for (const [id,symbol]of Object.entries(registry.itemIds)) {
  const it=runtime.ITEM_NAMES[id];
  const jsonIt=items[id];
  assert.ok(it && jsonIt, 'ID de item em falta '+id);
  assert.equal(norm(it),norm(jsonIt), 'Inventários diferentes para item '+id);
  if(norm(it)!==norm(symbol)) {
    if(symbol==='SURFBOARD' || symbol.startsWith('FLOOR_')) itemDisplayExceptions.push(id);
    else assert.equal(norm(it),norm(symbol),'Item '+id);
  }
  itemChecked++;
}
const code=fs.readFileSync(path.join(__dirname, 'retroarchClient.js'),'utf8');
assert.match(code,/const CHUNK_SIZE = 160;/);
assert.match(code,/const monOffset = 86 \+ i \* 33;/);
assert.match(code,/parseInt\(blockBoxTime\[1\], 16\)/);
assert.match(code,/parseInt\(blockBoxTime\[3\], 16\)/);
assert.match(code,/parseInt\(blockBoxTime\[4\], 16\)/);

const events = require('./data/exact_events.json');
const speciesCatalog = require('./data/gen1CanonicalSpecies.json').species;
const learnsets = require('./data/gen1CanonicalLearnsets.json').byDex;
const wild = require('./data/gen1CanonicalWildEncounters.json').maps;
const trades = require('./data/gen1NpcTrades.json').trades;
const maps = require('./data/gen1CanonicalMaps.json').maps;
const evasm = fs.readFileSync(path.join(__dirname,'data/event_constants.asm'),'utf8');
let eventNumber=0, eventsChecked=0;
const parseCount=x=>x.startsWith('
 result:'OK',source:'pret/pokered constants and local .sym',
 internalSpeciesVerified:speciesChecked,moveIdsVerified:movesChecked,
 itemIdsVerified:itemChecked,glitchIdsVerified:glitchIds.length,
 symbolsVerified:Object.keys(expectedAddresses).length,
 specialItemDisplayNames:itemDisplayExceptions
},null,2));
)?parseInt(x.slice(1),16):Number(x);
for (const raw of evasm.split('\n')) {
  const s=raw.split(';')[0].trim(); let m;
  if ((m=s.match(/^const_def(?:\s+(\$[0-9a-f]+|\d+))?$/i))) eventNumber=m[1]?parseCount(m[1]):0;
  else if ((m=s.match(/^const_next\s+(\$[0-9a-f]+|\d+)$/i))) eventNumber=parseCount(m[1]);
  else if ((m=s.match(/^const_skip(?:\s+(\$[0-9a-f]+|\d+))?$/i))) eventNumber+=m[1]?parseCount(m[1]):1;
  else if ((m=s.match(/^const\s+(EVENT_\w+)$/))) {
    assert.equal(events[m[1]],eventNumber,'Flag canónica do evento '+m[1]);
    assert.ok(eventNumber < 2560, 'Flag superior a 320 bytes RAM');
    eventNumber++;eventsChecked++;
  }
}
assert.equal(eventsChecked,507);
assert.equal(Object.keys(events).length,507);
assert.equal(new Set(Object.values(events)).size,507);
assert.equal(events.EVENT_BEAT_CERULEAN_ROCKET_THIEF,167);
assert.equal(events.EVENT_BEAT_MISTY,191);
assert.equal(Object.keys(speciesCatalog).length,151);
assert.equal(Object.keys(learnsets).length,151);
assert.equal(Object.keys(wild).length,59);
assert.equal(Object.keys(maps).length,248);
assert.equal(trades.filter(t=>t.available).length,9);
for (const [dex,s] of Object.entries(speciesCatalog)) {
  assert.ok(s.sourceVerified && s.dex === Number(dex), 'Ficha sem fonte '+dex);
  assert.ok(Number.isInteger(s.catchRate) && s.catchRate>=1 && s.catchRate<=255,
    'Taxa captura inválida '+dex);
  assert.ok(['FAST','MEDIUM_FAST','MEDIUM_SLOW','SLOW'].includes(s.growthRate),
    'Curva de experiência inválida '+dex);
  assert.ok(learnsets[dex] && learnsets[dex].dex===s.dex,'Learnset indisponível '+dex);
  for(let lvl=2;lvl<=100;lvl++) {
    const exp=runtime.getGen1ExpForLevel(Number(dex),lvl);
    assert.ok(Number.isInteger(exp) && exp>=0,'Experiência inválida '+dex+' Lv'+lvl);
    assert.equal(runtime.getGen1LevelFromExp(Number(dex),exp),lvl,'Curva inconsistente '+dex+' Lv'+lvl);
  }
}
const weights=[51,51,39,25,25,25,13,13,11,3];
assert.equal(weights.reduce((a,b)=>a+b,0),256);
for(const [name,record] of Object.entries(wild)){
  for(const variant of ['red','blue'])for(const type of ['grass','water']){
    const slots=record.variants[variant][type];
    const rate=record.encounterRateByte[type];
    assert.equal(slots.length,rate?10:0,'Slots '+name+' '+variant+' '+type);
    if(rate) {
      assert.equal(slots.reduce((acc,s)=>acc+s.weight,0),256,'Pesos '+name);
      slots.forEach((s,i)=>assert.equal(s.weight,weights[i],'Peso slot '+name+' '+i));
    }
  }
}

console.log(JSON.stringify({
 result:'OK',source:'pret/pokered constants and local .sym',
 internalSpeciesVerified:speciesChecked,moveIdsVerified:movesChecked,
 itemIdsVerified:itemChecked,glitchIdsVerified:glitchIds.length,
 symbolsVerified:Object.keys(expectedAddresses).length,
 specialItemDisplayNames:itemDisplayExceptions
},null,2));
