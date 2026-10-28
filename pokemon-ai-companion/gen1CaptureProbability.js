'use strict';
const {isKnownAuditedRomSha}=require('./romKnownSha256');

// Probabilidade exata do ramo normal de captura Gen I.
// Fonte primária: pret/pokered/engine/items/item_effects.asm (PokeBallEffect).
// Só válida para lançamento legal, alvo capturável e taxa ajustada real da RAM.

const BALL_CAP={POKE_BALL:255,GREAT_BALL:200,ULTRA_BALL:150,SAFARI_BALL:150};
const FACTOR={POKE_BALL:12,GREAT_BALL:8,ULTRA_BALL:12,SAFARI_BALL:12};
const STATUS={NONE:0,BRN:12,PAR:12,PSN:12,FRZ:25,SLP:25};
function num(x,a,b,field){if(!Number.isInteger(x)||x<a||x>b)throw new RangeError(`${field} inválido`);return x;}
function captureProbability({ball, actualCatchRateFromRam, hpFromRam, maxHpFromRam,
  statusFromRam, evidence}={}) {
  if (!evidence || evidence.exactRomSha256Verified!==true ||
      evidence.liveRamSnapshotVerified!==true || evidence.ordinaryBallEffectVerified!==true ||
      evidence.legalThrowVerified!==true ||
      typeof evidence.romSha256!=='string' || !isKnownAuditedRomSha(evidence.romSha256)) {
    return {verified:false,reason:'ROM/RAM ou condições de lançamento e efeito normal não confirmadas'};
  }
  if (ball === 'MASTER_BALL') return {verified:true,probability:1,percent:100,
      numerator:1,denominator:1,scope:'Lançamento legal, batalha capturável e rotina Master Ball confirmados'};
  if (!Object.hasOwn(BALL_CAP,ball)||!Object.hasOwn(STATUS,statusFromRam)) {
    return {verified:false,reason:'Tipo de bola ou estado RAM não suportado/confirmado'};
  }
  const catchRate=num(actualCatchRateFromRam,0,255,'catch rate ajustado da RAM');
  const hp=num(hpFromRam,1,999,'HP da RAM');
  const maxHp=num(maxHpFromRam,hp,999,'HP máximo da RAM');
  // Items.asm: floor(floor(MaxHP*255/Factor) / max(floor(HP/4),1)).
  const w=Math.floor(Math.floor(maxHp*255/FACTOR[ball])/Math.max(1,Math.floor(hp/4)));
  const x=Math.min(255,w);
  const statusBonus=STATUS[statusFromRam];
  const cap=BALL_CAP[ball];
  const oneRollSuccess=(w>255)?1:(x+1)/256;
  let autoWays=0,checkedWays=0;
  for(let rand1=0;rand1<=cap;rand1++) {
    if(rand1<statusBonus)autoWays++;
    else if(rand1-statusBonus<=catchRate)checkedWays++;
  }
  const probability=(autoWays+checkedWays*oneRollSuccess)/(cap+1);
  return {verified:true,romSha256:evidence.romSha256.toLowerCase(),
    ball,status:statusFromRam,rand1OutOf:cap+1,autoWays,checkedWays,
    w,x,rand2SuccessOutOf256:w>255?256:x+1,probability,percent:probability*100,
    scope:'Chance de captura CONDICIONAL a lançamento legal e rotina normal; Safari usa catch rate atual da RAM; não implica acesso ou RNG previsto',
    source:'pret/pokered engine/items/item_effects.asm PokeBallEffect'};
}
module.exports={captureProbability};
