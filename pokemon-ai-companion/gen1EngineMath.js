'use strict';

// Mecânicas Gen I só com dados verificados.
// Fórmula XP: pret/pokered/data/growth_rates.asm e engine/pokemon/experience.asm
// Fórmula Stats: pret/pokered/engine/pokemon/stats.asm
// Flags: pret/pokered/macros/scripts/events.asm
//
// Separar regras lidas da ROM de estado lido da RAM. Não apresentar resultados
// como observados sem ambas as origens verificadas.

function assertNumber(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(label + ' inválido ou indisponível');
  }
  return value;
}

function expAtLevel(growthFromRom, level) {
  assertNumber(level, 1, 100, 'nível');
  if (!growthFromRom || growthFromRom.origin !== 'ROM: GrowthRateTable (4 bytes por grupo)') {
    throw new Error('Coeficientes de crescimento não comprovados na ROM');
  }
  const { numerator, denominator, squaredCoefficient, linearCoefficient, constantToSubtract } = growthFromRom;
  assertNumber(numerator, 1, 15, 'numerador da ROM');
  assertNumber(denominator, 1, 15, 'denominador da ROM');
  assertNumber(squaredCoefficient, -127, 127, 'coeficiente quadrático da ROM');
  assertNumber(linearCoefficient, 0, 255, 'coeficiente linear da ROM');
  assertNumber(constantToSubtract, 0, 255, 'constante da ROM');
  // A Gen I divide a componente cúbica com divisão inteira.
  const cubic = Math.floor(numerator * level ** 3 / denominator);
  return Math.max(0, cubic + squaredCoefficient * level * level +
    linearCoefficient * level - constantToSubtract);
}

function expUntilLevel(growthFromRom, currentExpFromRam, currentLevel, targetLevel) {
  assertNumber(currentExpFromRam, 0, 0xFFFFFF, 'EXP de RAM');
  assertNumber(currentLevel, 1, 100, 'nível atual');
  assertNumber(targetLevel, currentLevel, 100, 'nível pretendido');
  const threshold = expAtLevel(growthFromRom, targetLevel);
  return { source: 'regra ROM verificada + EXP RAM declarada', threshold,
    remaining: Math.max(0, threshold - currentExpFromRam), targetLevel };
}

function statFromRamAndRom(baseStatFromRom, dvFromRam, statExpFromRam, levelFromRam, hp = false) {
  assertNumber(baseStatFromRom, 1, 255, 'base stat ROM');
  assertNumber(dvFromRam, 0, 15, 'DV RAM');
  assertNumber(statExpFromRam, 0, 65535, 'Stat Exp RAM');
  assertNumber(levelFromRam, 1, 100, 'nível RAM');
  const evComponent = Math.floor(Math.ceil(Math.sqrt(statExpFromRam)) / 4);
  return Math.floor(((baseStatFromRom + dvFromRam) * 2 + evComponent) * levelFromRam / 100)
    + (hp ? levelFromRam + 10 : 5);
}

function hpDvFromDvs(attack, defense, speed, special) {
  for (const [name, value] of Object.entries({ attack, defense, speed, special })) {
    assertNumber(value, 0, 15, name + ' DV');
  }
  return ((attack & 1) << 3) | ((defense & 1) << 2) |
    ((speed & 1) << 1) | (special & 1);
}

function eventFlagFromRam(eventId, eventFlagBytes) {
  assertNumber(eventId, 0, 0xFFFF, 'event ID');
  if (!Buffer.isBuffer(eventFlagBytes) && !Array.isArray(eventFlagBytes)) {
    throw new Error('Bytes das flags não lidos da RAM');
  }
  const byteIndex = eventId >> 3;
  if (byteIndex >= eventFlagBytes.length) return null; // NÃO ASSUMIR evento pendente
  const byte = eventFlagBytes[byteIndex];
  assertNumber(byte, 0, 255, 'byte da flag RAM');
  return { eventId, byteIndex, bit: eventId & 7, set: !!(byte & (1 << (eventId & 7))),
    source: 'RAM wEventFlags + regra ROM CheckEvent' };
}

module.exports = { expAtLevel, expUntilLevel, statFromRamAndRom,
  hpDvFromDvs, eventFlagFromRam };
