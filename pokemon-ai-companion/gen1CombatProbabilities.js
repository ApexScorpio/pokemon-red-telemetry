'use strict';

// Mecânicas Gen I validadas por pret/pokered engine/battle/core.asm:
// CriticalHitTest, CalculateDamage e RandomizeDamage.
// Cálculos deliberadamente limitados aos ramos cujas condições foram verificadas.

function numberIn(n, low, high, field) {
  if (!Number.isInteger(n) || n < low || n > high) throw new RangeError(`${field}: valor inválido`);
  return n;
}

function guard(evidence, scope) {
  if (!evidence || evidence.exactRomSha256Verified !== true ||
      evidence.liveRamSnapshotVerified !== true || evidence[scope] !== true ||
      typeof evidence.romSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(evidence.romSha256)) {
    return {verified:false,reason:`Identidade ROM, RAM contemporânea ou aplicabilidade ${scope} não comprovadas`};
  }
  return null;
}

function criticalChance({baseSpeedFromRom, powerByteFromRom, highCriticalFromRom,
                         focusEnergyActiveFromRam, evidence} = {}) {
  const refusal = guard(evidence, 'criticalHitTestAppliesVerified');
  if (refusal) return refusal;
  const baseSpeed=numberIn(baseSpeedFromRom,1,255,'velocidade base ROM');
  const power=numberIn(powerByteFromRom,0,255,'potência do golpe ROM');
  if (typeof highCriticalFromRom!=='boolean' || typeof focusEnergyActiveFromRam!=='boolean') {
    return {verified:false,reason:'Tabela ROM de golpes críticos ou Focus Energy RAM não comprovados'};
  }
  let t = Math.floor(baseSpeed/2);
  if (power===0) t=0;
  else {
    if (focusEnergyActiveFromRam) t=Math.floor(t/2);
    else t=Math.min(255,t*2);
    if (highCriticalFromRom) {
      t=Math.min(255,t*2);
      t=Math.min(255,t*2);
    } else t=Math.floor(t/2);
  }
  return {verified:true,romSha256:evidence.romSha256.toLowerCase(),
    criticalOutOf256:t, probability:t/256, percent:t*100/256,
    scope:'CriticalHitTest padrão, condicionada à execução do golpe; não inclui outros bloqueios ou previsão RNG',
    source:'pret/pokered engine/battle/core.asm CriticalHitTest'};
}

function neutralDamageDistribution({effectiveLevelByte, movePowerByte,
                                    scaledAttackByte,scaledDefenseByte,evidence}={}) {
  const refusal=guard(evidence,'neutralDamagePathVerified');
  if (refusal) return refusal;
  const level=numberIn(effectiveLevelByte,1,255,'nível efetivo (já com crítico, se for o caso)');
  const power=numberIn(movePowerByte,1,255,'potência byte');
  const attack=numberIn(scaledAttackByte,1,255,'ataque pós-escala');
  const defense=numberIn(scaledDefenseByte,1,255,'defesa pós-escala');
  // Gen I trunca as divisões sequenciais e limita o dano neutro pré-aleatório a 999.
  const term=Math.floor(level*2/5)+2;
  const neutralPreRoll=Math.min(999,Math.floor(Math.floor(term*power*attack/defense)/50)+2);
  const frequency=new Map();
  for (let r=217;r<=255;r++) {
    const damage=neutralPreRoll<=1?neutralPreRoll:Math.floor(neutralPreRoll*r/255);
    frequency.set(damage,(frequency.get(damage)||0)+1);
  }
  const outcomes=[...frequency.entries()].sort((a,b)=>a[0]-b[0]).map(([damage,ways])=>({
    damage,ways,outOf:39,probability:ways/39
  }));
  return {verified:true,romSha256:evidence.romSha256.toLowerCase(),
    preRandomDamage:neutralPreRoll,minDamage:outcomes[0].damage,maxDamage:outcomes.at(-1).damage,
    possibleRolls:39,outcomes,
    scope:'Um acerto normal com dano base neutro, SEM STAB, SEM efeitos de tipo, SEM movimentos especiais; parâmetros b/c/e já escalados e verificados',
    source:'pret/pokered engine/battle/core.asm CalculateDamage / RandomizeDamage'};
}

function neutralKnockoutOdds({distribution, targetHpFromRam}={}) {
  if (!distribution || distribution.verified!==true || !Array.isArray(distribution.outcomes)) {
    return {verified:false,reason:'Distribuição de dano não validada'};
  }
  const hp=numberIn(targetHpFromRam,1,65535,'HP alvo RAM');
  const ways=distribution.outcomes.filter(x=>x.damage>=hp).reduce((s,x)=>s+x.ways,0);
  return {verified:true,probability:ways/39,ways,outOf:39,
    condition:'Probabilidade CONDICIONAL a este golpe acertar e percorrer o ramo de dano neutro validado'};
}

module.exports={criticalChance,neutralDamageDistribution,neutralKnockoutOdds};
