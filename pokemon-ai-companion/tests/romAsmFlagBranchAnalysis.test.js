'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectTxAsmHandler}=require('../romTxAsmHandlerAtlas');
const {inspectFlagBranch,inspectDualTextChoice}=require('../romAsmFlagBranchAnalysis');
const {buildStaticWorldFlagDependencies}=require('../romStaticWorldFlagDependencies');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
function fixture(bytes){
 const rom=Buffer.alloc(1048576),fileOffset=0x18000;
 rom.set([0x08,...bytes],fileOffset);
 return {rom,fileOffset};
}
test('ROM BIT 0,A -> JR NZ proves branch only if bit is set',()=>{
 const f=fixture([
  0xfa,0x47,0xd7,0xcb,0x47,0x20,0x08,
  0x21,0x00,0x41,0xcd,0x49,0x3c,0x18,0x06,
  0x21,0x20,0x41,0xcd,0x49,0x3c,0xc9
 ]);
 f.rom[f.fileOffset+0x100]=0x17;
 f.rom[f.fileOffset+0x120]=0x17;
 const graph=inspectTxAsmHandler(f);
 assert.equal(graph.verified,true);
 assert.equal(graph.adjacentRomFlagBranchConditionsDecoded,1);
 assert.equal(graph.adjacentRomFlagDualTextChoices,1);
 const p=graph.adjacentRomFlagBitPatterns[0],gate=p.staticConditionalBranch;
 assert.equal(gate.verified,true);
 assert.equal(gate.condition,'NZ');
 assert.equal(gate.branchKind,'JR');
 assert.equal(gate.jumpTakenIfBitSet,true);
 assert.equal(gate.jumpTakenIfBitClear,false);
 assert.equal(gate.interveningFlagsPreservingInstruction,null);
 assert.equal(gate.branchActuallyTaken,null);
 assert.equal(gate.takenTargetCpu,0x4010);
 assert.equal(gate.fallthroughCpu,0x4008);
 const dual=p.staticDualTextChoice;
 assert.equal(dual.verified,true);
 assert.equal(dual.bothRomTextFarOpcodesVerified,true);
 assert.equal(dual.alternativeTextScriptsStaticallyProven,true);
 assert.equal(dual.textOnBitClearPointerCpu,0x4100);
 assert.equal(dual.textOnBitSetPointerCpu,0x4120);
 assert.equal(dual.sharedCallCpu,0x3c49);
 assert.equal(dual.dialogueShown,false);
 assert.equal(dual.playerEffectVerified,false);
});
test('ROM BIT 0,A -> LD HL,d16 -> JR Z retains CPU flags; jumps when bit clear',()=>{
 const graph=inspectTxAsmHandler(fixture([
  0xfa,0x47,0xd7,0xcb,0x47,
  0x21,0x40,0x41,0x28,0x03,0x00,0x00,0xc9
 ]));
 assert.equal(graph.verified,true);
 const gate=graph.adjacentRomFlagBitPatterns[0].staticConditionalBranch;
 assert.equal(gate.verified,true);
 assert.equal(gate.condition,'Z');
 assert.equal(gate.jumpTakenIfBitSet,false);
 assert.equal(gate.jumpTakenIfBitClear,true);
 assert.equal(gate.interveningFlagsPreservingInstruction.opcode,0x21);
 assert.equal(gate.interveningFlagsPreservingInstruction.literalPointerCpu,0x4140);
 assert.equal(graph.adjacentRomFlagBranchPreservingInterveningLoad,1);
 assert.equal(graph.adjacentRomFlagDualTextChoices,0);
});
test('JP Z/NZ conditional branch is decoded from ROM direct CPU target',()=>{
 const g=inspectTxAsmHandler(fixture([
  0xfa,0x47,0xd7,0xcb,0x47,0xca,0x20,0x40,0xc9
 ]));
 assert.equal(g.verified,true);
 const branch=g.adjacentRomFlagBitPatterns[0].staticConditionalBranch;
 assert.equal(branch.verified,true);
 assert.equal(branch.branchKind,'JP');
 assert.equal(branch.condition,'Z');
 assert.equal(branch.takenTargetCpu,0x4020);
 assert.equal(branch.fallthroughCpu,0x4009);
 assert.equal(branch.gameplayEffectVerified,false);
});
test('flag-modifying opcode or unrelated branch never invents a bit gate',()=>{
 for(const x of [
  [0xfa,0x47,0xd7,0xcb,0x47,0xaf,0x20,0x03,0xc9],
  [0xfa,0x47,0xd7,0xcb,0x47,0xcd,0x49,0x3c,0x20,0x03,0xc9],
  [0xfa,0x47,0xd7,0xcb,0x47,0x30,0x03,0xc9],
  [0x21,0x47,0xd7,0xcb,0xc6,0x20,0x03,0xc9]
 ]){
  const g=inspectTxAsmHandler(fixture(x));
  assert.equal(g.verified,true);
  assert.equal(g.adjacentRomFlagBranchConditionsDecoded,0);
 }
});
test('shared callback without paired ROM text commands is not a proven dual choice',()=>{
 const f=fixture([
  0xfa,0x47,0xd7,0xcb,0x47,0x20,0x08,
  0x21,0x00,0x41,0xcd,0x49,0x3c,0x18,0x06,
  0x21,0x20,0x41,0xcd,0x49,0x3c,0xc9
 ]);
 const g=inspectTxAsmHandler(f);
 const p=g.adjacentRomFlagBitPatterns[0];
 assert.equal(p.staticConditionalBranch.verified,true);
 assert.equal(p.staticDualTextChoice.verified,true);
 assert.equal(p.staticDualTextChoice.bothRomTextFarOpcodesVerified,false);
 assert.equal(p.staticDualTextChoice.alternativeTextScriptsStaticallyProven,false);
 const forged=inspectFlagBranch({rom:f.rom,instructions:null,pattern:p});
 assert.equal(forged,null);
 assert.equal(inspectDualTextChoice({rom:f.rom,instructions:[],pattern:p,gate:null}),null);
});
for(const [name,env] of [['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']]){
 test('real '+name+' ROM: all 8 cross-object flag candidates have physical bit-conditioned branches and four alternative texts',
 {skip:!process.env[env]?'Original ROM file required':false},()=>{
  const rom=readRom(process.env[env]);
  const profile=inspectRomBuffer(rom,name+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[name]);
  const atlas=profile.world.interactionScriptAtlas;
  const linked=buildStaticWorldFlagDependencies({atlas});
  assert.equal(linked.verified,true,linked.reason);
  assert.equal(linked.candidateLinks.length,8);
  assert.equal(linked.summary.crossMapPotentialLinks,5);
  assert.equal(linked.summary.conditionalBranchLinksDecoded,8);
  assert.equal(linked.summary.dualTextChoiceLinksDecoded,4);
  assert.ok(atlas.summary.uniqueAsmFlagConditionalBranchGates>=8);
  assert.ok(atlas.summary.uniqueAsmFlagDualTextAlternatives>=4);
  for(const link of linked.candidateLinks){
   assert.equal(link.readerConditionalDirectionVerified,true);
   const gate=link.readerBranchCondition;
   assert.equal(gate.verified,true);
   assert.equal(gate.jumpTakenIfBitSet,true);
   assert.equal(gate.condition,'NZ');
   assert.equal(gate.branchActuallyTaken,null);
   assert.equal(rom[gate.branchOffset],gate.branchOpcode);
   const text=link.readerDualTextChoice;
   if(link.bitIndex===1231){
    assert.equal(text.verified,true);
    assert.equal(text.alternativeTextScriptsStaticallyProven,true);
    assert.equal(rom[text.textPointerAFileOffset],0x17);
    assert.equal(rom[text.textPointerBFileOffset],0x17);
    assert.equal(text.textOnBitClearPointerCpu!==text.textOnBitSetPointerCpu,true);
   }else assert.equal(link.readerTwoAlternativeTextScriptsVerified,false);
   assert.equal(link.causalLinkObserved,false);
   assert.equal(link.scriptEffectVerified,false);
  }
 });
}
