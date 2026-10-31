'use strict';
// Pure LR35902 CB opcode consequences, conditional on exact instruction execution.
// Source: https://gbdev.io/pandocs/CPU_Instruction_Set.html
// Bit semantics do not prove that a ROM candidate runs, that the event exists
// in the current save, or that any subsequent scripted reward occurs.
const validByte=n=>Number.isInteger(n)&&n>=0&&n<=255;
function inferBitOpcodeSemantics({operation,bitNumber,register,
 operandAddress,bitIndex,cbOpcode}={}){
 if(!['BIT_TEST','SET_BIT','RESET_BIT'].includes(operation)||
    !Number.isInteger(bitNumber)||bitNumber<0||bitNumber>7||
    !Number.isInteger(bitIndex)||bitIndex<0||bitIndex>=2560||
    bitIndex%8!==bitNumber||
    !Number.isInteger(operandAddress)||
    operandAddress<0xc000||operandAddress>0xdfff||
    !validByte(cbOpcode)||!['A','HL_INDIRECT'].includes(register))
  return {verified:false,reason:'Invalid bit opcode evidence'};
 const reg=register==='A'?7:6;
 if(operation!=='BIT_TEST'&&reg!==6)
  return {verified:false,reason:'SET/RES memory instruction requires (HL)'};
 const family=operation==='BIT_TEST'?0x40:
  operation==='RESET_BIT'?0x80:0xc0;
 const expected=family+bitNumber*8+reg;
 if(cbOpcode!==expected)return {verified:false,reason:'CB opcode mismatch'};
 const mask=1<<bitNumber;
 const effect=operation==='SET_BIT'?'SET_BIT_TO_ONE':
   operation==='RESET_BIT'?'RESET_BIT_TO_ZERO':'TEST_BIT_WITHOUT_MEMORY_WRITE';
 const conditionalWrite=operation!=='BIT_TEST';
 return {
  verified:true,operation,bitIndex,bitNumber,mask,
  sourceMemoryAddress:operandAddress,
  loadedVia:register==='A'?'LD_A_FROM_ABSOLUTE_WRAM':'LD_HL_IMMEDIATE',
  lr35902CbOpcode:cbOpcode,
  effectIfInstructionExecuted:effect,
  bitValueAfterInstructionIfExecuted:operation==='SET_BIT'?1:
   operation==='RESET_BIT'?0:null,
  bitValueBeforeInstruction:null,
  memoryBitWriteIfExecuted:conditionalWrite,
  modifiesMemoryIfExecuted:conditionalWrite,
  cpuZeroFlagMeaningIfExecuted:operation==='BIT_TEST'?
   'Z_IS_ONE_WHEN_TESTED_BIT_IS_ZERO':null,
  cpuHFlagIfExecuted:operation==='BIT_TEST'?1:null,
  cpuNFlagIfExecuted:operation==='BIT_TEST'?0:null,
  otherFlagsPreservedIfExecuted:operation==='BIT_TEST'?
   'C_ONLY':'ALL_CPU_FLAGS',
  noMemoryBitWriteIfTested:operation==='BIT_TEST',
  instructionBytesSemanticallyInterpreted:true,
  instructionActuallyExecuted:false,
  saveBitValueObserved:null,
  playerHasCompletedEvent:null,
  scriptRewardVerified:false,
  worldEffectVerified:false,
  source:'SHARP_LR35902_CB_INSTRUCTION_SEMANTICS_CONDITIONAL',
  reference:'gbdev.io/pandocs/CPU_Instruction_Set.html'
 };
}
module.exports={inferBitOpcodeSemantics};
