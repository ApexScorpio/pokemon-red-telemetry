'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditMbc3RomxBoundedGraph}=require('../romMbc3RomxBoundedGraph');
const make=()=>{const rom=Buffer.alloc(1048576,0xc9);rom[0x147]=0x13;rom[0x148]=5;return rom;};
function entry(rom,{bank=3,pc=0x5000,writePc=0x200}={}){
 const offset=bank*0x4000+pc-0x4000;
 return {rom0TransferPc:0x210,candidateWritePc:writePc,
  candidateBankIfExecuted:bank,romxTargetCpu:pc,
  physicalFileOffset:offset,physicalFirstOpcodeByte:rom[offset],
  bankWriteExecuted:false,transferExecuted:false,
  activeBankVerified:false,causalLinkVerified:false};
}
const atlas=sites=>({verified:true,scenarios:sites,scenarioCount:sites.length,
 activeBanksVerified:0,executedTransfers:0});
test('bounded linear ROMX candidate sequence ends on RET, not runtime proof',()=>{
 const rom=make(),offset=3*0x4000+0x1000;
 rom[offset]=0;rom[offset+1]=0xc9;
 const r=auditMbc3RomxBoundedGraph({rom,scenarioAtlas:atlas([entry(rom)])});
 assert.equal(r.verified,true);
 assert.equal(r.uniquePhysicalEntrypoints,1);
 assert.equal(r.totalDecodedCandidateInstructions,2);
 assert.equal(r.entryResults[0].runtimeExecuted,false);
 assert.equal(r.activeBankVerified,false);
 assert.equal(r.entryResults[0].budgetExhausted,false);
});
test('deduplicates physical entrypoints rather than removing source witnesses',()=>{
 const rom=make();
 const r=auditMbc3RomxBoundedGraph({rom,
  scenarioAtlas:atlas([entry(rom),entry(rom,{writePc:0x300})])});
 assert.equal(r.inputScenarioCount,2);
 assert.equal(r.uniquePhysicalEntrypoints,1);
 assert.equal(r.entryResults[0].decodedCandidateInstructions,1);
});
test('relative conditional branch explores both outcomes within same bank',()=>{
 const rom=make(),at=3*0x4000+0x1000;
 rom.set([0x20,0x02,0x00,0xc9,0xc9],at);
 const r=auditMbc3RomxBoundedGraph({rom,scenarioAtlas:atlas([entry(rom)])});
 assert.equal(r.verified,true);
 assert.equal(r.totalDecodedCandidateInstructions,4);
 assert.equal(r.entryResults[0].branchWithinSameBankCandidates,3);
 assert.equal(r.entryResults[0].branchesToROM0NotFollowed,0);
});
test('unconditional loop is bounded and not interpreted as execution',()=>{
 const rom=make(),at=3*0x4000+0x1000;
 rom.set([0x18,0xfe],at);
 const r=auditMbc3RomxBoundedGraph({rom,scenarioAtlas:atlas([entry(rom)])});
 assert.equal(r.totalDecodedCandidateInstructions,1);
 assert.equal(r.entryResults[0].budgetExhausted,false);
 assert.equal(r.entryResults[0].runtimeExecuted,false);
});
test('undocumented first byte and crossed bank boundary are classified',()=>{
 const rom=make(),at=3*0x4000+0x1000;
 rom[at]=0xe4;
 rom[3*0x4000+0x3fff]=0xea;
 const r=auditMbc3RomxBoundedGraph({rom,scenarioAtlas:atlas([
  entry(rom),entry(rom,{pc:0x7fff})
 ])});
 assert.equal(r.nonDecodableEntrypoints,2);
 assert.equal(r.entryResults[0].decodeFailureCounts['undocumented opcode'],1);
 assert.equal(r.entryResults[1].decodeFailureCounts['instruction crosses bank boundary'],1);
 assert.equal(r.totalDecodedCandidateInstructions,0);
});
test('call to ROM0 is not followed while fallthrough stays within bank',()=>{
 const rom=make(),at=3*0x4000+0x1000;
 rom.set([0xcd,0x50,0x01,0xc9],at);
 const r=auditMbc3RomxBoundedGraph({rom,scenarioAtlas:atlas([entry(rom)])});
 assert.equal(r.totalBranchesToRom0NotFollowed,1);
 assert.equal(r.totalDecodedCandidateInstructions,2);
});
test('budget exhaustion records unresolved static edges explicitly',()=>{
 const rom=make(),at=3*0x4000+0x1000;
 rom.fill(0,at,at+32);
 const r=auditMbc3RomxBoundedGraph({
  rom,scenarioAtlas:atlas([entry(rom)]),maxInstructionsPerEntrypoint:2});
 assert.equal(r.totalDecodedCandidateInstructions,2);
 assert.equal(r.entrypointsBudgetExhausted,1);
 assert.equal(r.entryResults[0].pendingStaticEdges,1);
});
test('untrusted input and invented runtime execution fail closed',()=>{
 const rom=make();
 for(const props of [
  {},{rom:Buffer.alloc(12),scenarioAtlas:atlas([])},
  {rom,scenarioAtlas:{...atlas([entry(rom)]),executedTransfers:1}},
  {rom,scenarioAtlas:atlas([{...entry(rom),transferExecuted:true}])},
  {rom,scenarioAtlas:atlas([{...entry(rom),physicalFileOffset:4}])},
  {rom,scenarioAtlas:atlas([entry(rom)]),maxInstructionsPerEntrypoint:1025}
 ])assert.equal(auditMbc3RomxBoundedGraph(props).verified,false);
});

test('1024-instruction explicit cap is accepted without claiming execution',()=>{
 const rom=make(),at=3*0x4000+0x1000;
 rom.fill(0,at,at+1300);
 const r=auditMbc3RomxBoundedGraph({
  rom,scenarioAtlas:atlas([entry(rom)]),maxInstructionsPerEntrypoint:1024});
 assert.equal(r.verified,true);
 assert.equal(r.totalDecodedCandidateInstructions,1024);
 assert.equal(r.entrypointsBudgetExhausted,1);
 assert.equal(r.entryResults[0].runtimeExecuted,false);
});

test('1024-depth capped frontier samples actual next CPU and 16 physical bytes',()=>{
 const rom=make(),at=3*0x4000+0x1000;
 rom.fill(0,at,at+1300);
 const r=auditMbc3RomxBoundedGraph({
  rom,scenarioAtlas:atlas([entry(rom)]),maxInstructionsPerEntrypoint:1024});
 assert.equal(r.verified,true);assert.equal(r.entrypointsBudgetExhausted,1);
 const e=r.entryResults[0];
 assert.equal(e.frontierPendingUniqueCount,1);
 assert.equal(e.frontierTargets.length,1);
 assert.equal(e.frontierTargets[0].cpuPc,0x5400);
 assert.equal(e.frontierTargets[0].fileOffset,at+1024);
 assert.equal(e.frontierTargets[0].rawWindowHex,'00'.repeat(16));
 assert.equal(e.frontierTargets[0].leadingNopBytesInWindow,16);
 assert.equal(e.frontierTargets[0].firstOpcodeDecodable,true);
 assert.equal(e.runtimeExecuted,false);
});
test('closed ROMX graph exposes no invented pending frontier',()=>{
 const rom=make();
 const r=auditMbc3RomxBoundedGraph({
  rom,scenarioAtlas:atlas([entry(rom)]),maxInstructionsPerEntrypoint:1024});
 assert.equal(r.verified,true);
 assert.equal(r.entryResults[0].budgetExhausted,false);
 assert.equal(r.entryResults[0].frontierPendingUniqueCount,0);
 assert.deepEqual(r.entryResults[0].frontierTargets,[]);
});

test('frontier includes precise zero-run length until first nonzero byte',()=>{
 const rom=make(),at=3*0x4000+0x1000;
 rom.fill(0,at,at+1300);
 const r=auditMbc3RomxBoundedGraph({rom,
  scenarioAtlas:atlas([entry(rom)]),maxInstructionsPerEntrypoint:1024});
 const row=r.entryResults[0].frontierTargets[0];
 assert.equal(row.cpuPc,0x5400);
 assert.equal(row.zeroRunLengthToNonzeroOrBankEnd,276);
 assert.equal(row.zeroRunEndCpuExclusive,0x5400+276);
 assert.equal(row.zeroRunReachesBankEnd,false);
 assert.equal(row.firstNonzeroByteAfterRun,0xc9);
});
test('zero-run scan stops at ROMX bank physical boundary without reading another bank',()=>{
 const rom=make(),at=3*0x4000+0x1000;
 rom.fill(0,at,(3+1)*0x4000);
 const r=auditMbc3RomxBoundedGraph({rom,
  scenarioAtlas:atlas([entry(rom)]),maxInstructionsPerEntrypoint:1024});
 const row=r.entryResults[0].frontierTargets[0];
 assert.equal(row.zeroRunEndCpuExclusive,0x8000);
 assert.equal(row.zeroRunReachesBankEnd,true);
 assert.equal(row.firstNonzeroByteAfterRun,null);
 assert.equal(row.zeroRunLengthToNonzeroOrBankEnd,0x8000-0x5400);
});
