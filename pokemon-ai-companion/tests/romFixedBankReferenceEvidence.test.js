'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspectFixedRom0Target,inspectFixedRom0TargetAdaptive}=require('../romFixedBankReferenceEvidence');
const {inspectTxAsmHandler}=require('../romTxAsmHandlerAtlas');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const makeRom=()=>Buffer.alloc(1048576);
test('fixed ROM0 direct RET evidence has an actual physical file offset, no execution',()=>{
 const rom=makeRom();rom[0x120]=0xc9;
 const r=inspectFixedRom0Target({rom,targetCpu:0x120});
 assert.equal(r.verified,true);assert.equal(r.physicalRom0Mapped,true);
 assert.equal(r.romFileOffset,0x120);assert.equal(r.opcodeCandidateCount,1);
 assert.equal(r.limitReached,false);
 assert.equal(r.branchExecuted,false);assert.equal(r.effectVerified,false);
 assert.equal(r.semanticsComplete,false);
});
test('ROM0 call into unknown MBC bank cannot inherit source ASM bank',()=>{
 const rom=makeRom();
 rom.set([0xcd,0x00,0x50,0xc9],0x100);
 const r=inspectFixedRom0Target({rom,targetCpu:0x100});
 assert.equal(r.verified,true);assert.equal(r.opcodeCandidateCount,2);
 assert.equal(r.unfollowedCalls,1);
 assert.equal(r.sampleCalls[0].targetRegion,'ROMX_BANK_UNKNOWN');
 assert.equal(r.effectVerified,false);
});
test('ROM0 branch into ROMX remains explicitly unresolved',()=>{
 const rom=makeRom();rom.set([0xc3,0x00,0x50],0x100);
 const r=inspectFixedRom0Target({rom,targetCpu:0x100});
 assert.equal(r.verified,true);
 assert.equal(r.unresolvedCrossRegionTargets,1);
 assert.equal(r.candidateDecodeProblems,1);
 assert.equal(r.limitReached,false);
});
test('long fixed-bank candidate run uses a strict budget, never guesses 100%',()=>{
 const r=inspectFixedRom0Target({rom:makeRom(),targetCpu:0x100,budget:8});
 assert.equal(r.verified,true);assert.equal(r.opcodeCandidateCount,8);
 assert.equal(r.limitReached,true);assert.equal(r.remainingQueue,1);
 assert.equal(r.effectVerified,false);
});
test('bounded analyzer rejects outside ROM0, malformed ROM and invalid budgets',()=>{
 for(const args of [
  {rom:makeRom(),targetCpu:0x4000},
  {rom:makeRom(),targetCpu:-1},
  {rom:Buffer.alloc(32768),targetCpu:0x100},
  {rom:makeRom(),targetCpu:0x100,budget:16385}
 ])assert.equal(inspectFixedRom0Target(args).verified,false);
});
test('ASM source stores every unique fixed-ROM0 branch target, not just samples',()=>{
 const rom=makeRom(),at=0x18000;
 // Branches have two distinct ROM0 destinations through conditional and fallthrough.
 rom.set([0x08,0xc2,0x20,0x01,0xc3,0x30,0x01],at);
 const g=inspectTxAsmHandler({rom,fileOffset:at});
 assert.equal(g.verified,true);
 assert.deepEqual(g.rom0BranchTargetCpus,[0x120,0x130]);
 assert.equal(g.rom0BranchTargetOccurrences,2);
 assert.equal(g.unresolvedReasonCounts.ROM0_OUTSIDE_LOCAL_GRAPH,2);
 assert.equal(g.scriptEffectsVerified,false);
});
test('adaptive ROM0 scan resolves short finite code after first pass reaches cap',()=>{
 const rom=makeRom();
 rom[0x130]=0xc9;
 const r=inspectFixedRom0TargetAdaptive({rom,targetCpu:0x100});
 assert.equal(r.verified,true);
 assert.equal(r.firstPassLimitReached,true);
 assert.equal(r.firstPassCandidateInstructions,24);
 assert.equal(r.candidateExpansionApplied,true);
 assert.equal(r.opcodeCandidateCount,49);
 assert.equal(r.additionalCandidateInstructions,25);
 assert.equal(r.residualLimitReached,false);
 assert.equal(r.effectVerified,false);
 assert.equal(r.branchExecuted,false);
 assert.equal(r.semanticsComplete,false);
});
test('ROM0 whole-bank candidate walk drains a residual 128 scan without inferring effects',()=>{
 const r=inspectFixedRom0TargetAdaptive({rom:makeRom(),targetCpu:0x100});
 assert.equal(r.verified,true);
 assert.equal(r.firstPassLimitReached,true);
 assert.equal(r.firstDeepPassLimitReached,true);
 assert.equal(r.pendingAt128,1);
 assert.deepEqual(r.frontierAt128,[0x180]);
 assert.equal(r.thirdPassApplied,true);
 assert.equal(r.maxInstructionsBudget,16384);
 assert.equal(r.opcodeCandidateCount,16128);
 assert.equal(r.thirdPassAdditionalCandidateInstructions,16000);
 assert.equal(r.additionalCandidateInstructions,16104);
 assert.equal(r.residualLimitReached,false);
 assert.equal(r.fixedBankCandidateWalkExhausted,true);
 assert.equal(r.effectVerified,false);
 assert.equal(r.branchExecuted,false);
 assert.equal(r.semanticsComplete,false);
});
test('adaptive ROM0 scan skips second pass when first pass is sufficient',()=>{
 const rom=makeRom();rom[0x100]=0xc9;
 const r=inspectFixedRom0TargetAdaptive({rom,targetCpu:0x100});
 assert.equal(r.verified,true);
 assert.equal(r.candidateExpansionApplied,false);
 assert.equal(r.maxInstructionsBudget,24);
 assert.equal(r.firstPassLimitReached,false);
 assert.equal(r.additionalCandidateInstructions,0);
});
test('adaptive ROM0 scan rejects invalid budgets and incomplete ROMs',()=>{
 assert.equal(inspectFixedRom0TargetAdaptive({
  rom:makeRom(),targetCpu:0x100,initialBudget:128,deepBudget:128
 }).verified,false);
 assert.equal(inspectFixedRom0TargetAdaptive({
  rom:Buffer.alloc(0),targetCpu:0x100
 }).verified,false);
});
test('ROM0 problem reason counts and location diagnostics stay consistent',()=>{
 const rom=makeRom();rom.set([0xc3,0x00,0x50],0x100);
 const r=inspectFixedRom0TargetAdaptive({rom,targetCpu:0x100});
 assert.equal(r.verified,true);
 assert.equal(r.candidateDecodeProblems,1);
 assert.deepEqual(r.problemReasonCounts,{ROMX_ACTIVE_BANK_UNKNOWN:1});
 assert.deepEqual(r.problemDetails,[{
  pc:0x100,targetCpu:0x5000,reason:'ROMX_ACTIVE_BANK_UNKNOWN'
 }]);
 assert.equal(r.problemDetailsTruncated,false);
 assert.deepEqual(r.remainingQueueSample,[]);
 assert.equal(r.effectVerified,false);
});
test('ROM0 finished static frontier retains pre-128 evidence and no semantic claim',()=>{
 const r=inspectFixedRom0TargetAdaptive({rom:makeRom(),targetCpu:0x100});
 assert.equal(r.verified,true);
 assert.equal(r.thirdPassApplied,true);
 assert.equal(r.pendingAt128,1);
 assert.deepEqual(r.frontierAt128,[0x180]);
 assert.equal(r.residualLimitReached,false);
 assert.equal(r.remainingQueue,0);
 assert.deepEqual(r.remainingQueueSample,[]);
 assert.equal(r.lastCandidateInstructions.length,6);
 assert.equal(r.effectVerified,false);
});
for(const [variant,key] of [['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']]){
 test('original '+variant+' ROM proves all fixed ROM0 physical destinations separately from gameplay effects',
 {skip:!process.env[key]?'Original ROM not provided':false},()=>{
  const rom=readRom(process.env[key]),profile=inspectRomBuffer(rom,variant+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[variant]);
  const scripts=profile.world.interactionScriptAtlas;
  assert.equal(scripts.verified,true);
  const s=scripts.summary;
  assert.equal(s.rom0BranchTargetOccurrences,537);
  assert.equal(s.rom0EffectSemanticsCertified,0);
  assert.equal(s.rom0TargetsWithWorldOrigins,59);
  assert.equal(s.rom0Intermediate128LimitHits,3);
  assert.equal(s.rom0WholeBankPasses,3);
  assert.equal(s.rom0WholeBankResidualLimits,0);
  assert.equal(s.rom0StillBudgetLimited,0);
  assert.equal(s.rom0StaticCandidateWalkExhausted,59);
  assert.ok(s.rom0ThirdPassAdditionalCandidateInstructions>0);
  assert.ok(s.rom0DecodeProblems>=10);
  assert.equal(scripts.fixedRom0BranchEvidence.filter(x=>x.thirdPassApplied).length,3);
  assert.equal(scripts.fixedRom0BranchEvidence.filter(x=>x.residualLimitReached).length,0);
  assert.ok(scripts.fixedRom0BranchEvidence.every(x=>
   Number.isInteger(x.targetCpu)&&x.referencingMapIds.length>0&&
   x.referencingAsmOffsets.length>0&&
   x.referencingMapIds.every(Number.isInteger)&&
   x.referencingAsmOffsets.every(Number.isInteger)&&
   x.problemDetails.length<=32&&
   Object.values(x.problemReasonCounts).reduce((n,v)=>n+v,0)===
    x.candidateDecodeProblems&&
   x.effectVerified===false&&x.branchExecuted===false));
  assert.equal(s.rom0FirstPassLimitHits,13);
  assert.equal(s.rom0ExpandedTargets,13);
  assert.ok(s.rom0AdditionalCandidateInstructions>0);
  assert.equal(s.rom0ExpandedStillLimited,s.rom0StillBudgetLimited);
  assert.ok(s.rom0ExpandedStillLimited<=13);
  assert.equal(s.rom0EffectSemanticsCertified,0);
  assert.equal(scripts.rom0PhysicalAddressMappingCertified,true);
  assert.equal(s.rom0BranchTargetOccurrences,
   s.asmUnresolvedReasonCounts.ROM0_OUTSIDE_LOCAL_GRAPH);
  assert.ok(s.distinctRom0BranchDestinations>0);
  assert.ok(s.distinctRom0BranchDestinations<=537);
  assert.equal(s.rom0CallTargetOccurrences,1016);
  assert.ok(s.distinctRom0CallDestinations>0);
  assert.equal(s.physicallyMappedRom0Targets,s.distinctRom0PhysicalTargets);
  assert.equal(scripts.fixedRom0BranchEvidence.length,s.distinctRom0PhysicalTargets);
  assert.ok(scripts.fixedRom0BranchEvidence.every(x=>
   x.verified===true&&x.physicalRom0Mapped===true&&
   x.romFileOffset===x.targetCpu&&x.effectVerified===false&&
   x.branchExecuted===false));
  assert.equal(scripts.rom0PhysicalAddressMappingCertified,true);
  assert.equal(scripts.scriptEffectsSemanticallyComplete,false);
 });
}
