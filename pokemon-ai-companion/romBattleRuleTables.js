'use strict';
// data/pokered.sym: HighCriticalMoves=0f:608e, UnusedHighCriticalMoves=0f:601e,
// StatModifierRatios=0f:76cb. Offsets only SHA-pinned for 3 audited ROM files.
const crypto=require('node:crypto');
const AUDITED=[
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
];
const RATIOS=Buffer.from([
 25,100,28,100,33,100,40,100,50,100,66,100,1,1,
 15,10,2,1,25,10,3,1,35,10,4,1
]);
const HIGH_CRITICAL=Buffer.from([2,75,152,163,255]);
const RATIO_OFFSET=0x3f6cb,CRIT_OFFSET=0x3e08e,UNUSED_OFFSET=0x3e01e;
function readRomBattleRuleTables(rom) {
 if(!Buffer.isBuffer(rom)||rom.length!==1048576)
  return {verified:false,reason:'ROM inválida ou tamanho não auditado'};
 const sha256=crypto.createHash('sha256').update(rom).digest('hex');
 if(!AUDITED.includes(sha256))
  return {verified:false,reason:'SHA-256 não consta das três ROMs auditadas',sha256};
 if(!rom.subarray(RATIO_OFFSET,RATIO_OFFSET+RATIOS.length).equals(RATIOS)||
    !rom.subarray(CRIT_OFFSET,CRIT_OFFSET+HIGH_CRITICAL.length).equals(HIGH_CRITICAL)||
    !rom.subarray(UNUSED_OFFSET,UNUSED_OFFSET+HIGH_CRITICAL.length).equals(HIGH_CRITICAL))
  return {verified:false,reason:'Tabelas incompatíveis com o mapa de símbolos',sha256};
 return {
   verified:true,sha256,
   source:'ROM SHA-256 + pokered.sym + bytes conferidos nas três versões',
   statModifierRatiosFromRom:Array.from({length:13},(_,i)=>({
     numerator:rom[RATIO_OFFSET+i*2],denominator:rom[RATIO_OFFSET+i*2+1]
   })),
   statModifierRatiosOffset:RATIO_OFFSET,
   highCriticalMoveIdsFromRom:[...rom.subarray(CRIT_OFFSET,CRIT_OFFSET+4)],
   highCriticalMovesOffset:CRIT_OFFSET,
   unusedHighCriticalMovesOffset:UNUSED_OFFSET,
   caution:'Lista real distinta de UnusedHighCriticalMoves; sem afirmações de turno RAM'
 };
}
module.exports={readRomBattleRuleTables};