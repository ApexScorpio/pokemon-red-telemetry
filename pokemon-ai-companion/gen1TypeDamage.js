'use strict';
// Camada de tipos/STAB da Gen I: aplica-se entre CalculateDamage e RandomizeDamage.
// Fonte: pret/pokered/engine/battle/core.asm AdjustDamageForMoveType.
// Exige tabela completa e ordenada extraída da ROM exata; não se aplica a OHKO,
// dano fixo, Counter, ataques especiais ou outros ramos não verificados.
const {neutralDamageDistribution}=require('./gen1CombatProbabilities');
function u8(n,field){if(!Number.isInteger(n)||n<0||n>255)throw new RangeError(`${field} inválido`);return n;}
function typedDamageDistribution({effectiveLevelByte,movePowerByte,scaledAttackByte,
  scaledDefenseByte,moveTypeIdFromRom,attackerTypesFromRam,defenderTypesFromRam,
  orderedTypeRulesFromRom,evidence}={}) {
  if(!evidence || evidence.typeChartRomVerified!==true ||
    evidence.attackerDefenderTypesRamVerified!==true ||
    evidence.standardTypedDamagePathVerified!==true) {
    return {verified:false,reason:'Tabela de tipos, tipos vivos ou ramo de dano não certificados'};
  }
  const base=neutralDamageDistribution({effectiveLevelByte,movePowerByte,
    scaledAttackByte,scaledDefenseByte,evidence});
  if(!base.verified)return base;
  const type=u8(moveTypeIdFromRom,'tipo golpe ROM');
  if(!Array.isArray(attackerTypesFromRam)||attackerTypesFromRam.length!==2||
     !Array.isArray(defenderTypesFromRam)||defenderTypesFromRam.length!==2||
     !Array.isArray(orderedTypeRulesFromRom)||!orderedTypeRulesFromRom.length) {
    return {verified:false,reason:'Bytes de tipos ou tabela completa não fornecidos'};
  }
  const attackers=attackerTypesFromRam.map((x)=>u8(x,'tipo atacante RAM'));
  const defenders=defenderTypesFromRam.map((x)=>u8(x,'tipo defensor RAM'));
  const rules=orderedTypeRulesFromRom.map((rule)=>{
    if(!rule||typeof rule!=='object')throw new RangeError('Entrada de tabela de tipos ausente');
    const a=u8(rule.attackType,'ataque da tabela ROM');
    const d=u8(rule.defenderType,'defesa da tabela ROM');
    if(![0,5,10,20].includes(rule.multiplier))throw new RangeError('Multiplicador ROM inválido');
    return {attackType:a,defenderType:d,multiplier:rule.multiplier};
  });
  const stab=attackers.includes(type);
  let damage=base.preRandomDamage;
  if(stab)damage+=Math.floor(damage/2);
  const applied=[];
  for(const r of rules){
    if(r.attackType!==type || !defenders.includes(r.defenderType))continue;
    damage=Math.floor(damage*r.multiplier/10);
    applied.push({...r,damageAfter:damage});
  }
  // Zero pode corresponder a imunidade OU ao arredondamento de 0,25x na Gen I.
  const missedFromZeroDamage=damage===0;
  const ways=new Map();
  for(let random=217;random<=255;random++){
    const d=damage<=1?damage:Math.floor(damage*random/255);
    ways.set(d,(ways.get(d)||0)+1);
  }
  const distribution=[...ways.entries()].sort((a,b)=>a[0]-b[0])
    .map(([value,count])=>({damage:value,ways:count,outOf:39,probability:count/39}));
  return {verified:true,romSha256:evidence.romSha256.toLowerCase(),
    stab,appliedTypeRules:applied,missedFromZeroDamage,
    damageBeforeRandom:damage,minDamage:distribution[0].damage,
    maxDamage:distribution.at(-1).damage,distribution,
    scope:'Dano de um só golpe, ramo padrão, tabela de tipos completa extraída da mesma ROM; exclui efeitos especiais, OHKO, fixos, confusão',
    source:'pret/pokered engine/battle/core.asm AdjustDamageForMoveType + RandomizeDamage'};
}
module.exports={typedDamageDistribution};
