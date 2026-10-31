'use strict';
// Bound A input provenance to ONE explicitly linear static ROM0 witness.
// Neither the witness nor any MBC3 bank-selection write is known to execute.
const {decodeOpcode}=require('./romMapCodeAtlas');
const MBC3_TYPES=new Set([15,16,17,18,19]);
const PRESERVES_A=new Set([
 0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x08,0x09,0x0b,0x0c,0x0d,0x0e,
 0x11,0x12,0x13,0x14,0x15,0x16,0x19,0x1b,0x1c,0x1d,0x1e,
 0x21,0x22,0x23,0x24,0x25,0x26,0x29,0x2b,0x2c,0x2d,0x2e,
 0x31,0x32,0x33,0x36,0x37,0x39,0x3b,0x3f,0x77,0x7f,0xa7,0xb7,
 0xc1,0xc5,0xd1,0xd5,0xe0,0xe1,0xe2,0xe5,0xea,0xf3,0xf9,0xfb,0xfe
]);
for(let x=0x40;x<=0x75;x++)PRESERVES_A.add(x);
for(let x=0xb8;x<=0xbf;x++)PRESERVES_A.add(x);
const invalid=reason=>({verified:false,reason,executed:false,
 runtimeValueKnown:false,activeBankKnown:false});
function traceMbc3AProvenance({rom,witnessPath,writePc,maxBacktrack=32}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    !MBC3_TYPES.has(rom[0x147])||rom[0x148]!==5||
    !Number.isInteger(writePc)||writePc<0||writePc+3>0x4000||
    rom[writePc]!==0xea||!Array.isArray(witnessPath)||
    witnessPath.at(-1)?.pc!==writePc||
    !Number.isInteger(maxBacktrack)||maxBacktrack<1||maxBacktrack>64)
  return invalid('Require exact 1MiB MBC3 header, ROM0 EA, witness and safe budget');
 const base={verified:true,source:'ROM0_MBC3_LINEAR_A_SOURCE_V1',
  writePc,sourcePc:null,sourceOpcode:null,sourceKind:'UNRESOLVED',
  sourceAddressCpu:null,sourceRegister:null,conditionalByte:null,
  scannedInstructions:0,stopReason:null,witnessPathOnly:true,
  executed:false,runtimeValueKnown:false,activeBankKnown:false,
  semantic100PercentCertified:false};
 const stop=(why,n)=>({...base,scannedInstructions:n,stopReason:why});
 let n=0;
 for(let i=witnessPath.length-2;i>=0&&n<maxBacktrack;i--){
  const p=witnessPath[i],next=witnessPath[i+1];
  if(!Number.isInteger(p?.pc)||p.pc<0||p.pc>=0x4000||
     next?.via!=='fallthrough')return stop('NON_LINEAR_WITNESS',n);
  const d=decodeOpcode(rom,0,p.pc);
  if(!d.ok||p.pc+d.size!==next.pc)return stop('BAD_INSTRUCTION_BOUNDARY',n);
  n++;
  const op=d.opcode,pc=p.pc;
  if(op===0x3e||op===0xaf||op===0x97)
   return {...base,sourcePc:pc,sourceOpcode:op,
    sourceKind:op===0x3e?'IMMEDIATE_A':'ZEROING_A',
    conditionalByte:op===0x3e?rom[pc+1]:0,scannedInstructions:n};
  if(op>=0x78&&op<=0x7e)
   return {...base,sourcePc:pc,sourceOpcode:op,
    sourceKind:'REGISTER_OR_HL_READ',
    sourceRegister:['B','C','D','E','H','L','(HL)'][op-0x78],
    scannedInstructions:n};
  if([0x0a,0x1a,0x2a,0x3a,0xfa,0xf0,0xf2].includes(op))
   return {...base,sourcePc:pc,sourceOpcode:op,
    sourceKind:'MEMORY_READ',
    sourceAddressCpu:op===0xfa?rom.readUInt16LE(pc+1):
     op===0xf0?0xff00+rom[pc+1]:null,scannedInstructions:n};
  if(op===0xf1)
   return {...base,sourcePc:pc,sourceOpcode:op,
    sourceKind:'STACK_POP_AF',scannedInstructions:n};
  if(!PRESERVES_A.has(op))
   return stop('UNMODELLED_A_WRITE_OR_CONTROL',n);
 }
 return stop(n>=maxBacktrack?'BUDGET_EXHAUSTED':'ROOT_BOUNDARY',n);
}
module.exports={traceMbc3AProvenance};
