'use strict';
// Turno Gen I em direto: resultados SEMPRE condicionais, sem prometer o RNG.
// Os bytes de golpes/tipos vêm do perfil local SHA; a RAM é amostrada duas vezes.
// RetroArch fornece CRC32 do conteúdo em execução; isso não prova SHA runtime.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const PHYSICAL_TYPES=new Set([0,1,2,3,4,5,7,8]);
const SPECIAL_TYPES=new Set([20,21,22,23,24,25,26]);
const ROM_TYPE_IDS=new Set([...PHYSICAL_TYPES,...SPECIAL_TYPES]);
// Apenas efeitos cujo PRIMEIRO acerto segue o percurso de dano padrão.
// Não modela flinch, poison, burn, freeze, drain, recoil nem alterações de stats.
const DIRECT_HIT_EFFECTS=new Set([
  0,2,3,4,5,6,16,31,33,34,36,37,48,68,69,70,71,76
]);
function accuracyConditional(accuracy,attacker,defender,ratios) {
  if(!Number.isInteger(accuracy)||accuracy<0||accuracy>255||
     !Number.isInteger(attacker)||attacker<1||attacker>13||
     !Number.isInteger(defender)||defender<1||defender>13||
     !Array.isArray(ratios)||ratios.length!==13)return null;
  let threshold=accuracy;
  for(const stage of [attacker,14-defender]) {
    const r=ratios[stage-1];
    if(!r||!Number.isInteger(r.numerator)||r.numerator<1||
       !Number.isInteger(r.denominator)||r.denominator<1)return null;
    threshold=Math.max(1,Math.floor(threshold*r.numerator/r.denominator));
  }
  return {hitOutOf256:Math.min(255,threshold),
    percent:Math.min(255,threshold)*100/256};
}
// Só a rotina normal da Poké Ball (não Master Ball, não Safari validado).
function captureConditional({ball,actualCatchRateFromRam,hpFromRam,maxHpFromRam,
  statusFromRam}={}) {
  const caps={POKE_BALL:255,GREAT_BALL:200,ULTRA_BALL:150};
  const factors={POKE_BALL:12,GREAT_BALL:8,ULTRA_BALL:12};
  const bonuses={NONE:0,BRN:12,PAR:12,PSN:12,FRZ:25,SLP:25};
  if(!Object.hasOwn(caps,ball)||!Object.hasOwn(bonuses,statusFromRam)||
      !Number.isInteger(actualCatchRateFromRam)||actualCatchRateFromRam<0||
      actualCatchRateFromRam>255||!Number.isInteger(hpFromRam)||hpFromRam<1||
      !Number.isInteger(maxHpFromRam)||maxHpFromRam<hpFromRam||
      maxHpFromRam>999)return null;
  const w=Math.floor(Math.floor(maxHpFromRam*255/factors[ball])/
    Math.max(1,Math.floor(hpFromRam/4)));
  const x=Math.min(255,w),bonus=bonuses[statusFromRam],cap=caps[ball];
  let guaranteed=0,checked=0;
  for(let n=0;n<=cap;n++) {
    if(n<bonus)guaranteed++;
    else if(n-bonus<=actualCatchRateFromRam)checked++;
  }
  return 100*(guaranteed+checked*(w>255?1:(x+1)/256))/(cap+1);
}
function criticalConditionalWithoutFocus(baseSpeed,power,highCritical){
  if(!Number.isInteger(baseSpeed)||baseSpeed<1||baseSpeed>255||
     !Number.isInteger(power)||power<0||power>255||
     typeof highCritical!=='boolean')return null;
  let threshold=Math.floor(baseSpeed/2);
  if(power===0)threshold=0;
  else {
    threshold=Math.min(255,threshold*2);
    if(highCritical)threshold=Math.min(255,Math.min(255,threshold*2)*2);
    else threshold=Math.floor(threshold/2);
  }
  return {outOf256:threshold,percent:threshold*100/256};
}
const between=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
function typedDamageConditional({level,power,moveType,attackerTypes,defenderTypes,
  attack,defense,attackerStages,defenderStages,attackerStatus,orderedRules,
  targetHp}={}) {
  if(!between(level,1,100)||!between(power,1,255)||
     !ROM_TYPE_IDS.has(moveType)||!between(attack,1,999)||!between(defense,1,999)||
     !Array.isArray(attackerTypes)||attackerTypes.length!==2||
     !Array.isArray(defenderTypes)||defenderTypes.length!==2||
     !attackerTypes.every(t=>ROM_TYPE_IDS.has(t))||
     !defenderTypes.every(t=>ROM_TYPE_IDS.has(t))||
     !Array.isArray(orderedRules)||orderedRules.length!==82||
     !between(targetHp,1,999))return null;
  // Para não confundir stats de BattleMon com boosts, esta camada exige
  // estágios neutros. Sem prova de Reflect/Light Screen e outras flags,
  // os valores permanecem expressamente condicionais.
  const physical=PHYSICAL_TYPES.has(moveType);
  if(attackerStatus==='BRN'&&physical)return null;
  if(!Array.isArray(attackerStages)||!Array.isArray(defenderStages)||
     attackerStages[physical?0:3]!==7||defenderStages[physical?1:3]!==7)return null;
  // Geração I: se qualquer stat exceder 255, ambos são reduzidos /4.
  let a=attack,d=defense;
  const scaled=a>255||d>255;
  if(scaled){a=Math.floor(a/4);d=Math.floor(d/4);}
  if(!d||!a)return null;
  let before=Math.min(999,Math.floor(Math.floor(
    (Math.floor(level*2/5)+2)*power*a/d)/50)+2);
  const stab=attackerTypes.includes(moveType);
  if(stab)before+=Math.floor(before/2);
  const applied=[];
  for(const rule of orderedRules){
    if(!between(rule?.attackType,0,255)||!between(rule?.defenderType,0,255)||
       ![0,5,20].includes(rule.multiplier))return null;
    if(rule.attackType!==moveType||!defenderTypes.includes(rule.defenderType))
      continue;
    before=Math.floor(before*rule.multiplier/10);
    applied.push({defenderType:rule.defenderType,multiplier:rule.multiplier});
  }
  let min=Infinity,max=-Infinity,waysKO=0,sum=0;
  const outcomes=[];
  for(let roll=217;roll<=255;roll++){
    const value=before<=1?before:Math.floor(before*roll/255);
    min=Math.min(min,value);max=Math.max(max,value);sum+=value;
    if(value>=targetHp)waysKO++;
    outcomes.push(value);
  }
  return {verified:false,conditional:true,stab,typeMultipliers:applied,
    physical,scaledStats:scaled,
    minDamage:min,maxDamage:max,expectedDamageGivenNormalHit:sum/39,
    knockoutGivenNormalHitPercent:waysKO*100/39,
    normalRolls:39,damageSamples:outcomes,
    assumptions:'Golpe de efeito 0; sem crítico, Reflect, Light Screen, alteração de stats além do BattleMon, efeitos secundários ou bloqueios'};
}
function buildLiveBattlePreview({romProfile,battleEvidence,battleWindow,battleType}={}) {
  const unavailable=reason=>({verified:false,conditional:false,
    reason,moves:[],enemyThreats:[],captureOdds:null});
  if(!isKnownAuditedRomSha(romProfile?.hash?.sha256)||
     !Array.isArray(romProfile?.moveStats)||romProfile.moveStats.length!==165)
    return unavailable('Identidade e tabela dos 165 golpes da ROM local indisponíveis');
  if(battleEvidence?.verified!==true||battleWindow?.verified!==true||
     battleEvidence.consistentWindowVerified!==true)
    return unavailable('RAM de combate não coerente em duas leituras');
  const ids=battleEvidence.player?.moves,pps=battleEvidence.player?.pp;
  if(!Array.isArray(ids)||ids.length!==4||!Array.isArray(pps)||pps.length!==4)
    return unavailable('Golpes ou PP atuais não comprovados');
  const ratios=romProfile.battleRuleTables?.verified===true?
    romProfile.battleRuleTables.statModifierRatiosFromRom:null;
  const rules=romProfile.typeMatchupsStatus?.verified===true?
    romProfile.typeMatchups:null;
  const highCritical=romProfile.battleRuleTables?.verified===true?
    romProfile.battleRuleTables.highCriticalMoveIdsFromRom:null;
  const makeMove=(id,slot,pp,attacker,defender,attackerStages,defenderStages)=>{
    if(!between(id,1,165))return null;
    const info=romProfile.moveStats[id-1];
    if(info?.id!==id)return null;
    const standardHit=id!==165&&DIRECT_HIT_EFFECTS.has(info.effectByte)&&info.powerByte>0; // Struggle ignora a tabela normal de tipos
    const hit=standardHit?accuracyConditional(info.accuracyByte,
      attackerStages?.[4],defenderStages?.[5],ratios):null;
    const atkType=info.typeByte;
    const atkStats=PHYSICAL_TYPES.has(atkType)?attacker.attack:attacker.special;
    const defStats=PHYSICAL_TYPES.has(atkType)?defender.defense:defender.special;
    const damage=standardHit&&rules?typedDamageConditional({
      level:attacker.level,power:info.powerByte,moveType:atkType,
      attackerTypes:attacker.typeIds,defenderTypes:defender.typeIds,
      attack:atkStats,defense:defStats,attackerStages,defenderStages,
      attackerStatus:attacker.status,orderedRules:rules,targetHp:defender.hp
    }):null;
    const effectRecord=romProfile.moveEffectDispatch?.verified===true?
      romProfile.moveEffectDispatch.moves?.[id-1]:null;
    const effectHandler=effectRecord?.moveId===id?
      effectRecord.handler:null;
    const baseSpeed=romProfile.species?.[attacker.speciesId-1]?.stats?.speed;
    const crit=standardHit&&Array.isArray(highCritical)?
      criticalConditionalWithoutFocus(baseSpeed,info.powerByte,
        highCritical.includes(id)):null;
    return {id,slot:slot+1,
      name:romProfile.moveNames?.[id-1]||'Golpe #'+id,
      pp:between(pp,0,255)?pp&63:null,
      powerByte:info.powerByte,typeByte:atkType,
      accuracyByte:info.accuracyByte,effectByte:info.effectByte,
      secondaryEffectNotModelled:info.effectByte!==0,
      effectHandler,effectOutcomeCertified:false,
      hitOutOf256:hit?.hitOutOf256??null,
      hitPercent:hit?.percent??null,
      criticalPercentWithoutFocus:crit?.percent??null,
      damage:damage?{
        min:damage.minDamage,max:damage.maxDamage,
        expectedNormalHit:damage.expectedDamageGivenNormalHit,
        koGivenNormalHitPercent:damage.knockoutGivenNormalHitPercent,
        koIncludingMissesPercent:hit?
          damage.knockoutGivenNormalHitPercent*hit.percent/100:null,
        stab:damage.stab,typeMultipliers:damage.typeMultipliers,
        scaledStats:damage.scaledStats
      }:null,
      hitCondition:hit?'Se executar MoveHitTest normal':'Ramo/efeito especial',
      damageCondition:damage?
        damage.assumptions+(info.effectByte?
          '; efeitos secundários NÃO modelados; válida só a componente de dano de um acerto':''):
        'Efeito ou estado não permitido para este cálculo'};
  };
  const moves=ids.map((id,i)=>makeMove(id,i,pps[i],battleEvidence.player,
    battleEvidence.enemy,battleEvidence.stages?.player,
    battleEvidence.stages?.enemy)).filter(Boolean);
  const enemyThreats=(battleEvidence.enemy?.moves||[]).map((id,i)=>
    makeMove(id,i,battleEvidence.enemy.pp?.[i],battleEvidence.enemy,
      battleEvidence.player,battleEvidence.stages?.enemy,
      battleEvidence.stages?.player)).filter(Boolean);
  const candidates=moves.filter(m=>m.pp>0&&m.damage&&
    Number.isFinite(m.hitPercent)&&!m.secondaryEffectNotModelled);
  const best=candidates.slice().sort((a,b)=>{
    const av=a.damage.expectedNormalHit*a.hitPercent/100;
    const bv=b.damage.expectedNormalHit*b.hitPercent/100;
    return bv-av||a.slot-b.slot;
  })[0]||null;
  const conditionalBestMove=best?{
    id:best.id,name:best.name,scope:'Apenas entre golpes calculáveis, assumindo não-crítico e o ramo padrão',
    expectedNormalDamageWithMisses:best.damage.expectedNormalHit*best.hitPercent/100
  }:null;
  let captureOdds=null;
  if(battleType==='Wild'&&battleEvidence.battleType==='Wild'&&
     battleEvidence.actualCatchRateVerified===true&&
     romProfile.battleCaptureLayout?.verified===true&&
     battleEvidence.enemy?.hp>0&&battleEvidence.captureInputs) {
    const values=['POKE_BALL','GREAT_BALL','ULTRA_BALL']
      .map(ball=>captureConditional({...battleEvidence.captureInputs,ball}));
    if(values.every(Number.isFinite))captureOdds={
      pokeball:values[0],greatball:values[1],ultraball:values[2]};
  }
  return {verified:false,conditional:true,
    status:'CONDITIONAL_FROM_CRC_MATCH_AND_CORROBORATED_RAM',
    romSha256:romProfile.hash.sha256.toLowerCase(),
    runtimeSha256Verified:false,atomicSnapshotVerified:false,
    reason:'Resultados condicionais: CRC32 da ROM do RetroArch corresponde à ROM local; leituras RAM repetidas coincidiram. A identidade SHA de execução, flags Reflect/Light Screen, efeitos, Focus Energy, RNG e atomicidade não estão comprovados.',
    captureCondition:'Só se o lançamento for legal e executar PokeBallEffect normal: não certifica Safari, inventário, turnos bloqueados ou RNG.',
    assumptions:'Dano de UM ACERTO: ramo normal, sem crítico, sem Reflect/Light Screen, sem alterações de estado especiais. Nos golpes com efeitos secundários, estes não estão incluídos. KO condicional não inclui críticos.',
    moves,enemyThreats,conditionalBestMove,captureOdds};
}
module.exports={buildLiveBattlePreview,accuracyConditional,captureConditional,
  criticalConditionalWithoutFocus,typedDamageConditional};
