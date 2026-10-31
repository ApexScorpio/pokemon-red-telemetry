'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {traceRom0CallClosure}=require('../rom0CallClosureEvidence');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const fake=(fill=0xc9)=>Buffer.alloc(1048576,fill);
test('ROM0 CALL and RST destinations are followed but no effect is certified',()=>{
 const rom=fake();
 // CALL 0200; RST 38; RET; subroutine RET; RST target RET.
 rom.set([0xcd,0x00,0x02,0xff,0xc9],0x100);
 rom[0x200]=0xc9;rom[0x38]=0xc9;
 const r=traceRom0CallClosure({rom,roots:[0x100,0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.uniqueSeedAddresses,1);
 assert.equal(r.candidateInstructions,5);
 assert.equal(r.traversedDirectCallEdges,1);
 assert.equal(r.traversedRestartEdges,1);
 assert.deepEqual(r.rom0CallTargets,[0x38,0x200]);
 assert.equal(r.remainingQueue,0);
 assert.equal(r.runtimeEffectsVerified,false);
 assert.equal(r.semantic100PercentCertified,false);
 assert.equal(r.executedBranchesVerified,false);
});
test('ROMX bank and JP HL remain explicit unknowns',()=>{
 const rom=fake();rom.set([0xcd,0x00,0x50,0xe9],0x100);
 const r=traceRom0CallClosure({rom,roots:[0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.candidateInstructions,2);
 assert.equal(r.unresolvedRomxTransfers,1);
 assert.equal(r.indirectJumpsUnknown,1);
 assert.equal(r.unresolvedReasonCounts.ROMX_ACTIVE_BANK_UNKNOWN,1);
 assert.equal(r.unresolvedReasonCounts.JP_HL_RUNTIME_TARGET_UNKNOWN,1);
 assert.equal(r.activeRomBankKnown,false);
 assert.equal(r.staticCandidateQueueExhausted,true);
});
test('guarded literal JP HL adds finite ROM0 cases and conditional escape only',()=>{
 const rom=fake(),at=0x200,jump=at+18;
 rom.set([0xfe,0x03,0xd2,0x60,0x02,0x21,0x00,0x04,
  0xc5,0x87,0x06,0x00,0x4f,0x09,0xc1,0x2a,0x66,0x6f,0xe9],at);
 for(const [i,cpu] of [0x520,0x540,0x560].entries())
  rom.writeUInt16LE(cpu,0x400+i*2);
 const r=traceRom0CallClosure({rom,roots:[jump]});
 assert.equal(r.verified,true);
 assert.equal(r.candidateInstructions,5);
 assert.equal(r.boundedIndirectTables.length,1);
 assert.equal(r.boundedIndirectCaseEdges,3);
 assert.equal(r.boundedIndirectFallbackEdges,1);
 assert.equal(r.boundedIndirectCandidateEdges,4);
 assert.deepEqual(r.boundedIndirectTables[0].caseTargetsCpu,[0x520,0x540,0x560]);
 assert.equal(r.boundedIndirectTables[0].alternateNonTableBranchCpu,0x260);
 assert.equal(r.indirectJumpsUnknown,1);
 assert.equal(r.unresolvedReasonCounts.JP_HL_BOUNDED_TABLE_RUNTIME_INDEX_UNKNOWN,1);
 assert.equal(r.allIndirectRuntimeTargetsVerified,false);
 assert.equal(r.runtimeEffectsVerified,false);
});
test('malformed JP HL table is not treated as a bounded physical target',()=>{
 const rom=fake(),at=0x200,jump=at+18;
 rom.set([0xfe,0x03,0xd2,0x60,0x02,0x21,0x00,0x04,
  0xc5,0x87,0x06,0x00,0x4f,0x09,0xc1,0x2a,0x66,0x6f,0xe9],at);
 for(const [i,cpu] of [0x520,0x540,0x5000].entries())
  rom.writeUInt16LE(cpu,0x400+i*2);
 const r=traceRom0CallClosure({rom,roots:[jump]});
 assert.equal(r.verified,true);
 assert.equal(r.boundedIndirectTables.length,0);
 assert.equal(r.boundedIndirectCandidateEdges,0);
 assert.equal(r.candidateInstructions,1);
 assert.equal(r.unresolvedReasonCounts.JP_HL_RUNTIME_TARGET_UNKNOWN,1);
 assert.equal(r.runtimeEffectsVerified,false);
});
test('literal BC/DE HL return trampolines do not fabricate destination',()=>{
 const rom=fake();
 rom.set([0x01,0x22,0x03,0xc5,0xe9],0x31d);
 const r=traceRom0CallClosure({rom,roots:[0x321]});
 assert.equal(r.verified,true);
 assert.equal(r.indirectReturnTrampolines.length,1);
 assert.equal(r.indirectReturnTrampolines[0].stackRegister,'BC');
 assert.equal(r.indirectReturnTrampolines[0].returnPc,0x322);
 assert.equal(r.boundedIndirectCandidateEdges,0);
 assert.equal(r.unresolvedReasonCounts.JP_HL_REGISTER_DESTINATION_UNKNOWN,1);
});
test('ROMX call source keeps an auditable seed-to-call witness and 63 physical banks',()=>{
 const rom=fake(0xd3);
 rom.set([0xcd,0x00,0x02,0xc9],0x100);
 rom.set([0xc3,0x00,0x50],0x200);
 // The isolated first opcode at bank 7 happens to decode. This says
 // nothing about bank selection or whether its bytes represent code.
 const bank=7,offset=bank*0x4000+0x1000;
 rom[offset]=0xc9;
 const r=traceRom0CallClosure({rom,roots:[0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.unresolvedRomxTransfers,1);
 assert.equal(r.romxTransferSites.length,1);
 assert.equal(r.romxPhysicalMappingsTotal,63);
 const site=r.romxTransferSites[0];
 assert.equal(site.fromRom0Cpu,0x200);
 assert.equal(site.opcode,0xc3);
 assert.equal(site.transferKind,'absolute');
 assert.equal(site.targetCpu,0x5000);
 assert.equal(site.originRootCpu,0x100);
 assert.deepEqual(site.witnessPath,[
  {pc:0x100,via:'ROOT'}, {pc:0x200,via:'call'}
 ]);
 assert.equal(site.physicallyMappedBanks,63);
 assert.equal(site.firstOpcodeDecodableBanks,1);
 assert.deepEqual(site.physicalMappings.filter(x=>x.firstOpcodeDecodable),[
  {bank:7,fileOffset:offset,selectableIfStandardMbc1:null,
   selectableIfDeclaredMapper:null,firstOpcodeDecodable:true}
 ]);
 // Unsupported synthetic header must not cause invented ROMX exclusions.
 assert.equal(site.standardMbc1Conditional,false);
 assert.deepEqual(site.excludedIfStandardMbc1,[]);
 assert.equal(site.conditionalCandidateCount,null);
 assert.equal(site.activeBankKnown,false);
 assert.equal(site.selectedFileOffset,null);
 assert.equal(site.transferExecuted,false);
 assert.equal(site.gameEffectVerified,false);
 assert.equal(r.romxActiveBanksVerified,0);
});
test('ROMX branch classification never invents selected MBC bank',()=>{
 const rom=fake();rom[0x147]=3;rom[0x148]=5;
 rom.set([0xc3,0x00,0x50],0x100);
 const r=traceRom0CallClosure({rom,roots:[0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.romxPhysicalMappingsTotal,63);
 assert.equal(r.romxStandardMbc1ConditionalSites,1);
 assert.equal(r.romxHeaderConditionalExcludedMappingsTotal,1);
 const site=r.romxTransferSites[0];
 assert.deepEqual(site.excludedIfStandardMbc1,[32]);
 assert.equal(site.conditionalCandidateCount,62);
 assert.equal(site.physicalMappings[31].selectableIfStandardMbc1,false);
 assert.equal(site.activeBankKnown,false);
 assert.equal(r.semantic100PercentCertified,false);
});
test('ROM0 jump to ROMX retains MBC3 header and all 63 static bank candidates',()=>{
 const rom=fake();rom[0x147]=0x13;rom[0x148]=0x05;
 rom.set([0xc3,0x00,0x50],0x100);
 const r=traceRom0CallClosure({rom,roots:[0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.romxMapperFamilySiteCounts.MBC3,1);
 assert.equal(r.romxMbc5BankZeroCandidateSites,0);
 assert.equal(r.romxTransferSites[0].declaredMapperRomxCandidateCount,63);
 assert.equal(r.romxTransferSites[0].activeBankKnown,false);
 assert.equal(r.runtimeEffectsVerified,false);
});
test('ROM0 jump to ROMX can include physical bank zero under MBC5 declaration',()=>{
 const rom=fake();rom[0x147]=0x1b;rom[0x148]=0x05;
 rom.set([0xc3,0x00,0x50],0x100);
 const r=traceRom0CallClosure({rom,roots:[0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.romxMapperFamilySiteCounts.MBC5,1);
 assert.equal(r.romxMbc5BankZeroCandidateSites,1);
 assert.equal(r.romxTransferSites[0].mbc5BankZeroCandidate.fileOffset,0x1000);
 assert.equal(r.romxTransferSites[0].declaredMapperRomxCandidateCount,64);
 assert.equal(r.romxActiveBanksVerified,0);
});
test('ROM0 candidate MBC3 literal writes preserve CALL-root witness and unknown A',()=>{
 const rom=fake();rom[0x147]=0x13;rom[0x148]=5;
 rom.set([0xcd,0x00,0x02,0xc9],0x100);
 rom.set([0x3e,0x07,0xea,0x00,0x20,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.mbc3DirectWriteSiteCount,1);
 assert.equal(r.mbc3LiteralRomBankWriteSites,1);
 assert.equal(r.mbc3DirectWritesExecuted,0);
 assert.equal(r.mbc3BankValuesRuntimeVerified,0);
 assert.equal(r.mbc3IndirectWriteCoverageComplete,false);
 const s=r.mbc3DirectWriteSites[0];
 assert.equal(s.rom0Pc,0x202);
 assert.deepEqual(s.witnessPath,[
  {pc:0x100,via:'ROOT'}, {pc:0x200,via:'call'},
  {pc:0x202,via:'fallthrough'}
 ]);
 assert.equal(s.literalTargets[0].targetCpu,0x2000);
 assert.equal(s.literalTargets[0].bankSelected,null);
 assert.equal(s.runtimeValueKnown,false);
 assert.equal(s.executed,false);
 assert.equal(r.semantic100PercentCertified,false);
});
test('adjacent HL literal + indirect write classified only along a fallthrough witness',()=>{
 const rom=fake();rom[0x147]=0x13;rom[0x148]=5;
 rom.set([0x21,0x00,0x20,0x77,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 assert.equal(r.verified,true);
 assert.equal(r.mbc3DirectWriteSiteCount,0);
 assert.equal(r.mbc3AdjacentIndirectWriteSiteCount,1);
 assert.equal(r.mbc3AdjacentIndirectRomBankWriteSites,1);
 assert.equal(r.mbc3AdjacentIndirectWriteSites[0].targetCpu,0x2000);
 assert.equal(r.mbc3AdjacentIndirectWriteSites[0].executed,false);
 assert.equal(r.mbc3BankValuesRuntimeVerified,0);
 assert.equal(r.mbc3IndirectWriteCoverageComplete,false);
});
test('adjacent literal A before EA records possible byte but not selected bank',()=>{
 const rom=fake();rom[0x147]=0x13;rom[0x148]=5;
 rom.set([0x3e,0x07,0xea,0x00,0x20,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 assert.equal(r.verified,true);
 assert.equal(r.mbc3DirectWriteSiteCount,1);
 assert.equal(r.mbc3DirectLiteralAProvenanceSites,1);
 assert.equal(r.mbc3DirectWriteSites[0].adjacentLiteralAProvenance.conditionalImmediateAValue,7);
 assert.equal(r.mbc3DirectWriteSites[0].executed,false);
 assert.equal(r.romxActiveBanksVerified,0);
});
test('MBC3 linear A provenance survives harmless instruction and stops at modifiers',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0x3e,7,0x06,2,0xea,0,0x20,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 assert.equal(r.verified,true);assert.equal(r.mbc3ABoundedImmediateSites,1);
 assert.equal(r.mbc3ABoundedRegisterOrMemorySites,0);assert.equal(r.mbc3AUnresolvedSites,0);
 assert.equal(r.mbc3DirectWriteSites[0].aSourceProvenance.sourcePc,0x200);
 assert.equal(r.mbc3DirectWriteSites[0].aSourceProvenance.conditionalByte,7);
 assert.equal(r.mbc3DirectWriteSites[0].aSourceProvenance.executed,false);
 assert.equal(r.romxActiveBanksVerified,0);
});
test('MBC3 linear A analysis rejects INC A without false bank selection',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0x3e,7,0x3c,0xea,0,0x20,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 assert.equal(r.mbc3ABoundedImmediateSites,0);assert.equal(r.mbc3AUnresolvedSites,1);
 assert.equal(r.mbc3DirectWriteSites[0].aSourceProvenance.conditionalByte,null);
 assert.equal(r.runtimeEffectsVerified,false);
});
test('MBC3 register-input lineage maps B immediate via LD A,B to EA without claiming execution',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0x06,0x15,0x78,0xea,0,0x20,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 assert.equal(r.verified,true);
 assert.equal(r.mbc3RegisterInputTracedSites,1);
 assert.equal(r.mbc3RegisterInputConditionalByteSites,1);
 assert.equal(r.mbc3RegisterInputUnresolvedSites,0);
 const s=r.mbc3DirectWriteSites[0];
 assert.equal(s.aSourceProvenance.sourceRegister,'B');
 assert.equal(s.registerInputProvenance.originPc,0x200);
 assert.equal(s.registerInputProvenance.conditionalByte,0x15);
 assert.equal(s.registerInputProvenance.executed,false);
 assert.equal(s.registerInputProvenance.activeBankKnown,false);
 assert.equal(r.romxActiveBanksVerified,0);
});
test('MBC3 changed B register keeps value unknown at EA',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0x06,0x15,0x04,0x78,0xea,0,0x20,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 assert.equal(r.mbc3RegisterInputTracedSites,1);
 assert.equal(r.mbc3RegisterInputConditionalByteSites,0);
 assert.equal(r.mbc3RegisterInputUnresolvedSites,1);
 assert.equal(r.mbc3DirectWriteSites[0].registerInputProvenance.conditionalByte,null);
 assert.equal(r.mbc3DirectWritesExecuted,0);
});
test('MBC3 source observation plan lists WRAM byte without accessing emulator',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0xfa,0x23,0xd1,0xea,0,0x20,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 assert.equal(r.verified,true);
 const plan=r.mbc3SourceObservationPlan;
 assert.equal(plan.verified,true);
 assert.deepEqual(plan.uniqueRamAddresses,[0xd123]);
 assert.equal(plan.runtimeReadCount,0);
 assert.equal(plan.runtimeBankVerified,false);
 assert.equal(plan.sites[0].executed,false);
});
test('MBC3 register-indirect source is not presumed a RAM address',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0x0a,0xea,0,0x20,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 assert.equal(r.mbc3SourceObservationPlan.verified,true);
 assert.equal(r.mbc3SourceObservationPlan.sites[0].memoryPointerUnknown,true);
 assert.deepEqual(r.mbc3SourceObservationPlan.uniqueRamAddresses,[]);
 assert.equal(r.romxActiveBanksVerified,0);
});
test('MBC3 immediate A write exposes a conditional ROMX bank but no active bank',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0x3e,0x05,0xea,0x00,0x20,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 assert.equal(r.verified,true);
 const bank=r.mbc3ConditionalRomBankCandidates;
 assert.equal(bank.verified,true);
 assert.equal(bank.candidateByteSites,1);
 assert.deepEqual(bank.distinctConditionalBanksInFile,[5]);
 assert.equal(bank.candidates[0].physicalBankStartOffset,5*0x4000);
 assert.equal(bank.candidates[0].executed,false);
 assert.equal(bank.activeBankVerified,false);
 assert.equal(bank.linkedRomxTransferSites,0);
 assert.equal(r.romxActiveBanksVerified,0);
});
test('MBC3 zero literal source maps only to conditional bank 1',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0xaf,0xea,0x00,0x20,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 const bank=r.mbc3ConditionalRomBankCandidates;
 assert.equal(bank.verified,true);
 assert.equal(bank.candidates[0].selectedBankIfExecuted,1);
 assert.equal(bank.zeroAliasSites,1);
 assert.equal(bank.executedBankWrites,0);
 assert.equal(bank.activeBankVerified,false);
});
test('ROMX conditional cross product computes physical target from an earlier static bank write',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0x3e,0x03,0xea,0x00,0x20,0xcd,0x00,0x50,0xc9],0x200);
 rom[3*0x4000+0x1000]=0xf3;
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 assert.equal(r.verified,true);
 const atlas=r.mbc3RomxPhysicalScenarios;
 assert.equal(atlas.verified,true);
 assert.equal(atlas.transferSites,1);
 assert.equal(atlas.scenarioCount,1);
 assert.equal(atlas.scenarios[0].candidateBankIfExecuted,3);
 assert.equal(atlas.scenarios[0].physicalFileOffset,3*0x4000+0x1000);
 assert.equal(atlas.scenarios[0].physicalFirstOpcodeByte,0xf3);
 assert.equal(atlas.sameStaticWitnessPairs,1);
 assert.equal(atlas.scenarios[0].causalLinkVerified,false);
 assert.equal(r.romxActiveBanksVerified,0);
});
test('unrelated bank source and ROMX transfer remain a noncausal cross product',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0xcd,0x00,0x50,0xc9],0x300);
 rom.set([0x3e,0x05,0xea,0x00,0x20,0xc9],0x400);
 const r=traceRom0CallClosure({rom,roots:[0x300,0x400]});
 const atlas=r.mbc3RomxPhysicalScenarios;
 assert.equal(atlas.verified,true);
 assert.equal(atlas.scenarioCount,1);
 assert.equal(atlas.sameStaticWitnessPairs,0);
 assert.equal(atlas.scenarios[0].sameStaticWitnessIncludesWrite,false);
 assert.equal(atlas.scenarios[0].causalLinkVerified,false);
 assert.equal(atlas.executedTransfers,0);
});
test('ROMX opcode audit isolates invalid first-byte candidate without asserting execution',()=>{
 const rom=fake();rom[0x147]=19;rom[0x148]=5;
 rom.set([0x3e,0x03,0xea,0,0x20,0xcd,0,0x50,0xc9],0x200);
 rom[3*0x4000+0x1000]=0xd3;
 const r=traceRom0CallClosure({rom,roots:[0x200]});
 const audit=r.mbc3RomxOpcodeAudit;
 assert.equal(audit.verified,true);
 assert.equal(audit.scenariosAudited,1);
 assert.equal(audit.notDecodableCount,1);
 assert.equal(audit.notDecodable[0].reason,'undocumented opcode');
 assert.equal(audit.activeBankVerified,false);
 assert.equal(audit.notDecodable[0].transferExecuted,false);
});
test('unsupported MBC header cannot generate fictitious literal register writes',()=>{
 const rom=fake();rom[0x147]=0x03;rom[0x148]=5;
 rom.set([0xea,0x00,0x20,0xc9],0x100);
 const r=traceRom0CallClosure({rom,roots:[0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.mbc3DirectWriteSiteCount,0);
 assert.equal(r.mbc3LiteralRomBankWriteSites,0);
});
test('all JP HL sites preserve witness and unknown runtime selection',()=>{
 const rom=fake();
 rom.set([0xcd,0x00,0x02,0xc9],0x100);
 rom[0x200]=0xe9;
 const r=traceRom0CallClosure({rom,roots:[0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.indirectSiteDetails.length,1);
 assert.deepEqual(r.indirectSiteDetails[0].witnessPath,[
  {pc:0x100,via:'ROOT'}, {pc:0x200,via:'call'}
 ]);
 assert.equal(r.indirectSiteDetails[0].kind,'UNCLASSIFIED_JP_HL');
 assert.equal(r.indirectSiteDetails[0].runtimeTargetKnown,false);
});
test('recursive CALL cycles terminate without inventing execution',()=>{
 const rom=fake();
 rom.set([0xcd,0x00,0x02,0xc9],0x100);
 rom.set([0xcd,0x00,0x01,0xc9],0x200);
 const r=traceRom0CallClosure({rom,roots:[0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.candidateInstructions,4);
 assert.equal(r.traversedDirectCallEdges,2);
 assert.deepEqual(r.rom0CallTargets,[0x100,0x200]);
 assert.equal(r.budgetExhausted,false);
});
test('candidate overlap is diagnosed, not interpreted twice',()=>{
 const rom=fake();rom.set([0xc3,0x01,0x01],0x100);
 const r=traceRom0CallClosure({rom,roots:[0x100]});
 assert.equal(r.verified,true);
 assert.equal(r.candidateInstructions,1);
 assert.equal(r.unresolvedReasonCounts.OVERLAPPING_OPCODE_CANDIDATES,1);
 assert.equal(r.semantic100PercentCertified,false);
});
test('instruction-budget stop explicitly retains the unfinished frontier',()=>{
 const rom=fake(0x00);
 const r=traceRom0CallClosure({rom,roots:[0x100],maxInstructions:3});
 assert.equal(r.verified,true);
 assert.equal(r.candidateInstructions,3);
 assert.equal(r.remainingQueue,1);
 assert.equal(r.budgetExhausted,true);
 assert.equal(r.staticCandidateQueueExhausted,false);
});
test('invalid inputs fail closed and never claim ROM completion',()=>{
 const rom=fake();
 for(const request of [
  {},{rom:Buffer.alloc(1024),roots:[0x100]},
  {rom,roots:[]},{rom,roots:[-1]},
  {rom,roots:[0x4000]},{rom,roots:[1.5]},
  {rom,roots:[0x100],maxInstructions:0},
  {rom,roots:[0x100],maxInstructions:16385}
 ]){
  const r=traceRom0CallClosure(request);
  assert.equal(r.verified,false);
  assert.equal(r.semantic100PercentCertified,false);
 }
});
for(const [variant,name] of [
 ['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('exact '+variant+' ROM: follow all 59 audited ROM0 roots, preserve uncertainty',
 {skip:!process.env[name]?'Exact original ROM path required':false},()=>{
  const rom=readRom(process.env[name]);
  const profile=inspectRomBuffer(rom,variant+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[variant]);
  const scripts=profile.world.interactionScriptAtlas;
  assert.equal(scripts.verified,true);
  const roots=scripts.fixedRom0BranchEvidence.map(x=>x.targetCpu);
  assert.equal(roots.length,59);
  const r=traceRom0CallClosure({rom,roots});
  assert.equal(r.verified,true,r.reason);
  assert.equal(r.uniqueSeedAddresses,59);
  assert.ok(r.candidateInstructions>0);
  assert.ok(r.boundedIndirectTables.length>=1);
  const expectedJump=variant==='green'?0x1b5e:0x1b77;
  const knownTable=r.boundedIndirectTables.find(x=>x.jumpPc===expectedJump);
  assert.ok(knownTable,'The 14-entry ROM0 table must be a static candidate');
  assert.equal(knownTable.indexBoundExclusive,14);
  assert.equal(knownTable.caseTargetsCpu.length,14);
  assert.equal(knownTable.runtimeIndexKnown,false);
  assert.equal(r.allIndirectRuntimeTargetsVerified,false);
  assert.equal(r.boundedIndirectCandidateEdges,
   r.boundedIndirectCaseEdges+r.boundedIndirectFallbackEdges);
  assert.equal(r.unresolvedRomxTransfers,12);
  assert.equal(r.romxTransferSites.length,12);
  assert.equal(r.romxPhysicalMappingsTotal,12*63);
  assert.equal(r.romxActiveBanksVerified,0);
  assert.equal(r.indirectSiteDetails.length,r.indirectJumpsUnknown);
  assert.ok(r.romxTransferSites.every(site=>
   site.physicallyMappedBanks===63&&site.activeBankKnown===false&&
   site.selectedFileOffset===null&&site.transferExecuted===false&&
   site.gameEffectVerified===false&&
   site.witnessPath.length>0&&
   site.witnessPath[0].pc===site.originRootCpu));
  assert.equal(r.budgetExhausted,r.remainingQueue>0);
  assert.equal(r.staticCandidateQueueExhausted,!r.budgetExhausted);
  assert.equal(r.unresolvedCandidateCount,
   Object.values(r.unresolvedReasonCounts).reduce((n,x)=>n+x,0));
  assert.equal(r.runtimeEffectsVerified,false);
  assert.equal(r.semantic100PercentCertified,false);
  assert.equal(r.activeRomBankKnown,false);
 });
}
