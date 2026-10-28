'use strict';
const {isKnownAuditedRomSha}=require('./romKnownSha256');

// Apenas para golpes que executam MoveHitTest/CalcHitChance.
// Fontes primárias: pret/pokered/engine/battle/core.asm (CalcHitChance, MoveHitTest)
// e pret/pokered/data/battle/stat_modifiers.asm (tabela de 13 rácios).
// Bytes e rácios devem provir da ROM identificada; estágios/condições da RAM.
// Não abrange bypass, OHKO, efeitos especiais, bloqueios prévios nem previsão do RNG.

function integerBetween(n, low, high, name) {
  if (!Number.isInteger(n) || n < low || n > high) {
    throw new RangeError(`${name}: valor ausente ou inválido`);
  }
  return n;
}

function standardHitChance({
  accuracyByteFromRom,
  accuracyStageFromRam,
  evasionStageFromRam,
  statModifierRatiosFromRom,
  evidence
} = {}) {
  if (!evidence || evidence.exactRomSha256Verified !== true ||
      evidence.liveRamSnapshotVerified !== true || evidence.standardHitTestAppliesVerified !== true ||
      typeof evidence.romSha256 !== 'string' || !isKnownAuditedRomSha(evidence.romSha256)) {
    return { verified: false, reason: 'ROM/RAM ou aplicabilidade do teste de precisão não comprovadas' };
  }

  const accuracy = integerBetween(accuracyByteFromRom, 0, 255, 'byte de precisão da ROM');
  const attackerStage = integerBetween(accuracyStageFromRam, 1, 13, 'estágio de precisão RAM');
  const defenderStage = integerBetween(evasionStageFromRam, 1, 13, 'estágio de evasão RAM');
  if (!Array.isArray(statModifierRatiosFromRom) || statModifierRatiosFromRom.length !== 13) {
    throw new RangeError('Tabela de 13 rácios não comprovada na ROM');
  }
  const ratioTable = statModifierRatiosFromRom.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new RangeError(`Rácio ROM ${index + 1} ausente`);
    return {
      numerator: integerBetween(entry.numerator, 1, 255, `numerador ROM ${index + 1}`),
      denominator: integerBetween(entry.denominator, 1, 255, `denominador ROM ${index + 1}`)
    };
  });

  let scaledAccuracy = accuracy;
  for (const stage of [attackerStage, 14 - defenderStage]) {
    const {numerator, denominator} = ratioTable[stage - 1];
    scaledAccuracy = Math.max(1, Math.floor(scaledAccuracy * numerator / denominator));
  }
  // A implementação ASM satura no fim. Hit: R uniforme 0..255, se R < byte.
  const thresholdByte = Math.min(255, scaledAccuracy);
  return {
    verified: true,
    scope: 'MoveHitTest padrão; não inclui bypass, OHKO nem bloqueios prévios',
    romSha256: evidence.romSha256.toLowerCase(),
    thresholdByte,
    hitOutOf256: thresholdByte,
    missOutOf256: 256 - thresholdByte,
    hitProbability: thresholdByte / 256,
    hitPercent: thresholdByte * 100 / 256,
    source: 'byte de golpe ROM + rácios ROM + estágios RAM; CalcHitChance/MoveHitTest Gen I'
  };
}

module.exports = { standardHitChance };
