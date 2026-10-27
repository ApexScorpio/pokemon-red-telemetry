'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { bankOffset, parseSym, readPokemonTables, readGrowthRates, readEvolutionsAndLearnsets, readMoveNames, scanRom } = require('../romAtlas');
const { expAtLevel, statFromRamAndRom, hpDvFromDvs, eventFlagFromRam } = require('../gen1EngineMath');

function buildFixture() {
  const rom = Buffer.alloc(32768, 0);
  rom[0x148] = 0; // 2 bancos = 32 KiB
  rom.write('TESTRED', 0x134, 'ascii');
  const names = 0x200, order = 0xA00, base = 0xB00, growth = 0x2000;
  for (let i = 0; i < 190; i++) {
    rom.fill(0x50, names + i * 10, names + (i + 1) * 10);
    rom[order + i] = i < 150 ? i + 1 : 0;
    if (i < 150) {
      rom[base + i * 28] = i + 1;
      rom[base + i * 28 + 1] = 45; // HP
    }
  }
  // "RHYDON" em charmap ocidental.
  const name = 'RHYDON';
  for (let i = 0; i < name.length; i++) rom[names + i] = 0x80 + name.charCodeAt(i) - 65;
  rom.set([0x11, 0, 0, 0, 0x34, 10, 0, 30, 0x34, 20, 0, 70,
    0x65, 0x8F, 100, 140, 0x45, 0, 0, 0, 0x54, 0, 0, 0], growth);
  let headerCheck = 0;
  for (let i = 0x134; i <= 0x14C; i++) headerCheck = (headerCheck - rom[i] - 1) & 255;
  rom[0x14D] = headerCheck;
  let global = 0;
  for (let i = 0; i < rom.length; i++) if (i !== 0x14E && i !== 0x14F) global = (global + rom[i]) & 0xFFFF;
  rom.writeUInt16BE(global, 0x14E);
  // Tabela sintética compatível: 190 ponteiros -> zero evoluções, zero golpes.
  const pointers = 0x2100, evolutions = 0x2400, moves = 0x2600;
  for (let i = 0; i < 190; i++) {
    const entry = i === 0 ? evolutions : evolutions + 8 + (i - 1) * 2;
    rom.writeUInt16LE(entry, pointers + i * 2);
    if (i > 0) rom.set([0, 0], entry);
  }
  rom.set([1, 20, 2, 0, 10, 1, 0], evolutions);
  let m = moves;
  const first = 'POUND';
  for (let i = 0; i < 165; i++) {
    for (const ch of (i === 0 ? first : 'A')) rom[m++] = 0x80 + ch.charCodeAt(0) - 65;
    rom[m++] = 0x50;
  }
  const sym = parseSym('00:0200 MonsterNames\n00:0A00 PokedexOrder\n00:0B00 BaseStats\n00:2000 GrowthRateTable\n00:2100 EvosMovesPointerTable\n00:2600 MoveNames\n');
  return { rom, sym };
}

test('os offsets CPU dependem do banco da ROM, não são números arbitrários', () => {
  assert.equal(bankOffset(0, 0x0100, 32768), 0x0100);
  assert.equal(bankOffset(1, 0x4000, 32768), 0x4000);
  assert.equal(bankOffset(1, 0x7FFF, 32768), 0x7FFF);
  assert.equal(bankOffset(2, 0x4000, 32768), null);
  assert.equal(bankOffset(1, 0x2000, 32768), null);
});

test('a ROM sintetizada preserva relações ID→nome→Pokédex→base stats', () => {
  const { rom, sym } = buildFixture();
  const data = readPokemonTables(rom, sym);
  assert.equal(data.verified, true);
  assert.equal(data.entries.length, 190);
  assert.equal(data.entries[0].name, 'RHYDON');
  assert.equal(data.entries[0].baseStats.hp, 45);
  assert.equal(data.entries[0].pokedexNumber, 1);
  assert.equal(data.entries[189].baseStats, null);
});

test('eventos de evolução e ataques por nível vêm da estrutura binária ROM', () => {
  const { rom, sym } = buildFixture();
  const evo = readEvolutionsAndLearnsets(rom, sym);
  assert.equal(evo.validCount, 190);
  assert.deepEqual(evo.entries[0].evolutions[0], { method: 1, params: [20, 2] });
  assert.deepEqual(evo.entries[0].learnset[0], { level: 10, moveId: 1 });
  const moves = readMoveNames(rom, sym);
  assert.equal(moves.valid, true);
  assert.equal(moves.entries.length, 165);
  assert.equal(moves.entries[0].name, 'POUND');
});

test('fórmulas de EXP são lidas dos coeficientes do ficheiro ROM', () => {
  const { rom, sym } = buildFixture();
  const data = readGrowthRates(rom, sym);
  assert.equal(data.length, 6);
  assert.equal(expAtLevel(data[0], 100), 1000000);
  assert.equal(expAtLevel(data[3], 100), 1059860);
  assert.equal(expAtLevel(data[4], 100), 800000);
  assert.equal(expAtLevel(data[5], 100), 1250000);
  assert.throws(() => expAtLevel({ numerator: 1, denominator: 1 }, 10));
});

test('stats e flags seguem cálculos Gen I, sem inventar bytes ausentes', () => {
  assert.equal(hpDvFromDvs(15, 0, 9, 6), 10);
  assert.equal(statFromRamAndRom(35, 7, 22850, 81, true), 189);
  assert.equal(eventFlagFromRam(9, Buffer.from([0, 2])).set, true);
  assert.equal(eventFlagFromRam(31, Buffer.from([0, 2])), null);
  assert.throws(() => statFromRamAndRom(35, null, 0, 10));
});

test('varrimento de 100% dos bytes não atesta automaticamente símbolos sem referência', () => {
  const { rom } = buildFixture();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokemon-rom-audit-'));
  const filename = path.join(dir, 'test.gb'), symname = path.join(dir, 'test.sym');
  try {
    fs.writeFileSync(filename, rom);
    fs.writeFileSync(symname, '00:0200 MonsterNames\n00:0A00 PokedexOrder\n00:0B00 BaseStats\n00:2000 GrowthRateTable\n00:2100 EvosMovesPointerTable\n00:2600 MoveNames\n');
    const noSymbols = scanRom(filename, { symbolFile: symname });
    assert.equal(noSymbols.coverage.percentagemBytes, 100);
    assert.equal(noSymbols.coverage.banksVerified, 2);
    assert.equal(noSymbols.mapping.status, 'BLOQUEADO');
    const expected = crypto.createHash('sha256').update(rom).digest('hex');
    const guarded = scanRom(filename, { symbolFile: symname, referenceSha256: expected });
    assert.equal(guarded.mapping.status, 'TABELAS_VERIFICADAS_ESTRUTURALMENTE');
    assert.equal(guarded.matchesIphoneLoadedRom, false);
    assert.equal(guarded.coverage.percentagemElementosSemanticos, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
