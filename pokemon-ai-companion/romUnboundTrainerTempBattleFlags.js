'use strict';
// Precise local LR35902 evidence for temporary battle-control bits at wd72d.
// The ROM-exact pattern is NOT a persistent world-event flag or an observed action.
const crypto=require('node:crypto');
const {decodeOpcode}=require('./romMapCodeAtlas');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const SIZE=1048576,BANK=0x4000,ADDRESS=0xd72d;
function fail(reason){return {verified:false,reason,mutations:[],
 worldEventBitsRecovered:0,executed:false};}
function auditTemporaryBattleBitSequence({rom,fileOffset}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==SIZE||
    !Number.isInteger(fileOffset)||fileOffset<0||fileOffset>=SIZE||
    rom[fileOffset]!==0x08)return fail('TX_ASM origin absent');
 const bank=Math.floor(fileOffset/BANK),end=(bank+1)*BANK;
 const start=fileOffset+7;
 if(start+7>end)return fail('Sequence crosses ROM bank');
 const opcodes=[0x21,0x2d,0xd7,0xcb,0xf6,0xcb,0xfe];
 if(opcodes.some((byte,i)=>rom[start+i]!==byte))
  return fail('Expected direct HL and adjacent SET bit opcodes absent');
 const cpu=offset=>bank===0?offset:0x4000+offset-bank*BANK;
 const h=decodeOpcode(rom,bank,cpu(start));
 const set6=decodeOpcode(rom,bank,cpu(start+3));
 const set7=decodeOpcode(rom,bank,cpu(start+5));
 if(!h.ok||h.at!==start||h.opcode!==0x21||h.size!==3||
    !set6.ok||set6.at!==start+3||set6.opcode!==0xcb||set6.size!==2||
    !set7.ok||set7.at!==start+5||set7.opcode!==0xcb||set7.size!==2||
    rom.readUInt16LE(start+1)!==ADDRESS)
  return fail('Decoder and physical sequence do not agree');
 const mutations=[{bit:6,operation:'SET_BIT_HL',
    cpu:cpu(start+3),physicalOffset:start+3,opcodeBytesHex:'cbf6'},
   {bit:7,operation:'SET_BIT_HL',
    cpu:cpu(start+5),physicalOffset:start+5,opcodeBytesHex:'cbfe'}]
  .map(x=>({...x,address:ADDRESS,
   operandClass:'TEMPORARY_BATTLE_CONTROL_WRAM_NOT_WORLD_EVENT_BITMAP',
   opcodeCandidate:true,instructionExecuted:false,
   actualMemoryMutationVerified:false}));
 return {verified:true,bank,txAsmFileOffset:fileOffset,
  loadHlFileOffset:start,loadHlCpu:cpu(start),
  loadHlImmediateAddress:ADDRESS,
  physicallyAdjacentOpcodesHex:'212dd7cbf6cbfe',
  mutations,mutationCandidates:2,
  transientBattleControlCandidate:true,
  directWorldEventBitmapMutation:false,
  worldEventBitsRecovered:0,
  actualMemoryMutationVerified:false,
  executed:false,
  warning:'wd72d is a temporary control variable, not the persistent wGameProgressFlags event bitmap. Bytecode is static; effects are not observed.'};
}
function auditUnboundTrainerTempBattleFlags({rom,handlerContext}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==SIZE||
    handlerContext?.verified!==true||
    !Array.isArray(handlerContext.handlers)||
    handlerContext.handlers.length!==2||
    handlerContext.handlerCount!==2||
    handlerContext.eventBitsRecovered!==0||
    handlerContext.handlerEffectsVerified!==false)return fail('Verified physical handlers required');
 const sha=crypto.createHash('sha256').update(rom).digest('hex');
 if(!isKnownAuditedRomSha(sha)||handlerContext.romSha256!==sha)
  return fail('ROM and physical handler SHA mismatch');
 const expected=[[96,2,0x0614e6],[135,11,0x048e9d]];
 const handlers=[];
 for(let i=0;i<2;i++){
  const item=handlerContext.handlers[i];
  const [mapId,ordinal,fileOffset]=expected[i];
  if(item.mapId!==mapId||item.ordinal!==ordinal||
     item.txAsmFileOffset!==fileOffset||
     item.handlerRuntimeExecuted!==false||
     item.handlerEffectsVerified!==false||
     item.eventFlagBitIndex!==null||
     item.trainerVictoryObserved!==null)
   return fail('Handler provenance is not exact or improperly claims gameplay');
  const p=auditTemporaryBattleBitSequence({rom,fileOffset});
  if(!p.verified||p.bank!==item.bank||p.mutations.length!==2||
     p.mutations.some(x=>x.instructionExecuted))
   return fail('Temporary battle flags not physically proved at map '+mapId);
  handlers.push({mapId,ordinal,referenceMapName:item.referenceMapName,
   scriptFileOffset:fileOffset,bank:item.bank,
   ...p,handlerRuntimeExecuted:false,
   trainerVictoryObserved:null,eventBitIndex:null});
 }
 return {verified:true,romSha256:sha,
  source:'PHYSICAL_STATIC_D72D_SET6_SET7_BATTLE_HANDLER_V1',
  handlers,handlerCount:2,
  transientSetBitCandidates:4,
  temporaryWramAddress:ADDRESS,
  temporaryWramBits:[6,7],
  worldEventBitsRecovered:0,
  directWorldEventBitmapMutation:false,
  actualMemoryMutationVerified:false,
  executed:false,
  trainerVictoriesObserved:0,
  note:'Static SET 6 and SET 7 at wd72d is not a trainer completion flag or a played battle.'};
}
module.exports={auditTemporaryBattleBitSequence,auditUnboundTrainerTempBattleFlags};
