'use strict';
// Interpretação conservadora dos blocos de combate enviados pelo RetroArch.
// Valida integralidade, bytes e coerência; isto NÃO prova atomicidade temporal
// entre pedidos UDP. Não interpreta taxa de captura num offset não certificado.

function blockOk(bytes, expected) {
  return Array.isArray(bytes) && bytes.length === expected &&
    bytes.every(byte=>typeof byte==='string' && /^[0-9a-f]{2}$/i.test(byte));
}
const byte=(b,i)=>parseInt(b[i],16);
const word=(b,i)=>(byte(b,i)<<8)|byte(b,i+1);
const integer=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;

function parseRomBattleEvidence({
  combatBlock,playerBlock,modifierBlock,battleFlag,romMatched=false,mapSnapshotVerified=false
}={}) {
  if(!integer(battleFlag,1,2))return {verified:false,reason:'Flag de batalha não comprovada ou combate inexistente'};
  if(!blockOk(combatBlock,255)||!blockOk(playerBlock,30)||!blockOk(modifierBlock,280))
    return {verified:false,reason:'Blocos RAM incompletos, incorretos ou sem bytes comprovados'};
  const enemy={
    speciesId:byte(combatBlock,5),hp:word(combatBlock,6),
    level:byte(combatBlock,19),maxHp:word(combatBlock,20),
    attack:word(combatBlock,22),defense:word(combatBlock,24),
    speed:word(combatBlock,26),special:word(combatBlock,28),
    moves:[13,14,15,16].map(i=>byte(combatBlock,i)),
    pp:[30,31,32,33].map(i=>byte(combatBlock,i))
  };
  const player={
    speciesId:byte(playerBlock,0),hp:word(playerBlock,1),
    level:byte(playerBlock,14),maxHp:word(playerBlock,15),
    attack:word(playerBlock,17),defense:word(playerBlock,19),
    speed:word(playerBlock,21),special:word(playerBlock,23),
    moves:[8,9,10,11].map(i=>byte(playerBlock,i)),
    pp:[25,26,27,28].map(i=>byte(playerBlock,i))
  };
  const stages={
    enemy:[270,271,272,273,274,275].map(i=>byte(modifierBlock,i)),
    player:[250,251,252,253,254,255].map(i=>byte(modifierBlock,i))
  };
  const validMon = mon=>integer(mon.speciesId,1,190)&&
    integer(mon.level,1,100)&&integer(mon.maxHp,1,999)&&
    integer(mon.hp,0,mon.maxHp)&&
    ['attack','defense','speed','special'].every(key=>integer(mon[key],1,999))&&
    mon.moves.every(move=>integer(move,0,165))&&
    mon.pp.every(pp=>integer(pp,0,255));
  if(!validMon(enemy)||!validMon(player)||
    ![...stages.player,...stages.enemy].every(value=>integer(value,1,13))) {
    return {verified:false,reason:'Estruturas de combate incoerentes: espécie, HP, nível, atributos, golpes ou estágios'};
  }
  if(!mapSnapshotVerified)
    return {verified:false,reason:'Amostra do mapa não validada'};
  return {
    verified:true,
    source:'RetroArch READ_CORE_MEMORY (três blocos validados; amostragem sequencial)',
    romMatched:romMatched===true,
    atomicSnapshotVerified:false,
    exactTurnMathReady:false,
    exactTurnMathReason:'Amostras sequenciais não atómicas; falta verificar dados de golpes, RNG, efeitos e variante ROM',
    battleType:battleFlag===1?'Wild':'Trainer',
    enemy,player,stages,
    actualCatchRateVerified:false,
    actualCatchRate:null,
    warning:'A integridade dos três blocos não demonstra que todos os bytes pertençam ao mesmo turno'
  };
}

module.exports={parseRomBattleEvidence};
