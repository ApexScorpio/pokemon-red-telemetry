'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditMbc3RomxBoundedGraph}=require('../romMbc3RomxBoundedGraph');
const {auditMbc3RomxGraphExpansion}=require('../romMbc3RomxGraphExpansion');
const {auditMbc3RomxDepthSweep}=require('../romMbc3RomxDepthSweep');
const {auditMbc3RomxFrontiers}=require('../romMbc3RomxFrontiers');
const make=()=>{const r=Buffer.alloc(1048576,0xc9);r[0x147]=19;r[0x148]=5;return r;};
const source=(r,bank=3,pc=0x5000)=>({
 rom0TransferPc:0x201,candidateWritePc:0x200,
 candidateBankIfExecuted:bank,romxTargetCpu:pc,
 physicalFileOffset:bank*0x4000+pc-0x4000,
 physicalFirstOpcodeByte:r[bank*0x4000+pc-0x4000],
 bankWriteExecuted:false,transferExecuted:false,
 activeBankVerified:false,causalLinkVerified:false});
function context(r,sites){
 const scenarioAtlas={verified:true,scenarios:sites,
  scenarioCount:sites.length,activeBanksVerified:0,executedTransfers:0};
 const baselineGraph=auditMbc3RomxBoundedGraph({
  rom:r,scenarioAtlas,maxInstructionsPerEntrypoint:48});
 const expansion=auditMbc3RomxGraphExpansion({
  rom:r,scenarioAtlas,baselineGraph});
 const depthSweep=auditMbc3RomxDepthSweep({rom:r,scenarioAtlas,expansion});
 return {rom:r,depthSweep};
}
test('1300 byte NOP candidate gives exact CPU frontier and byte window',()=>{
 const r=make(),offset=3*0x4000+0x1000;r.fill(0,offset,offset+1300);
 const x=auditMbc3RomxFrontiers(context(r,[source(r)]));
 assert.equal(x.verified,true);assert.equal(x.cappedEntries,1);
 assert.equal(x.sampledFrontierTargets,1);
 assert.equal(x.zeroFirstByteSamples,1);
 assert.equal(x.allZero16ByteWindows,1);
 assert.equal(x.frontierEvidence[0].samples[0].cpuPc,0x5400);
 assert.equal(x.frontierEvidence[0].samples[0].rawWindowHex,'00'.repeat(16));
 assert.equal(x.executedInstructions,0);
});
test('terminated RET candidate does not create an invented frontier',()=>{
 const r=make(),x=auditMbc3RomxFrontiers(context(r,[source(r)]));
 assert.equal(x.verified,true);assert.equal(x.cappedEntries,0);
 assert.equal(x.sampledFrontierTargets,0);
 assert.deepEqual(x.frontierEvidence,[]);
});
test('undocumented byte just outside 1024 budget is identified, not executed',()=>{
 const r=make(),offset=3*0x4000+0x1000;
 r.fill(0,offset,offset+1024);r[offset+1024]=0xe4;
 const x=auditMbc3RomxFrontiers(context(r,[source(r)]));
 assert.equal(x.verified,true);assert.equal(x.cappedEntries,1);
 assert.equal(x.frontierEvidence[0].samples[0].firstByte,0xe4);
 assert.equal(x.frontierEvidence[0].samples[0].firstOpcodeDecodable,false);
 assert.equal(x.decodeFailureReasons['undocumented opcode'],1);
 assert.equal(x.causalBankWritesVerified,0);
});
test('two physical entries remain independently and conditionally classified',()=>{
 const r=make(),a=3*0x4000+0x1000;
 r.fill(0,a,a+1300);
 const x=auditMbc3RomxFrontiers(context(r,[source(r,3),source(r,5)]));
 assert.equal(x.verified,true);
 assert.equal(x.cappedEntries,1);
 assert.equal(x.entriesUncapped,1);
 assert.equal(x.frontierEvidence[0].bank,3);
});
test('tampered physical samples, runtime claims and mismatched counts fail closed',()=>{
 const r=make(),offset=3*0x4000+0x1000;r.fill(0,offset,offset+1300);
 const ctx=context(r,[source(r)]),orig=ctx.depthSweep;
 const altered=JSON.parse(JSON.stringify(orig));
 altered.comparisons[0].frontierTargetsAt1024[0].rawWindowHex='ff';
 const forged=JSON.parse(JSON.stringify(orig));
 forged.entriesStillBudgetExhausted=0;
 const live=JSON.parse(JSON.stringify(orig));live.executedInstructions=1;
 for(const sweep of [altered,forged,live]){
  const result=auditMbc3RomxFrontiers({rom:r,depthSweep:sweep});
  assert.equal(result.verified,false);
 }
});
