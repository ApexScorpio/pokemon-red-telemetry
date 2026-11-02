'use strict';
// Conservative B/C/D/E/H/L lineage on one *static, linear* ROM0 path.
// No execution, active bank, control-flow completeness or event effects.
const {decodeOpcode}=require('./romMapCodeAtlas');
const TARGETS=['B','C','D','E','H','L'];
const PAIRS={B:'BC',C:'BC',D:'DE',E:'DE',H:'HL',L:'HL'};
const LOAD8={B:0x06,C:0x0e,D:0x16,E:0x1e,H:0x26,L:0x2e};
const LOAD16={BC:0x01,DE:0x11,HL:0x21};
const POP16={BC:0xc1,DE:0xd1,HL:0xe1};
const INC16={BC:0x03,DE:0x13,HL:0x23};
const DEC16={BC:0x0b,DE:0x1b,HL:0x2b};
const MBC3_TYPES=new Set([15,16,17,18,19]);
const invalid=reason=>({verified:false,reason,
 executed:false,runtimeValueKnown:false,activeBankKnown:false});
function traceMbc3RegisterInput({rom,witnessPath,sourcePc,sourceRegister,maxBacktrack=32}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    !MBC3_TYPES.has(rom[0x147])||rom[0x148]!==5||
    !TARGETS.includes(sourceRegister)||!Array.isArray(witnessPath)||
    !Number.isInteger(sourcePc)||sourcePc<0||sourcePc>=0x4000||
    witnessPath.at(-1)?.pc!==sourcePc||
    rom[sourcePc]!==0x78+TARGETS.indexOf(sourceRegister)||
    !Number.isInteger(maxBacktrack)||maxBacktrack<1||maxBacktrack>64)
  return invalid('Requires MBC3 1MiB ROM0 and verified LD A,r witness');
 const base={verified:true,source:'ROM0_MBC3_REGISTER_INPUT_LINEAR_WITNESS_V1',
  sourcePc,sourceRegister,originPc:null,originOpcode:null,
  originKind:'UNRESOLVED',conditionalByte:null,scannedInstructions:0,
  stopReason:null,executed:false,runtimeValueKnown:false,
  activeBankKnown:false,semantic100PercentCertified:false};
 const stop=(reason,n)=>({...base,scannedInstructions:n,stopReason:reason});
 const pair=PAIRS[sourceRegister],index=TARGETS.indexOf(sourceRegister);
 let count=0;
 for(let i=witnessPath.length-2;i>=0&&count<maxBacktrack;i--){
  const previous=witnessPath[i],next=witnessPath[i+1];
  if(!Number.isInteger(previous?.pc)||previous.pc<0||previous.pc>=0x4000||
     next?.via!=='fallthrough')return stop('NON_LINEAR_WITNESS',count);
  const d=decodeOpcode(rom,0,previous.pc);
  if(!d.ok||previous.pc+d.size!==next.pc)
   return stop('BAD_INSTRUCTION_BOUNDARY',count);
  count++;
  const op=d.opcode,pc=previous.pc;
  if(op===LOAD8[sourceRegister]){
   return {...base,originPc:pc,originOpcode:op,
    originKind:'LD_R_D8',conditionalByte:rom[pc+1],
    scannedInstructions:count};
  }
  if(op===LOAD16[pair]){
   const value=rom.readUInt16LE(pc+1);
   const upper=['B','D','H'].includes(sourceRegister);
   return {...base,originPc:pc,originOpcode:op,
    originKind:'LD_RR_D16',
    conditionalByte:upper?(value>>>8):(value&255),
    scannedInstructions:count};
  }
  // LD r,r' modifies the selected register unless it is a self-copy.
  if(op>=0x40&&op<=0x7f){
   const dst=(op-0x40)>>>3,src=op&7;
   if(dst===index&&src!==index)return stop('REGISTER_OVERWRITTEN',count);
   if(op===0x76)return stop('HALT_OR_CONTROL',count);
   continue;
  }
  if(op===(0x04+index*8)||op===(0x05+index*8))
   return stop('REGISTER_ARITHMETIC',count);
  if(op===POP16[pair]||op===INC16[pair]||op===DEC16[pair])
   return stop('REGISTER_PAIR_MUTATION',count);
  if(pair==='HL'&&[0x09,0x19,0x29,0x39,0x22,0x2a,0x32,0x3a,0xf8].includes(op))
   return stop('HL_SIDE_EFFECT',count);
  if(op===0xcb){
   const cb=rom[pc+1],dst=cb&7;
   if(dst===index&&(cb<0x40||cb>=0x80))
    return stop('CB_REGISTER_MUTATION',count);
  }
  if(d.kind!=='linear')return stop('CONTROL_FLOW_OR_TERMINATOR',count);
  // No other documented opcode alters B/C/D/E/H/L independently.
 }
 return stop(count>=maxBacktrack?'BUDGET_EXHAUSTED':'WITNESS_ROOT_REACHED',count);
}
module.exports={traceMbc3RegisterInput};
