'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditMbc3RomxBoundedGraph}=require('../romMbc3RomxBoundedGraph');
const {auditMbc3RomxGraphExpansion}=require('../romMbc3RomxGraphExpansion');
const {auditMbc3RomxDepthSweep}=require('../romMbc3RomxDepthSweep');
const rom=()=>{const r=Buffer.alloc(1048576,0xc9);r[0x147]=0x13;r[0x148]=5;return r;};
function site(r,bank=3,pc=0x5000,writePc=0x200){
 const offset=bank*0x4000+pc-0x4000;
 return {rom0TransferPc:0x210,candidateWritePc:writePc,
  candidateBankIfExecuted:bank,romxTargetCpu:pc,
  physicalFileOffset:offset,physicalFirstOpcodeByte:r[offset],
  bankWriteExecuted:false,transferExecuted:false,
  activeBankVerified:false,causalLinkVerified:false};
}
const plan=sites=>({verified:true,scenarios:sites,scenarioCount:sites.length,
 activeBanksVerified:0,executedTransfers:0});
function sweep(r,sites){
 const scenarioAtlas=plan(sites);
 const baselineGraph=auditMbc3RomxBoundedGraph({rom:r,scenarioAtlas,
  maxInstructionsPerEntrypoint:48});
 const expansion=auditMbc3RomxGraphExpansion({
  rom:r,scenarioAtlas,baselineGraph});
 return auditMbc3RomxDepthSweep({rom:r,scenarioAtlas,expansion});
}
test('bounded RET routine remains unchanged at all four depths',()=>{
 const r=rom(),x=sweep(r,[site(r)]);
 assert.equal(x.verified,true);
 assert.deepEqual(x.levels.map(v=>v.candidateInstructions),[1,1,1,1]);
 assert.deepEqual(x.levels.map(v=>v.budgetExhaustedEntries),[0,0,0,0]);
 assert.equal(x.executedInstructions,0);
});
test('400 NOPs then RET closes at 512 but not 128 or 256',()=>{
 const r=rom(),off=3*0x4000+0x1000;
 r.fill(0,off,off+400);r[off+400]=0xc9;
 const x=sweep(r,[site(r)]);
 assert.equal(x.verified,true);
 assert.deepEqual(x.levels.map(v=>v.candidateInstructions),[128,256,401,401]);
 assert.deepEqual(x.levels.map(v=>v.budgetExhaustedEntries),[1,1,0,0]);
 assert.equal(x.additionalCandidatesBeyond128,273);
 assert.equal(x.entriesThatExitedBudgetSince128,1);
 assert.equal(x.comparisons[0].pendingStaticEdgesAt1024,0);
});
test('1300 NOPs remains uncategorized as complete after depth 1024',()=>{
 const r=rom(),off=3*0x4000+0x1000;
 r.fill(0,off,off+1300);
 const x=sweep(r,[site(r)]);
 assert.equal(x.verified,true);
 assert.deepEqual(x.levels.map(v=>v.candidateInstructions),[128,256,512,1024]);
 assert.equal(x.entriesStillBudgetExhausted,1);
 assert.equal(x.comparisons[0].budgetExhaustedByDepth[3],true);
});
test('undocumented opcode remains an error, not a path or ROM corruption',()=>{
 const r=rom(),off=3*0x4000+0x1000;r[off]=0xe4;
 const x=sweep(r,[site(r)]);
 assert.equal(x.verified,true);
 assert.equal(x.nonDecodableEntrypoints,1);
 assert.deepEqual(x.comparisons[0].decodedByDepth,[0,0,0,0]);
 assert.equal(x.comparisons[0].decoderFailuresByDepth[3],1);
 assert.equal(x.activeBankVerified,false);
});
test('later undecodable byte is explicitly counted as new decoder evidence',()=>{
 const r=rom(),off=3*0x4000+0x1000;
 r.fill(0,off,off+280);r[off+280]=0xe4;
 const x=sweep(r,[site(r)]);
 assert.equal(x.verified,true);
 assert.deepEqual(x.comparisons[0].decodedByDepth,[128,256,280,280]);
 assert.deepEqual(x.comparisons[0].decoderFailuresByDepth,[0,0,1,1]);
 assert.equal(x.entriesStillBudgetExhausted,0);
});
test('duplicate physical entrypoint stays unique across depths',()=>{
 const r=rom(),x=sweep(r,[site(r),site(r,3,0x5000,0x230)]);
 assert.equal(x.verified,true);
 assert.equal(x.uniquePhysicalEntrypoints,1);
 assert.equal(x.comparisons.length,1);
});
test('multiple physical banks cannot be conflated with observed bank changes',()=>{
 const r=rom();r[3*0x4000+0x1000]=0xe4;
 const x=sweep(r,[site(r,3),site(r,5)]);
 assert.equal(x.verified,true);
 assert.equal(x.uniquePhysicalEntrypoints,2);
 assert.equal(x.nonDecodableEntrypoints,1);
 assert.ok(x.comparisons.every(e=>e.executed===false));
 assert.equal(x.causalLinksVerified,0);
});
test('malformed ROM, mismatched 128 baseline and live claims fail closed',()=>{
 const r=rom(),p=plan([site(r)]);
 const base=auditMbc3RomxBoundedGraph({rom:r,scenarioAtlas:p,
  maxInstructionsPerEntrypoint:48});
 const expansion=auditMbc3RomxGraphExpansion({
  rom:r,scenarioAtlas:p,baselineGraph:base});
 const cases=[
  {rom:Buffer.alloc(10),scenarioAtlas:p,expansion},
  {rom:r,scenarioAtlas:p,expansion:{...expansion,extendedBudget:256}},
  {rom:r,scenarioAtlas:p,expansion:{...expansion,activeBankVerified:true}},
  {rom:r,scenarioAtlas:p,expansion:{...expansion,extendedInstructions:15}},
  {rom:r,scenarioAtlas:p,expansion:{...expansion,comparisons:[]}},
  {rom:r,scenarioAtlas:null,expansion}
 ];
 for(const c of cases)assert.equal(auditMbc3RomxDepthSweep(c).verified,false);
});
