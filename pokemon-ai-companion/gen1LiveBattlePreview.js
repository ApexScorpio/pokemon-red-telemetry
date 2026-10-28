'use strict';
// Preview do turno real: prova de dados locais e duas leituras RAM, mas NÃO
// prova de SHA256 da ROM no emulador, atomicidade, nem execução dos efeitos.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
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
// Fórmula do ramo normal PokeBallEffect; somente CONDICIONAL a lançamento legal.
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
function buildLiveBattlePreview({romProfile,battleEvidence,battleWindow,battleType}={}) {
  const unavailable=reason=>({verified:false,conditional:false,
    reason,moves:[],captureOdds:null});
  if(!isKnownAuditedRomSha(romProfile?.hash?.sha256)||
     !Array.isArray(romProfile?.moveStats)||romProfile.moveStats.length!==165)
    return unavailable('Identidade e tabela dos 165 golpes da ROM local indisponíveis');
  if(battleEvidence?.verified!==true||battleWindow?.verified!==true||
      battleEvidence.consistentWindowVerified!==true)
    return unavailable('RAM de combate não coerente em duas leituras');
  const ids=battleEvidence.player?.moves,pps=battleEvidence.player?.pp;
  if(!Array.isArray(ids)||ids.length!==4||!Array.isArray(pps)||pps.length!==4)
    return unavailable('Golpes ou PP do Pokémon ativo não comprovados');
  const ratios=romProfile.battleRuleTables?.verified===true?
    romProfile.battleRuleTables.statModifierRatiosFromRom:null;
  const moves=ids.map((id,slot)=>{
    if(!Number.isInteger(id)||id<1||id>165)return null;
    const info=romProfile.moveStats[id-1];
    if(info?.id!==id)return null;
    const hit=info.effectByte===0&&info.powerByte>0?
      accuracyConditional(info.accuracyByte,battleEvidence.stages?.player?.[4],
       battleEvidence.stages?.enemy?.[5],ratios):null;
    return {id,slot:slot+1,name:romProfile.moveNames?.[id-1]||'Golpe #'+id,
      pp:pps[slot]&63,powerByte:info.powerByte,
      accuracyByte:info.accuracyByte,effectByte:info.effectByte,
      hitOutOf256:hit?.hitOutOf256??null,
      hitPercent:hit?.percent??null,
      condition:hit?'Se executar MoveHitTest padrão, sem bloqueios prévios':
        'Efeito especial, status ou provas insuficientes'};
  }).filter(Boolean);
  let captureOdds=null;
  if(battleType==='Wild'&&battleEvidence.battleType==='Wild'&&
     battleEvidence.actualCatchRateVerified===true&&
     romProfile.battleCaptureLayout?.verified===true&&
     battleEvidence.enemy?.hp>0&&battleEvidence.captureInputs) {
    const inp=battleEvidence.captureInputs;
    const values=['POKE_BALL','GREAT_BALL','ULTRA_BALL']
      .map(ball=>captureConditional({...inp,ball}));
    if(values.every(Number.isFinite))captureOdds={
      pokeball:values[0],greatball:values[1],ultraball:values[2]};
  }
  return {verified:false,conditional:true,
    status:'CONDITIONAL_FROM_CRC_MATCH_AND_CORROBORATED_RAM',
    romSha256:romProfile.hash.sha256.toLowerCase(),
    runtimeSha256Verified:false,atomicSnapshotVerified:false,
    reason:'Valores condicionais à identidade CRC32 da ROM local, aos bytes RAM relidos sem diferenças e à execução da rotina indicada. Não são prova SHA256 da ROM no emulador nem previsão de RNG.',
    captureCondition:'Probabilidade apenas se a bola puder ser lançada e a rotina PokeBallEffect normal for executada; não confirma Safari, inventário ou exceções.',
    moves,captureOdds};
}
module.exports={buildLiveBattlePreview,accuracyConditional,captureConditional};
