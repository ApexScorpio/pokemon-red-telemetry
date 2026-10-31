'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {inspectRom0IndirectJump}=require('../rom0IndirectJumpEvidence');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const fake=()=>Buffer.alloc(1048576);
function tableRom(){
 const rom=fake(),at=0x200,jump=at+18,table=0x400;
 rom.set([0xfe,0x03,0xd2,0x60,0x02,0x21,0x00,0x04,
  0xc5,0x87,0x06,0x00,0x4f,0x09,0xc1,0x2a,0x66,0x6f,0xe9],at);
 for(const [i,target] of [0x520,0x540,0x560].entries())
  rom.writeUInt16LE(target,table+2*i);
 return {rom,jump};
}
test('literal table proves three physically bounded candidates, not chosen case',()=>{
 const {rom,jump}=tableRom(),r=inspectRom0IndirectJump({rom,jumpPc:jump});
 assert.equal(r.verified,true);
 assert.equal(r.kind,'GUARDED_ROM0_LITERAL_JUMP_TABLE');
 assert.equal(r.tableCpu,0x400);assert.equal(r.indexBoundExclusive,3);
 assert.equal(r.nonTableBranchCpu,0x260);
 assert.deepEqual(r.candidateTargetsCpu,[0x520,0x540,0x560]);
 assert.equal(r.runtimeTargetKnown,false);
 assert.equal(r.runtimeExecuted,false);
 assert.equal(r.gameEffectVerified,false);
});
test('invalid ROMX table entry is not invented as a ROM0 destination',()=>{
 const {rom,jump}=tableRom();
 rom.writeUInt16LE(0x5000,0x404);
 const r=inspectRom0IndirectJump({rom,jumpPc:jump});
 assert.equal(r.verified,true);assert.equal(r.kind,'UNCLASSIFIED_JP_HL');
 assert.deepEqual(r.candidateTargetsCpu,[]);
 assert.equal(r.gameEffectVerified,false);
});
test('BC and DE return trampolines expose only literal return address',()=>{
 for(const [op,push,reg] of [[0x01,0xc5,'BC'],[0x11,0xd5,'DE']]){
  const rom=fake(),pc=0x321;
  rom.set([op,0x22,0x03,push,0xe9],pc-4);
  const x=inspectRom0IndirectJump({rom,jumpPc:pc});
  assert.equal(x.verified,true);
  assert.equal(x.kind,'PUSH_RETURN_AND_JUMP_RUNTIME_HL');
  assert.equal(x.stackRegister,reg);
  assert.equal(x.returnPc,0x322);
  assert.deepEqual(x.candidateTargetsCpu,[]);
  assert.equal(x.runtimeTargetKnown,false);
 }
});
test('bad PC and missing JP HL fail closed',()=>{
 for(const o of [{rom:fake(),jumpPc:0x123},{rom:fake(),jumpPc:0x4000},
  {rom:Buffer.alloc(32),jumpPc:0x100},{}])
  assert.equal(inspectRom0IndirectJump(o).verified,false);
});
const cases=[
 ['red','POKEMON_RED_ROM',0x1b77,0x1cc1,0x1c31,0x1b8a,0x35e3,0x3e8c],
 ['blue','POKEMON_BLUE_ROM',0x1b77,0x1cc1,0x1c31,0x1b8a,0x35e3,0x3e8c],
 ['green','POKEMON_GREEN_ROM',0x1b5e,0x1ca8,0x1c18,0x1b71,0x35ca,0x3e73]
];
for(const [variant,key,jump,table,escape,first,bc,de] of cases)
 test('ROM original '+variant+' contains exact 14-way table and two HL trampolines',
 {skip:!process.env[key]?'Exact original ROM not provided':false},()=>{
  const rom=readRom(process.env[key]);
  const sha=crypto.createHash('sha256').update(rom).digest('hex');
  assert.equal(sha,KNOWN[variant]);
  const evidence=inspectRom0IndirectJump({rom,jumpPc:jump});
  assert.equal(evidence.verified,true);
  assert.equal(evidence.kind,'GUARDED_ROM0_LITERAL_JUMP_TABLE');
  assert.equal(evidence.indexBoundExclusive,14);
  assert.equal(evidence.tableCpu,table);
  assert.equal(evidence.nonTableBranchCpu,escape);
  assert.equal(evidence.candidateTargetsCpu.length,14);
  assert.equal(evidence.candidateTargetsCpu[0],first);
  assert.ok(evidence.entries.every(x=>x.entryCpu<0x4000&&
   x.targetCpu<0x4000&&x.fixedRom0Candidate===true));
  assert.equal(evidence.runtimeTargetKnown,false);
  assert.equal(evidence.gameEffectVerified,false);
  for(const [pc,register] of [[bc,'BC'],[de,'DE']]){
   const x=inspectRom0IndirectJump({rom,jumpPc:pc});
   assert.equal(x.kind,'PUSH_RETURN_AND_JUMP_RUNTIME_HL');
   assert.equal(x.stackRegister,register);
   assert.equal(x.returnPc,pc+1);
   assert.equal(x.runtimeTargetKnown,false);
   assert.equal(x.gameEffectVerified,false);
  }
 });
