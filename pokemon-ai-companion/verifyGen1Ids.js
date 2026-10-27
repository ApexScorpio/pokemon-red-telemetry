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
  .replace(/[^A-Z0-9]/g, '');

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
console.log(JSON.stringify({
 result:'OK',source:'pret/pokered constants and local .sym',
 internalSpeciesVerified:speciesChecked,moveIdsVerified:movesChecked,
 itemIdsVerified:itemChecked,glitchIdsVerified:glitchIds.length,
 symbolsVerified:Object.keys(expectedAddresses).length,
 specialItemDisplayNames:itemDisplayExceptions
},null,2));
