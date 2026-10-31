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
  assert.equal(r.budgetExhausted,false);
  assert.equal(r.staticCandidateQueueExhausted,true);
  assert.equal(r.unresolvedCandidateCount,
   Object.values(r.unresolvedReasonCounts).reduce((n,x)=>n+x,0));
  assert.equal(r.runtimeEffectsVerified,false);
  assert.equal(r.semantic100PercentCertified,false);
  assert.equal(r.activeRomBankKnown,false);
 });
}
