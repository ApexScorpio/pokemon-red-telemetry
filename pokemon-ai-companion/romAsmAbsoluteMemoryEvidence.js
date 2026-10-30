'use strict';
// Static LR35902 direct-operand memory evidence, decoded from exact ROM bytes.
// A literal WRAM target in an opcode does NOT prove the instruction executes,
// that the branch is reachable or that the memory value changes in gameplay.
//
// CPU addressing: EA nn nn => LD [nn],A; FA nn nn => LD A,[nn];
// 08 nn nn => LD [nn],SP (two-byte store);
// 01/11/21/31 nn nn => 16-bit register-pair immediate, POSSIBLE pointer only.
// Reference: pret/pokered home/text.asm + Pan Docs GB CPU instruction set.
const SIZE=1048576;
function category(address){
 if(address>=0xd747&&address<=0xd886)return 'EVENT_FLAGS_D747_D886';
 if(address>=0xd6f0&&address<=0xd6fd)return 'HIDDEN_ITEMS_D6F0_D6FD';
 if(address>=0xd6fe&&address<=0xd6ff)return 'HIDDEN_COINS_D6FE_D6FF';
 if(address===0xd35e)return 'CURRENT_MAP_D35E';
 if(address>=0xc000&&address<=0xdfff)return 'OTHER_WRAM';
 if(address>=0xff00)return 'HIGH_MEMORY_OR_IO';
 if(address>=0xa000&&address<=0xbfff)return 'CARTRIDGE_RAM';
 if(address<0x8000)return 'ROM_OR_MBC_CONTROL';
 return 'OTHER_MEMORY';
}
const TYPES=Object.freeze({
 0xea:'DIRECT_STORE_A',0xfa:'DIRECT_LOAD_A',
 0x08:'DIRECT_STORE_SP_16',
 0x01:'REGISTER_BC_IMMEDIATE_POINTER_CANDIDATE',
 0x11:'REGISTER_DE_IMMEDIATE_POINTER_CANDIDATE',
 0x21:'REGISTER_HL_IMMEDIATE_POINTER_CANDIDATE',
 0x31:'REGISTER_SP_IMMEDIATE_POINTER_CANDIDATE'
});
const WRAM=a=>a>=0xc000&&a<=0xdfff;
function inspectAbsoluteOperand({rom,decoded}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==SIZE||decoded?.ok!==true||
    decoded.size!==3||!Number.isInteger(decoded.at)||
    decoded.at<0||decoded.at+3>rom.length||
    rom[decoded.at]!==decoded.opcode||
    !Object.prototype.hasOwnProperty.call(TYPES,decoded.opcode))
  return null;
 const address=rom.readUInt16LE(decoded.at+1);
 const opcode=decoded.opcode,kind=TYPES[opcode];
 const direct=opcode===0xea||opcode===0xfa||opcode===0x08;
 const bytesWritten=opcode===0x08?2:opcode===0xea?1:0;
 const targets=bytesWritten===2?[address,(address+1)&0xffff]:[address];
 return {sourceFileOffset:decoded.at,cpu:decoded.pc,bank:decoded.bank,
  opcode,operandAddress:address,kind,classification:category(address),
  targetClassifications:targets.map(category),
  absoluteWramOperand:WRAM(address),
  directMemoryAccess:direct,
  directWramReadCandidate:opcode===0xfa&&WRAM(address),
  directWramWriteCandidate:bytesWritten>0&&targets.some(WRAM),
  pointerConstantOnly:!direct,
  instructionExecuted:false,actualMemoryEffectVerified:false,
  conditionAndBranchVerified:false,
  provenance:'ROM_EXACT_LR35902_INSTRUCTION_OPERAND'};
}
module.exports={inspectAbsoluteOperand,category};
