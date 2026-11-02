'use strict';
// ROM-exact adjacent LR35902 byte patterns for Gen I script flag operations.
// Only classify where *both* decoded instructions are in the bank-local
// candidate graph and the source register/address is a direct literal.
// No MBC bank inference, no CALL traversal, no assertion the branch executes.
const {inspectFlagBranch,inspectDualTextChoice}=require('./romAsmFlagBranchAnalysis');
const WORLD=0xd747,END=0xd886;
function domain(address){
 if(address>=WORLD&&address<=END)return {
  kind:'WORLD_EVENT_BIT',base:WORLD,capacity:2560};
 if(address>=0xd6f0&&address<=0xd6fd)return {
  kind:'HIDDEN_ITEM_BIT',base:0xd6f0,capacity:112};
 if(address>=0xd6fe&&address<=0xd6ff)return {
  kind:'HIDDEN_COIN_BIT',base:0xd6fe,capacity:16};
 return null;
}
function inspectAdjacentFlagPatterns({rom,instructions}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    !Array.isArray(instructions)||instructions.length>256)
  return {verified:false,reason:'ROM or candidate instruction graph invalid',patterns:[]};
 const byOffset=new Map();
 for(const row of instructions){
  if(!Number.isInteger(row?.offset)||!Number.isInteger(row?.size)||
     row.size<1||row.size>3||row.offset<0||
     row.offset+row.size>rom.length||rom[row.offset]!==row.opcode||
     byOffset.has(row.offset))
   return {verified:false,reason:'Candidate instruction boundary inconsistent',patterns:[]};
  byOffset.set(row.offset,row);
 }
 const patterns=[];
 for(const first of instructions){
  // ld a,[$nn] or ld hl,$nn: direct address is certain, while the
  // full execution path and subsequent JR/JPs remain unproven.
  if(first.size!==3||![0xfa,0x21].includes(first.opcode))continue;
  const addr=rom.readUInt16LE(first.offset+1);
  const group=domain(addr);
  if(!group)continue;
  const second=byOffset.get(first.offset+3);
  if(!second||second.opcode!==0xcb||second.size!==2)continue;
  const cb=rom[second.offset+1];
  const register=cb&7;
  if(first.opcode===0xfa&&register!==7)continue; // BIT b,A
  if(first.opcode===0x21&&register!==6)continue; // BIT/SET/RES b,[HL]
  let op;
  if(cb>=0x40&&cb<0x80)op='BIT_TEST';
  else if(first.opcode===0x21&&cb>=0x80&&cb<0xc0)op='RESET_BIT';
  else if(first.opcode===0x21&&cb>=0xc0)op='SET_BIT';
  else continue;
  const index=(addr-group.base)*8+((cb>>3)&7);
  if(index<0||index>=group.capacity)continue;
  patterns.push({
   offset:first.offset,secondOffset:second.offset,
   bank:first.bank,cpu:first.cpu,
   firstOpcode:first.opcode,secondOpcode:0xcb,cbOpcode:cb,
   address:addr,domain:group.kind,bitIndex:index,
   bitNumber:(cb>>3)&7,operation:op,
   register:register===7?'A':'HL_INDIRECT',
   operandsAndAdjacencyVerified:true,
   controlFlowAndRegistersOutsidePairVerified:false,
   instructionSequenceExecuted:false,
   eventBitValueKnown:false,eventOutcomeCertified:false,
   source:'ROM_EXACT_ADJACENT_LR35902_OPCODES'
  });
 }
 for(const pattern of patterns){
  if(pattern.operation!=='BIT_TEST'){
   pattern.staticConditionalBranch=null;
   pattern.staticDualTextChoice=null;
   continue;
  }
  const gate=inspectFlagBranch({rom,instructions,pattern});
  pattern.staticConditionalBranch=gate;
  pattern.staticDualTextChoice=gate?
   inspectDualTextChoice({rom,instructions,pattern,gate}):null;
 }
 return {verified:true,patterns,
  romBitBranchesWithProvenCondition:patterns.filter(x=>
   x.staticConditionalBranch?.verified===true).length,
  romBitBranchesSkippingFlagSafeInstruction:patterns.filter(x=>
   x.staticConditionalBranch?.interveningFlagsPreservingInstruction).length,
  romBitDualTextChoices:patterns.filter(x=>
   x.staticDualTextChoice?.alternativeTextScriptsStaticallyProven===true).length,
  testedBitCandidates:patterns.filter(x=>x.operation==='BIT_TEST').length,
  setBitCandidates:patterns.filter(x=>x.operation==='SET_BIT').length,
  resetBitCandidates:patterns.filter(x=>x.operation==='RESET_BIT').length,
  executionCertified:false,completenessCertified:false};
}
module.exports={inspectAdjacentFlagPatterns,domain};
