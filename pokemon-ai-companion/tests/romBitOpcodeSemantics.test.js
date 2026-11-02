'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inferBitOpcodeSemantics}=require('../romBitOpcodeSemantics');
const types=[
 ['BIT_TEST',0x40,'TEST_BIT_WITHOUT_MEMORY_WRITE'],
 ['RESET_BIT',0x80,'RESET_BIT_TO_ZERO'],
 ['SET_BIT',0xc0,'SET_BIT_TO_ONE']
];
for(const [operation,base,effect] of types){
 for(let bit=0;bit<8;bit++){
  test('exact LR35902 '+operation+' b'+bit+' maps to deterministic conditional effect',()=>{
   const r=inferBitOpcodeSemantics({operation,bitNumber:bit,bitIndex:8*12+bit,
    register:'HL_INDIRECT',operandAddress:0xd753,
    cbOpcode:base+bit*8+6});
   assert.equal(r.verified,true,r.reason);
   assert.equal(r.lr35902CbOpcode,base+bit*8+6);
   assert.equal(r.mask,1<<bit);
   assert.equal(r.effectIfInstructionExecuted,effect);
   assert.equal(r.memoryBitWriteIfExecuted,operation!=='BIT_TEST');
   assert.equal(r.instructionActuallyExecuted,false);
   assert.equal(r.playerHasCompletedEvent,null);
   assert.equal(r.scriptRewardVerified,false);
   assert.equal(r.worldEffectVerified,false);
   if(operation==='SET_BIT')assert.equal(r.bitValueAfterInstructionIfExecuted,1);
   if(operation==='RESET_BIT')assert.equal(r.bitValueAfterInstructionIfExecuted,0);
   if(operation==='BIT_TEST'){
    assert.equal(r.bitValueAfterInstructionIfExecuted,null);
    assert.equal(r.cpuZeroFlagMeaningIfExecuted,'Z_IS_ONE_WHEN_TESTED_BIT_IS_ZERO');
    assert.equal(r.cpuHFlagIfExecuted,1);
    assert.equal(r.cpuNFlagIfExecuted,0);
    assert.equal(r.otherFlagsPreservedIfExecuted,'C_ONLY');
   }else{
    assert.equal(r.otherFlagsPreservedIfExecuted,'ALL_CPU_FLAGS');
   }
  });
 }
}
test('BIT b,A is read-only and cannot be mislabeled as direct WRAM mutation',()=>{
 const r=inferBitOpcodeSemantics({
  operation:'BIT_TEST',bitNumber:7,bitIndex:1231,
  register:'A',operandAddress:0xd7e0,cbOpcode:0x7f
 });
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.loadedVia,'LD_A_FROM_ABSOLUTE_WRAM');
 assert.equal(r.noMemoryBitWriteIfTested,true);
 assert.equal(r.memoryBitWriteIfExecuted,false);
});
test('invalid bit indices, registers and opcode substitutions fail closed',()=>{
 const base={operation:'SET_BIT',bitNumber:7,bitIndex:1231,
  register:'HL_INDIRECT',operandAddress:0xd7e0,cbOpcode:0xfe};
 for(const mutate of [
  {cbOpcode:0xff},{bitNumber:6},{bitIndex:2560},{bitIndex:-1},
  {register:'A'},{operation:'OTHER'},{operandAddress:0xe000}
 ])assert.equal(inferBitOpcodeSemantics({...base,...mutate}).verified,false);
});
