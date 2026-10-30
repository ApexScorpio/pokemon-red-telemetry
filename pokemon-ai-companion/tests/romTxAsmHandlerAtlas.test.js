'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectTxAsmHandler}=require('../romTxAsmHandlerAtlas');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
function fixture(offset=0x18000,bytes=[0x08,0x20,0x04,0xcd,0x34,0x12,0xc9,0xc9]){
 const rom=Buffer.alloc(1048576);rom.set(bytes,offset);
 return {rom,fileOffset:offset};
}
test('conditional JR and ROM0 CALL become static candidates, not executed effects',()=>{
 const r=inspectTxAsmHandler(fixture());
 assert.equal(r.verified,true);
 assert.equal(r.bank,6);
 assert.equal(r.initialOpcode,0x20);
 assert.equal(r.opcodeCandidateCount,4);
 assert.equal(r.branchCount,1);
 assert.equal(r.callsNotFollowed,1);
 assert.equal(r.returnsObserved,2);
 assert.equal(r.unresolvedBranchTargets,0);
 assert.equal(r.callTargets[0].cpu,0x1234);
 assert.equal(r.callTargets[0].mapping,'ROM0_FIXED');
 assert.equal(r.scriptEffectsVerified,false);
 assert.equal(r.conditionsVerified,false);
 assert.equal(r.executed,false);
});
test('unconditional JP out of the handler bank stays unresolved',()=>{
 const r=inspectTxAsmHandler(fixture(0x18000,[0x08,0xc3,0x10,0x01]));
 assert.equal(r.verified,true);
 assert.equal(r.opcodeCandidateCount,1);
 assert.equal(r.unresolvedBranchTargets,1);
 assert.equal(r.unresolved[0].reason,'ROM0_OUTSIDE_LOCAL_GRAPH');
 assert.equal(r.semantic100PercentCertified,false);
});
test('indirect JP and instruction budget never claim full disassembly',()=>{
 const r=inspectTxAsmHandler(fixture(0x18000,[0x08,0xe9]));
 assert.equal(r.verified,true);
 assert.equal(r.indirectTransfers,1);
 assert.equal(r.unresolvedBranchTargets,1);
 const many=inspectTxAsmHandler(fixture(0x18000,[0x08,...Array(100).fill(0x00)]),maxInstructions:8);
 assert.equal(many.verified,true);
 assert.equal(many.opcodeCandidateCount,8);
 assert.equal(many.limitReached,true);
 assert.ok(many.queueRemaining>0);
});
test('fails closed when TX_ASM byte is absent, at bank end, or ROM malformed',()=>{
 assert.equal(inspectTxAsmHandler(fixture(0x18000,[0x00])).verified,false);
 assert.equal(inspectTxAsmHandler(fixture(0x1bfff,[0x08])).verified,false);
 assert.equal(inspectTxAsmHandler({rom:Buffer.alloc(100),fileOffset:0}).verified,false);
 assert.equal(inspectTxAsmHandler({...fixture(),maxInstructions:257}).verified,false);
});
for(const [name,env] of [['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']]){
 test('real '+name+' ROM enumerates every TX_ASM handler with bounded code-only evidence',
 {skip:!process.env[env]?'Real ROM file required':false},()=>{
  const rom=readRom(process.env[env]),p=inspectRomBuffer(rom,name+'.gb');
  assert.equal(p.hash.sha256,KNOWN[name]);
  const atlas=p.world.interactionScriptAtlas;
  assert.equal(atlas.verified,true);
  assert.equal(atlas.summary.asmTextReferences,626);
  assert.equal(atlas.summary.commandCounts.TX_START_ASM,626);
  assert.equal(atlas.summary.asmEntrypointsLocated,626);
  assert.ok(atlas.summary.uniqueAsmEntrypoints>0);
  assert.ok(atlas.summary.uniqueAsmEntrypoints<=626);
  assert.ok(atlas.summary.uniqueAsmCandidateInstructions>=1);
  assert.equal(atlas.summary.asmSemanticallyCertified,0);
  const entries=atlas.maps.flatMap(m=>m.interactions)
   .filter(r=>r.scriptCommand==='TX_START_ASM');
  assert.equal(entries.length,626);
  assert.ok(entries.every(r=>
   r.asmCandidate?.verified===true&&
   r.asmCandidate.txAsmFileOffset===r.scriptFileOffset&&
   r.asmCandidate.source==='ROM_TX_ASM_LOCAL_CODE_CANDIDATES'&&
   r.asmCandidate.scriptEffectsVerified===false&&
   r.asmCandidate.conditionsVerified===false&&
   r.asmCandidate.executed===false&&
   r.asmCandidate.opcodeCandidateCount<=64));
 });
}
