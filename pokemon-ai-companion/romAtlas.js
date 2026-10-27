'use strict';

// Inventário local (READ ONLY) de todos os bytes de uma ROM Game Boy.
// Sem upload da ROM. A interpretação de símbolos é proibida até comparar
// o SHA-256 com uma referência verificada independentemente.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { auditRomFile } = require('./romAudit');

const BANK_SIZE = 0x4000;
const hex = b => b.toString(16).padStart(2, '0').toUpperCase();

function parseSym(text) {
  const symbols = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{2}):([0-9a-fA-F]{4})\s+(\S+)$/.exec(line.trim());
    if (!m) continue;
    if (!symbols.has(m[3])) symbols.set(m[3], { bank: parseInt(m[1], 16), cpuAddress: parseInt(m[2], 16) });
  }
  return symbols;
}

function bankOffset(bank, cpuAddress, fileSize) {
  if (!Number.isInteger(bank) || !Number.isInteger(cpuAddress) || bank < 0) return null;
  const valid = bank === 0 ? cpuAddress >= 0 && cpuAddress < BANK_SIZE :
    cpuAddress >= BANK_SIZE && cpuAddress < BANK_SIZE * 2;
  if (!valid) return null;
  const offset = bank === 0 ? cpuAddress : bank * BANK_SIZE + cpuAddress - BANK_SIZE;
  return offset < fileSize ? offset : null;
}

function readSymbolTable(buffer, symbols, symbol, byteCount) {
  const entry = symbols.get(symbol);
  if (!entry) return null;
  const at = bankOffset(entry.bank, entry.cpuAddress, buffer.length);
  if (at === null || !Number.isInteger(byteCount) || byteCount < 0 ||
      at + byteCount > buffer.length ||
      Math.floor(at / BANK_SIZE) !== Math.floor((at + Math.max(1, byteCount) - 1) / BANK_SIZE)) return null;
  return buffer.subarray(at, at + byteCount);
}

function decodeGen1Name(data) {
  const chars = [];
  let complete = false;
  for (const b of data) {
    if (b === 0x50) { complete = true; break; }
    if (b >= 0x80 && b <= 0x99) chars.push(String.fromCharCode(65 + b - 0x80).toLowerCase());
    else if (b >= 0xA0 && b <= 0xB9) chars.push(String.fromCharCode(65 + b - 0xA0));
    else if (b >= 0xF6 && b <= 0xFF) chars.push(String(b - 0xF6));
    else if (b === 0xE8) chars.push('.');
    else if (b === 0xE3) chars.push('-');
    else if (b === 0xF5) chars.push(':');
    else if (b === 0x7F) chars.push(' ');
    else return { text: null, decoded: false, rawHex: data.toString('hex') };
  }
  return { text: chars.join(''), decoded: complete || chars.length === data.length,
    rawHex: data.toString('hex') };
}

function readPokemonTables(buffer, symbols) {
  const ids = readSymbolTable(buffer, symbols, 'PokedexOrder', 190);
  const names = readSymbolTable(buffer, symbols, 'MonsterNames', 190 * 10);
  const stats = readSymbolTable(buffer, symbols, 'BaseStats', 150 * 28);
  if (!ids || !names || !stats) return { verified: false, reason: 'Tabelas ou endereços incompatíveis com este ficheiro' };
  const pokemon = [];
  let verifiedStats = 0;
  for (let id = 1; id <= 190; id++) {
    const dex = ids[id - 1];
    const name = decodeGen1Name(names.subarray((id - 1) * 10, id * 10));
    let baseStats = null;
    if (dex >= 1 && dex <= 150) {
      const p = (dex - 1) * 28;
      const row = stats.subarray(p, p + 28);
      if (row[0] === dex) {
        verifiedStats++;
        baseStats = {
          hp: row[1], attack: row[2], defense: row[3], speed: row[4], special: row[5],
          typeIds: [row[6], row[7]], catchRate: row[8], baseExpYield: row[9],
          graphicDimensionByte: row[10],
          // Estes ponteiros não incluem por si só o banco dos gráficos!
          frontSpritePointerCpu: row.readUInt16LE(11),
          backSpritePointerCpu: row.readUInt16LE(13),
          initialMoveIds: [...row.subarray(15, 19)],
          growthRateId: row[19]
        };
      }
    }
    pokemon.push({ internalId: id, pokedexNumber: dex || null,
      name: name.decoded ? name.text : null, nameRawHex: name.decoded ? undefined : name.rawHex,
      baseStats, graphicsDecoded: false });
  }
  return {
    verified: verifiedStats === 150,
    mappedSpeciesInternalIds: 190,
    baseStatsMatchedAgainstDexNumber: verifiedStats,
    spritePixelsDecoded: false,
    entries: pokemon
  };
}

function readGrowthRates(buffer, symbols) {
  const table = readSymbolTable(buffer, symbols, 'GrowthRateTable', 6 * 4);
  if (!table) return null;
  return Array.from({ length: 6 }, (_, i) => {
    const k = i * 4;
    const fraction = table[k];
    const quadratic = table[k + 1];
    const numerator = fraction >> 4, denominator = fraction & 15;
    if (!numerator || !denominator) return null;
    return {
      id: i, numerator, denominator,
      squaredCoefficient: (quadratic & 0x7F) * (quadratic & 0x80 ? -1 : 1),
      linearCoefficient: table[k + 2], constantToSubtract: table[k + 3],
      origin: 'ROM: GrowthRateTable (4 bytes por grupo)'
    };
  });
}

function scanRom(filename, options = {}) {
  if (!fs.existsSync(filename)) throw new Error('ROM não encontrada: ' + filename);
  const buffer = fs.readFileSync(filename);
  const audit = auditRomFile(filename);
  if (audit.fileSizeMatchesHeader === false) throw new Error('Tamanho da ROM difere do cabeçalho');
  if (buffer.length % BANK_SIZE !== 0) throw new Error('ROM truncada ou sem bancos completos de 16 KiB');
  const banks = [];
  let coveredBytes = 0;
  for (let bank = 0; bank < buffer.length / BANK_SIZE; bank++) {
    const from = bank * BANK_SIZE;
    const segment = buffer.subarray(from, from + BANK_SIZE);
    coveredBytes += segment.length;
    banks.push({
      bank, byteStart: from, byteEndExclusive: from + segment.length,
      scannedBytes: segment.length,
      sha256: crypto.createHash('sha256').update(segment).digest('hex')
    });
  }
  if (coveredBytes !== buffer.length) throw new Error('Cobertura da ROM incompleta');
  let mapping = {
    status: 'SEM_DESMONTAGEM_VERIFICADA',
    notes: 'Todos os bytes do ficheiro foram lidos, mas nem todos os elementos foram descodificados.'
  };
  if (options.symbolFile) {
    const externalHash = options.referenceSha256 && String(options.referenceSha256).toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(externalHash || '') || externalHash !== audit.sha256FullFile) {
      mapping = { status: 'BLOQUEADO', reason: 'Para usar .sym é necessário SHA-256 de referência independente e coincidente; não associar símbolos de outra ROM.' };
    } else {
      const symbols = parseSym(fs.readFileSync(options.symbolFile, 'utf8'));
      const pokemon = readPokemonTables(buffer, symbols);
      const growthRates = readGrowthRates(buffer, symbols);
      mapping = {
        status: pokemon.verified && growthRates && growthRates.every(Boolean)
          ? 'TABELAS_VERIFICADAS_ESTRUTURALMENTE' : 'INCOMPATÍVEL',
        source: path.basename(options.symbolFile),
        warning: 'Hash fornecido externamente; equivalência da .sym à ROM exige prova de que vieram da mesma compilação. Gráficos/scripts não foram integralmente descodificados.',
        pokemon,
        growthRates
      };
    }
  }
  return {
    ...audit,
    coverage: { source: 'ficheiro ROM local', totalBytes: buffer.length,
      bytesLidos: coveredBytes, percentagemBytes: 100, banksVerified: banks.length,
      percentagemElementosSemanticos: null },
    banks, mapping, readsRuntimeRam: false, matchesIphoneLoadedRom: false
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const filename = args[0];
  if (!filename) {
    console.error('Uso: node romAtlas.js "<ROM.gb>" [--sym "<pokered.sym>" --reference-sha256 "<SHA256 confirmado externamente>"]');
    process.exitCode = 2;
  } else {
    try {
      const sym = args.indexOf('--sym');
      const sha = args.indexOf('--reference-sha256');
      const result = scanRom(filename, {
        symbolFile: sym >= 0 ? args[sym + 1] : null,
        referenceSha256: sha >= 0 ? args[sha + 1] : null
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.error('AUDITORIA ROM FALHOU:', e.message);
      process.exitCode = 1;
    }
  }
}

module.exports = { scanRom, bankOffset, parseSym, readPokemonTables, readGrowthRates, decodeGen1Name };
