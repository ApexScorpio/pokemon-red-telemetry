'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProfiles, getCurrentRom, pokemonFromProfile, moveNameFromProfile } = require('../romLiveResolver');

test('regista simultaneamente Red, Blue e Green pelo CRC, sem depender do nome do ficheiro ROM', {skip: !process.env.POKEMON_ROM_PROFILE_DIR}, () => {
  const {profiles, errors} = buildProfiles();
  assert.deepEqual(errors, [], 'Perfis recusados: '+JSON.stringify(errors));
  const expected = [
    ['POKEMON RED','9F7FDD53'],
    ['POKEMON BLUE','D6DA8A1A'],
    ['POKEMON GREEN','3C2DD8AE']
  ];
  for(const [title,crc] of expected){
    const p=getCurrentRom('GET_STATUS PLAYING game_boy,arbitrary_filename,crc32='+crc,profiles);
    assert.ok(p,'Não reconheceu o CRC '+crc);
    assert.equal(p.title,title);
    assert.equal(p.hash.crc32,crc);
    assert.equal(p.species.length,190);
    assert.equal(p.moveNames.length,165);
    assert.equal(pokemonFromProfile(p,1).name,'RHYDON');
    assert.equal(moveNameFromProfile(p,41),'TWINEEDLE');
    const beedrill=p.species.find(s=>s.name==='BEEDRILL');
    assert.ok(beedrill.learnset.some(m=>m.level===20&&m.moveId===41));
  }
  const notRegistered = getCurrentRom('GET_STATUS PLAYING game_boy,POKEMON RED,crc32=00000000', profiles);
  assert.equal(notRegistered,null,'Não pode identificar só pelo título');
  const green=getCurrentRom('GET_STATUS PLAYING game_boy,green,crc32=3C2DD8AE',profiles);
  const red=getCurrentRom('GET_STATUS PLAYING game_boy,red,crc32=9F7FDD53',profiles);
  assert.equal(green.offsets.dexOrder.fileOffset,0x41956);
  assert.equal(red.offsets.dexOrder.fileOffset,0x41024);
});

test('não aceita o jogo sem CRC conhecido', () => {
  const {profiles} = buildProfiles();
  assert.equal(getCurrentRom('GET_STATUS CONTENTLESS',profiles),null);
  assert.equal(getCurrentRom('GET_STATUS PLAYING game_boy,unknown,crc32=00000000',profiles),null);
});
