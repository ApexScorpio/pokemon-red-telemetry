'use strict';
// Full MoveEffectPointerTable dispatch (86 possible effect IDs) and all 165
// move-to-effect bindings from the exact 3 local 1 MiB ROMs.
// Note: NULL handlers may denote effects implemented elsewhere in core.asm.
// These are CODE REFERENCES, NOT proof of full battle outcome semantics.
const crypto=require('node:crypto');
const {findGen1MoveTable}=require('./romMoveTable');
const SHA=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']);
const OFFSET=0x3f150,COUNT=86,BANK=0x4000;
const HANDLERS=Object.freeze({
 0x0000:'NULL',0x71fc:'SleepEffect',0x724f:'PoisonEffect',0x72e9:'DrainHPEffect',
 0x72f1:'ExplodeEffect',0x730c:'FreezeBurnParalyzeEffect',0x7428:'StatModifierUpEffect',
 0x754c:'StatModifierDownEffect',0x76e5:'BideEffect',0x7717:'ThrashPetalDanceEffect',
 0x7739:'SwitchAndTeleportEffect',0x7811:'TwoToFiveAttacksEffect',0x785b:'FlinchSideEffect',
 0x7884:'OneHitKOEffect',0x788c:'ChargeEffect',0x7917:'TrappingEffect',
 0x7941:'MistEffect',0x7949:'FocusEnergyEffect',0x7951:'RecoilEffect',
 0x7959:'ConfusionSideEffect',0x7961:'ConfusionEffect',0x79b1:'ParalyzeEffect',
 0x79b9:'SubstituteEffect',0x79c1:'HyperBeamEffect',0x79df:'RageEffect',
 0x79ed:'MimicEffect',0x7a7c:'LeechSeedEffect',0x7a84:'SplashEffect',
 0x7a8a:'DisableEffect',0x7b0e:'PayDayEffect',0x7b16:'ConversionEffect',
 0x7b1e:'HazeEffect',0x7b26:'HealEffect',0x7b2e:'TransformEffect',
 0x7b36:'ReflectLightScreenEffect'
});
const location=p=>({bank:Math.floor(p/BANK),fileOffset:p,
 cpuAddress:p<BANK?p:0x4000+p%BANK});
function auditMoveEffectDispatch(rom,moveRows){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576)
  return {verified:false,reason:'ROM not exactly 1 MiB'};
 const sha256=crypto.createHash('sha256').update(rom).digest('hex');
 if(!SHA.has(sha256))return {verified:false,reason:'ROM SHA-256 not audited',sha256};
 const moves=moveRows||findGen1MoveTable(rom).rows;
 if(!Array.isArray(moves)||moves.length!==165||
    moves.some((m,i)=>m.id!==i+1||!Number.isInteger(m.effectByte)||m.effectByte<0||m.effectByte>COUNT))
  return {verified:false,reason:'Invalid 165-move metadata'};
 const table=[];
 for(let i=0;i<COUNT;i++){
  const cpu=rom.readUInt16LE(OFFSET+i*2),name=HANDLERS[cpu];
  if(!name)return {verified:false,reason:'Unknown bank15 MoveEffectPointerTable entry',effectId:i+1,pointer:cpu};
  table.push({effectId:i+1,handler:name,pointerCpu:cpu,
   location:cpu?location(0xf*BANK+cpu-0x4000):null,
   nullableCoreHandlingMayExist:cpu===0,allBranchesVerified:false});
 }
 if(new Set(table.map(x=>x.pointerCpu)).size!==35||table.filter(x=>x.pointerCpu===0).length!==7||
    table[0].handler!=='SleepEffect'||table[COUNT-1].handler!=='DisableEffect')
  return {verified:false,reason:'Effect table source invariants failed'};
 const assignments=moves.map(m=>({moveId:m.id,effectId:m.effectByte,
  powerByte:m.powerByte,accuracyByte:m.accuracyByte,typeByte:m.typeByte,
  handler:m.effectByte===0?'NO_ADDITIONAL_EFFECT':table[m.effectByte-1].handler,
  pointerCpu:m.effectByte===0?null:table[m.effectByte-1].pointerCpu,
  handlerDispatchedInThisTable:m.effectByte>0&&table[m.effectByte-1].pointerCpu!==0,
  corePathMayApply:m.effectByte===0||table[m.effectByte-1].pointerCpu===0,
  effectOutcomeCertified:false}));
 return {verified:true,sha256,source:'ROM: Moves (165x6) and MoveEffectPointerTable (86x2), pret/pokered data/moves/effects_pointers.asm',
  effectTableLocation:location(OFFSET),effectSlots:COUNT,distinctHandlerTargets:35,
  nullHandlerSlots:7,moveCount:assignments.length,
  movesWithPointerHandler:assignments.filter(x=>x.handlerDispatchedInThisTable).length,
  movesWithCoreOrNoAdditionalEffect:assignments.filter(x=>x.corePathMayApply).length,
  allEffectsSemanticallyCertified:false,handlers:table,moves:assignments};
}
module.exports={auditMoveEffectDispatch,HANDLERS};