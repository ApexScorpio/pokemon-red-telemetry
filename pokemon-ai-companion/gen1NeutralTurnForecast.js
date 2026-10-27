'use strict';
// Agregação dos ramos da Gen I. Só emite probabilidades para um único golpe
// neutro, sem STAB nem exceções, depois de validar inputs ROM/RAM de ambos os
// ramos crítico e não-crítico. Não presume conhecimento antecipado do RNG.
const {standardHitChance}=require('./gen1StandardHitChance');
const {criticalChance, neutralDamageDistribution}=require('./gen1CombatProbabilities');

function neutralTurnForecast({accuracyByteFromRom, accuracyStageFromRam,
  evasionStageFromRam, statModifierRatiosFromRom,
  baseSpeedFromRom, movePowerByteFromRom, highCriticalFromRom,
  focusEnergyActiveFromRam, nonCriticalVars, criticalVars,
  targetHpFromRam, evidence}={}) {
  if (!evidence || evidence.neutralTurnFullyApplicableVerified!==true ||
      evidence.criticalAndNormalDamageInputsVerified!==true) {
    return {verified:false,reason:'Aplicabilidade ou atributos distintos de crítico não comprovados'};
  }
  const accuracy=standardHitChance({accuracyByteFromRom,accuracyStageFromRam,
    evasionStageFromRam,statModifierRatiosFromRom,evidence});
  if (!accuracy.verified) return {verified:false,reason:accuracy.reason};
  const crit=criticalChance({baseSpeedFromRom,powerByteFromRom:movePowerByteFromRom,
    highCriticalFromRom,focusEnergyActiveFromRam,evidence});
  if (!crit.verified) return {verified:false,reason:crit.reason};
  if(!nonCriticalVars||!criticalVars || !Number.isInteger(targetHpFromRam) ||
     targetHpFromRam < 1 || targetHpFromRam > 999) {
    return {verified:false,reason:'Atributos ou HP do turno não disponíveis'};
  }
  const normal=neutralDamageDistribution({...nonCriticalVars,
    movePowerByte:movePowerByteFromRom,evidence});
  const critical=neutralDamageDistribution({...criticalVars,
    movePowerByte:movePowerByteFromRom,evidence});
  if (!normal.verified||!critical.verified) return {verified:false,
    reason:normal.reason||critical.reason};
  const pHit=accuracy.hitProbability;
  const pCritical=crit.probability;
  const outcomes=new Map([[0,1-pHit]]);
  for (const [dist,weight] of [[normal,1-pCritical],[critical,pCritical]]) {
    for (const {damage,ways} of dist.outcomes) {
      const delta=pHit*weight*ways/39;
      outcomes.set(damage,(outcomes.get(damage)||0)+delta);
    }
  }
  const probabilities=[...outcomes.entries()].map(([damage,probability])=>({damage,probability}))
    .filter(x=>x.probability>0).sort((a,b)=>a.damage-b.damage);
  const total=probabilities.reduce((s,x)=>s+x.probability,0);
  const pKO=probabilities.filter(x=>x.damage>=targetHpFromRam).reduce((s,x)=>s+x.probability,0);
  const expectedDamage=probabilities.reduce((s,x)=>s+x.damage*x.probability,0);
  return {verified:true,romSha256:evidence.romSha256.toLowerCase(),
    accuracyOutOf256:accuracy.hitOutOf256,criticalOutOf256:crit.criticalOutOf256,
    hitProbability:pHit,criticalProbabilityGivenHit:pCritical,
    minDamageIfHit:Math.min(normal.minDamage,critical.minDamage),
    maxDamageIfHit:Math.max(normal.maxDamage,critical.maxDamage),
    nonCriticalDamage:{min:normal.minDamage,max:normal.maxDamage},
    criticalDamage:{min:critical.minDamage,max:critical.maxDamage},
    targetHp:targetHpFromRam,knockoutProbability:pKO,expectedDamage,
    distribution:probabilities,distributionSum:total,
    scope:'Um turno, um único golpe de dano neutro sem STAB, efeitos especiais, imunidade, status impeditivo, multi-hit ou RNG pré-observada; probabilidade teórica agregada',
    sources:['pret/pokered engine/battle/core.asm MoveHitTest','CriticalHitTest','CalculateDamage','RandomizeDamage']};
}
module.exports={neutralTurnForecast};
