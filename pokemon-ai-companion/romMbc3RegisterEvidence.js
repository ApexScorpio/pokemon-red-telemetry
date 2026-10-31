'use strict';
// Decode literal MBC3 control writes in *candidate* ROM0 instruction streams.
// No proof of execution, selected ROM bank, A/SP contents or indirect writes.
const ROM_SIZE=1048576,ROM0_SIZE=0x4000,REGION_END=0x8000;
const MBC3_TYPES=new Set([0x0f,0x10,0x11,0x12,0x13]);
const GROUPS=[
 {start:0x0000,end:0x1fff,kind:'RAM_RTC_ENABLE'},
 {start:0x2000,end:0x3fff,kind:'ROM_BANK_NUMBER'},
 {start:0x4000,end:0x5fff,kind:'RAM_BANK_OR_RTC_SELECT'},
 {start:0x6000,end:0x7fff,kind:'RTC_LATCH'}
];
function invalid(reason){return {verified:false,reason,candidates:[],
 runtimeRegisterValueKnown:false,executed:false,semantic100PercentCertified:false};}
function classifyMbc3Rom0LiteralWrites({rom,pc}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_SIZE||
    !Number.isInteger(pc)||pc<0||pc+3>ROM0_SIZE)
  return invalid('Require 1MiB ROM0 and complete literal memory-write instruction');
 if(!MBC3_TYPES.has(rom[0x147])||rom[0x148]!==0x05)
  return invalid('Header does not declare a supported 1MiB MBC3 variant');
 const opcode=rom[pc];
 // EA nn nn = LD (a16),A ; 08 nn nn = LD (a16),SP (two writes).
 if(opcode!==0xea&&opcode!==0x08)
  return invalid('Not an absolute memory-write opcode EA or 08');
 const target=rom.readUInt16LE(pc+1);
 const writes=opcode===0xea?
  [{targetCpu:target,valueSource:'A'}]:
  [{targetCpu:target,valueSource:'SP_LOW'},
   {targetCpu:(target+1)&0xffff,valueSource:'SP_HIGH'}];
 const candidates=writes.filter(w=>w.targetCpu<REGION_END).map(w=>{
  const region=GROUPS.find(g=>w.targetCpu>=g.start&&w.targetCpu<=g.end);
  return {targetCpu:w.targetCpu,registerKind:region.kind,
   valueSource:w.valueSource,valueKnown:false,executed:false,
   bankSelected:null};
 });
 return {verified:true,source:'ROM0_MBC3_LITERAL_REGISTER_WRITES_V1',
  pc,opcode,size:3,candidates,
  explicitRegisterTargets:candidates.length,
  runtimeRegisterValueKnown:false,executed:false,
  activeBankKnown:false,semantic100PercentCertified:false,
  warning:'Physical opcode candidate with literal address. Not proof that this branch ran, nor that A/SP values or MBC3 bank were known.'};
}
module.exports={classifyMbc3Rom0LiteralWrites};
