'use strict';
// Deterministic LR35902 single-bit branch interpretation from exact ROM bytes.
// BIT b,r resets Z when the bit is 1. JR NZ/JP NZ tests bit set; JR Z/JP Z
// tests bit clear IF the intervening instructions preserve CPU flags.
// A decoded candidate sequence is not proof it ran in a game session.
const {decodeOpcode}=require('./romMapCodeAtlas');
const BRANCH=new Map([[0x20,'NZ'],[0x28,'Z'],[0xc2,'NZ'],[0xca,'Z']]);
const safe=(r,rom,op,size)=>r&&r.opcode===op&&r.size===size&&
 Number.isInteger(r.offset)&&r.offset>=0&&r.offset+size<=rom.length&&
 rom[r.offset]===op;
const bad=()=>null;
function inspectFlagBranch({rom,instructions,pattern}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    !Array.isArray(instructions)||!pattern||
    pattern.operation!=='BIT_TEST'||!Number.isInteger(pattern.secondOffset))
  return bad();
 const byOffset=new Map(instructions.map(x=>[x.offset,x]));
 let offset=pattern.secondOffset+2,intermediate=null;
 let branch=byOffset.get(offset);
 if(safe(branch,rom,0x21,3)){
  // LD HL,d16 does not modify Z, N, H or C; no general side-effect
  // or flag preservation is assumed for any other opcode.
  intermediate={offset:branch.offset,opcode:0x21,
   literalPointerCpu:rom.readUInt16LE(branch.offset+1)};
  offset+=3;branch=byOffset.get(offset);
 }
 if(!branch||!BRANCH.has(branch.opcode)||
    branch.size!==(branch.opcode<0x40?2:3)||
    branch.offset!==offset||branch.bank!==pattern.bank)
  return bad();
 const d=decodeOpcode(rom,branch.bank,branch.cpu);
 if(d.ok!==true||d.at!==offset||d.opcode!==branch.opcode||
    d.kind!=='branch'||d.targets.length!==2||
    d.targets[1].kind!=='fallthrough')
  return bad();
 const target=d.targets[0].pc,fallthrough=d.targets[1].pc;
 if(!Number.isInteger(target)||target<0||target>=0x8000||
    !Number.isInteger(fallthrough)||fallthrough<0||fallthrough>=0x8000)
  return bad();
 const sense=BRANCH.get(branch.opcode);
 return {verified:true,condition:sense,
  branchOpcode:branch.opcode,branchKind:branch.opcode<0x40?'JR':'JP',
  branchOffset:branch.offset,branchBank:branch.bank,branchCpu:branch.cpu,
  takenTargetCpu:target,fallthroughCpu:fallthrough,
  takenTargetInDecodedGraph:instructions.some(x=>x.cpu===target&&
   x.bank===branch.bank),
  interveningFlagsPreservingInstruction:intermediate,
  jumpTakenIfBitSet:sense==='NZ',jumpTakenIfBitClear:sense==='Z',
  conditionDependsOnBitFromSourcePair:true,
  branchActuallyTaken:null,gameplayEffectVerified:false,
  source:'ROM_LR35902_BIT_Z_FLAG_CONDITIONAL_BRANCH'};
}
function inspectDualTextChoice({rom,instructions,pattern,gate}={}){
 if(!gate?.verified||gate.branchKind!=='JR'||
    gate.interveningFlagsPreservingInstruction!==null||
    !Buffer.isBuffer(rom)||rom.length!==1048576)return bad();
 const byOffset=new Map(instructions.map(x=>[x.offset,x]));
 const bank=gate.branchBank;
 const toOffset=cpu=>cpu<0x4000?cpu:
  cpu>=0x4000&&cpu<0x8000&&bank>0?
   bank*0x4000+cpu-0x4000:null;
 const falseOffset=toOffset(gate.fallthroughCpu);
 const trueOffset=toOffset(gate.takenTargetCpu);
 if(falseOffset===null||trueOffset===null||falseOffset===trueOffset)
  return bad();
 const a=byOffset.get(falseOffset),b=byOffset.get(trueOffset);
 if(!safe(a,rom,0x21,3)||!safe(b,rom,0x21,3))return bad();
 const callA=byOffset.get(a.offset+3);
 const callB=byOffset.get(b.offset+3);
 if(!safe(callA,rom,0xcd,3)||!safe(callB,rom,0xcd,3))
  return bad();
 const commonCall=rom.readUInt16LE(callA.offset+1);
 if(commonCall!==rom.readUInt16LE(callB.offset+1))return bad();
 const skip=byOffset.get(callA.offset+3);
 if(!safe(skip,rom,0x18,2))return bad();
 const jump=decodeOpcode(rom,skip.bank,skip.cpu);
 if(jump.ok!==true||jump.opcode!==0x18||
    jump.targets.length!==1)return bad();
 const afterB=callB.offset+3;
 if(toOffset(jump.targets[0].pc)!==afterB)return bad();
 const pA=rom.readUInt16LE(a.offset+1),pB=rom.readUInt16LE(b.offset+1);
 const addrA=toOffset(pA),addrB=toOffset(pB);
 if(addrA===null||addrB===null||addrA>=rom.length||addrB>=rom.length)
  return bad();
 // 0x17 is TX_FAR, proved by the ROM-text opcode dispatch decoder.
 const bothFar=rom[addrA]===0x17&&rom[addrB]===0x17;
 return {verified:true,flagIndex:pattern.bitIndex,branchWhenBitSet:
    gate.jumpTakenIfBitSet,
  textOnBitClearPointerCpu:gate.jumpTakenIfBitSet?pA:pB,
  textOnBitSetPointerCpu:gate.jumpTakenIfBitSet?pB:pA,
  textPointerAFileOffset:addrA,textPointerBFileOffset:addrB,
  bothRomTextFarOpcodesVerified:bothFar,
  sharedCallCpu:commonCall,
  falsePathStartsAtFileOffset:falseOffset,
  truePathStartsAtFileOffset:trueOffset,
  alternativeTextScriptsStaticallyProven:bothFar,
  callExecuted:false,dialogueShown:false,playerEffectVerified:false,
  source:'ROM_EXACT_DUAL_BRANCH_SHARED_CALL_TEXT_CHOICE'};
}
module.exports={inspectFlagBranch,inspectDualTextChoice};
