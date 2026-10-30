'use strict';
// GB ROM0 target location and separate bounded opcode candidate walk.
// This proves a byte/address can be read from fixed ROM bank zero, NOT that
// the branch executes, a game effect occurs, or an MBC state is known.
// Pan Docs memory map: CPU 0000-3FFF is fixed ROM0; 4000-7FFF is ROMX.
const {decodeOpcode}=require('./romMapCodeAtlas');
const ROM_BYTES=1048576,ROM0_END=0x4000;
const fail=reason=>({verified:false,reason,physicalRom0Mapped:false,
 branchExecuted:false,effectVerified:false});
function inspectFixedRom0Target({rom,targetCpu,budget=24}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_BYTES||
   !Number.isInteger(targetCpu)||targetCpu<0||targetCpu>=ROM0_END||
   !Number.isInteger(budget)||budget<1||budget>128)
  return fail('ROM, ROM0 target CPU or bounded scan budget invalid');
 const todo=[targetCpu],scheduled=new Set(todo),visited=new Set();
 const usedBytes=new Set();const candidateInstructions=[];
 const problems=[],unfollowedCalls=[];
 let valid=0;
 while(todo.length&&valid<budget){
  const pc=todo.shift();
  if(pc<0||pc>=ROM0_END||visited.has(pc))continue;
  visited.add(pc);
  const d=decodeOpcode(rom,0,pc);
  if(!d.ok){
   problems.push({pc,reason:d.reason||'OPCODE_UNREADABLE'});
   continue;
  }
  // If a branch points into another instruction, refuse overlapping decode.
  if(Array.from({length:d.size},(_,i)=>pc+i).some(x=>usedBytes.has(x))){
   problems.push({pc,reason:'OVERLAPPING_INSTRUCTION_CANDIDATES'});
   continue;
  }
  for(let i=0;i<d.size;i++)usedBytes.add(pc+i);
  valid++;
  candidateInstructions.push({pc,opcode:d.opcode,size:d.size,kind:d.kind});
  if(d.kind==='indirect')problems.push({pc,reason:'JP_HL_RUNTIME_UNKNOWN'});
  for(const edge of d.targets){
   if(edge.kind==='call'||edge.kind==='restart'){
    unfollowedCalls.push({pc,targetCpu:edge.pc,kind:edge.kind,
     targetRegion:edge.pc>=ROM0_END?'ROMX_BANK_UNKNOWN':'ROM0_PHYSICAL'});
    continue;
   }
   const dest=edge.pc;
   if(dest<0||dest>=ROM0_END){
    problems.push({pc,targetCpu:dest,reason:
     dest>=ROM0_END&&dest<0x8000?'ROMX_ACTIVE_BANK_UNKNOWN':
      'OUTSIDE_FIXED_ROM0'});
    continue;
   }
   if(!scheduled.has(dest)&&!visited.has(dest)){
    todo.push(dest);scheduled.add(dest);
   }
  }
 }
 return {verified:true,physicalRom0Mapped:true,targetCpu,
  romFileOffset:targetCpu,firstByte:rom[targetCpu],budget,
  opcodeCandidateCount:valid,candidateInstructionBytes:usedBytes.size,
  candidateDecodeProblems:problems.length,
  unresolvedCrossRegionTargets:problems.filter(x=>
   x.reason==='ROMX_ACTIVE_BANK_UNKNOWN').length,
  unfollowedCalls:unfollowedCalls.length,
  limitReached:todo.length>0,remainingQueue:todo.length,
  sampleInstructions:candidateInstructions.slice(0,6),
  sampleProblems:problems.slice(0,6),
  sampleCalls:unfollowedCalls.slice(0,6),
  branchExecuted:false,effectVerified:false,semanticsComplete:false,
  source:'ROM0_PHYSICAL_BYTES_BOUNDED_CPU_CANDIDATES',
  warning:'Fixed ROM0 address and candidate opcodes only. No execution, RAM flags, switchable bank state or script effect proven'};
}
module.exports={inspectFixedRom0Target};
