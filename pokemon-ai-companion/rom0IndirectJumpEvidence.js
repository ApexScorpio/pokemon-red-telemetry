'use strict';
// Fail-closed LR35902 indirect jump evidence, read directly from a 1MiB ROM.
// Literal destinations are candidates, not proof of the runtime branch.
const BYTES=1048576,ROM0_END=0x4000;
const invalid=reason=>({verified:false,reason,kind:'INVALID',
 candidateTargetsCpu:[],runtimeTargetKnown:false,
 runtimeExecuted:false,gameEffectVerified:false});
function inspectRom0IndirectJump({rom,jumpPc}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==BYTES||
    !Number.isInteger(jumpPc)||jumpPc<0||jumpPc>=ROM0_END||
    rom[jumpPc]!==0xe9)
  return invalid('ROM de 1MiB ou endereco JP HL fixo invalido');
 const base={verified:true,jumpPc,kind:'UNCLASSIFIED_JP_HL',
  candidateTargetsCpu:[],runtimeTargetKnown:false,
  runtimeExecuted:false,gameEffectVerified:false,
  provenance:'ROM0_PHYSICAL_BYTES_AND_LR35902_OPCODES'};
 // CP n, JP NC fallback, LD HL,table, PUSH BC, ADD A,A,
 // LD B,0, LD C,A, ADD HL,BC, POP BC, LD A,[HL+],
 // LD H,[HL], LD L,A, JP HL. The ROM table is static;
 // no statement that a particular value of A is chosen in the game.
 const at=jumpPc-18;
 if(at>=0&&rom[at]===0xfe&&rom[at+2]===0xd2&&
    rom[at+5]===0x21&&rom[at+8]===0xc5&&
    rom[at+9]===0x87&&rom[at+10]===0x06&&
    rom[at+11]===0x00&&rom[at+12]===0x4f&&
    rom[at+13]===0x09&&rom[at+14]===0xc1&&
    rom[at+15]===0x2a&&rom[at+16]===0x66&&
    rom[at+17]===0x6f){
  const bound=rom[at+1],
   escapeCpu=rom.readUInt16LE(at+3),
   tableCpu=rom.readUInt16LE(at+6);
  if(bound>0&&bound<=32&&escapeCpu<ROM0_END&&
     tableCpu<ROM0_END&&tableCpu+2*bound<=ROM0_END){
   const entries=Array.from({length:bound},(_,index)=>{
    const entryCpu=tableCpu+index*2,targetCpu=rom.readUInt16LE(entryCpu);
    return {index,entryCpu,targetCpu,
     fixedRom0Candidate:targetCpu<ROM0_END};
   });
   if(entries.every(x=>x.fixedRom0Candidate))
    return {...base,kind:'GUARDED_ROM0_LITERAL_JUMP_TABLE',
     indexBoundExclusive:bound,nonTableBranchCpu:escapeCpu,
     tableCpu,entries,candidateTargetsCpu:entries.map(x=>x.targetCpu),
     allEntriesPhysicallyInsideRom0:true,
     runtimeSelectionIndexKnown:false,
     warning:'Possible ROM0 table destinations only; taken branch, RAM state and effects unproven'};
  }
 }
 // PUSH BC/DE of a literal return address followed by JP HL.
 // This reveals the return trampoline but not the HL destination.
 if(jumpPc>=4){
  const op=rom[jumpPc-4],push=rom[jumpPc-1],
   returnPc=rom.readUInt16LE(jumpPc-3),
   register=op===0x01&&push===0xc5?'BC':
    op===0x11&&push===0xd5?'DE':null;
  if(register&&returnPc===jumpPc+1)
   return {...base,kind:'PUSH_RETURN_AND_JUMP_RUNTIME_HL',
    stackRegister:register,returnPc,
    warning:'Literal return PC only; HL target and active ROMX bank remain unknown'};
 }
 return {...base,warning:'JP HL destination requires proven runtime HL register state'};
}
module.exports={inspectRom0IndirectJump};
