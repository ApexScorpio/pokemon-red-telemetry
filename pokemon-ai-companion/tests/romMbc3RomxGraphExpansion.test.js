'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditMbc3RomxBoundedGraph}=require('../romMbc3RomxBoundedGraph');
const {auditMbc3RomxGraphExpansion}=require('../romMbc3RomxGraphExpansion');
const rom=()=>{const b=Buffer.alloc(1048576,0xc9);b[0x147]=0x13;b[0x148]=5;return b;};
const site=(b,bank=3,pc=0x5000,writePc=0x200)=>({
 rom0TransferPc:0x210,candidateWritePc:writePc,candidateBankIfExecuted:bank,
 romxTargetCpu:pc,physicalFileOffset:bank*0x4000+pc-0x4000,
 physicalFirstOpcodeByte:b[bank*0x4000+pc-0x4000],
 bankWriteExecuted:false,transferExecuted:false,
 activeBankVerified:false,causalLinkVerified:false});
const atlas=s=>({verified:true,scenarios:s,scenarioCount:s.length,
 activeBanksVerified:0,executedTransfers:0});
function review(b,sites){
 const scenarioAtlas=atlas(sites);
 const baselineGraph=auditMbc3RomxBoundedGraph({
  rom:b,scenarioAtlas,maxInstructionsPerEntrypoint:48});
 return auditMbc3RomxGraphExpansion({rom:b,scenarioAtlas,baselineGraph});
}
test('already closed graph has zero gain and is not called runtime code',()=>{
 const b=rom(),r=review(b,[site(b)]);
 assert.equal(r.verified,true);assert.equal(r.entriesCompared,1);
 assert.equal(r.baselineInstructions,1);
 assert.equal(r.extendedInstructions,1);
 assert.equal(r.addedCandidateInstructions,0);
 assert.equal(r.executedInstructions,0);
 assert.equal(r.activeBankVerified,false);
});
test('90 NOPs then RET: 48 budget capped, 128 completes and adds 43',()=>{
 const b=rom(),at=3*0x4000+0x1000;
 b.fill(0,at,at+90);b[at+90]=0xc9;
 const r=review(b,[site(b)]);
 assert.equal(r.verified,true);
 assert.equal(r.baselineInstructions,48);
 assert.equal(r.extendedInstructions,91);
 assert.equal(r.addedCandidateInstructions,43);
 assert.equal(r.baselineExhaustedEntries,1);
 assert.equal(r.extendedExhaustedEntries,0);
 assert.equal(r.previouslyExhaustedNowTerminated,1);
});
test('long linear path remains explicitly unclosed at 128',()=>{
 const b=rom(),at=3*0x4000+0x1000;
 b.fill(0,at,at+180);
 const r=review(b,[site(b)]);
 assert.equal(r.baselineInstructions,48);
 assert.equal(r.extendedInstructions,128);
 assert.equal(r.addedCandidateInstructions,80);
 assert.equal(r.extendedExhaustedEntries,1);
 assert.equal(r.comparisons[0].budget128Exhausted,true);
 assert.ok(r.comparisons[0].unresolvedStaticEdges128>0);
});
test('undocumented opcode remains zero decoded, never made valid by budget',()=>{
 const b=rom(),at=3*0x4000+0x1000;
 b[at]=0xe4;
 const r=review(b,[site(b)]);
 assert.equal(r.verified,true);
 assert.equal(r.baselineInstructions,0);
 assert.equal(r.extendedInstructions,0);
 assert.equal(r.nonDecodableEntrypoints,1);
 assert.equal(r.comparisons[0].firstOpcodeDecodable,false);
});
test('newly exposed invalid opcode is recorded as newly observed decoder failure',()=>{
 const b=rom(),at=3*0x4000+0x1000;
 b.fill(0,at,at+55);b[at+55]=0xe4;
 const r=review(b,[site(b)]);
 assert.equal(r.verified,true);
 assert.equal(r.newDecodeFailureEntries,1);
 assert.equal(r.comparisons[0].decoderFailures48,0);
 assert.equal(r.comparisons[0].decoderFailures128,1);
 assert.equal(r.comparisons[0].addedCandidateInstructions,7);
});
test('duplicate bank and CPU targets are compared once without erasing witnesses',()=>{
 const b=rom();
 const r=review(b,[site(b,3,0x5000,0x200),site(b,3,0x5000,0x300)]);
 assert.equal(r.entriesCompared,1);
 assert.equal(r.extendedInstructions,1);
});
test('multiple banks preserve per-entry identity and same ROM0 branch uncertainty',()=>{
 const b=rom(),a=3*0x4000+0x1000,c=5*0x4000+0x1000;
 b.set([0xcd,0x00,0x01,0xc9],a);
 b[c]=0xe4;
 const r=review(b,[site(b,3),site(b,5)]);
 assert.equal(r.entriesCompared,2);
 assert.equal(r.extendedBranchesToRom0NotFollowed,1);
 assert.equal(r.nonDecodableEntrypoints,1);
 assert.ok(r.comparisons.every(x=>x.causalLinkVerified===false));
});
test('fake 48-instruction baseline, bad header and missing manifest fail closed',()=>{
 const b=rom(),s=atlas([site(b)]);
 const base=auditMbc3RomxBoundedGraph({rom:b,scenarioAtlas:s});
 const invalid=[
  {rom:b,scenarioAtlas:s,baselineGraph:{...base,totalDecodedCandidateInstructions:999}},
  {rom:b,scenarioAtlas:s,baselineGraph:{...base,maxInstructionsPerEntrypoint:128}},
  {rom:b,scenarioAtlas:s,baselineGraph:{...base,entryResults:[]}},
  {rom:Buffer.alloc(10),scenarioAtlas:s,baselineGraph:base},
  {rom:b,scenarioAtlas:null,baselineGraph:base}
 ];
 for(const options of invalid)
  assert.equal(auditMbc3RomxGraphExpansion(options).verified,false);
});
