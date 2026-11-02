'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspectScriptStateLiteral,auditScriptedBattleStateWriteContexts}=
 require('../romScriptedBattleWriteContexts');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
function rom(){
 const b=Buffer.alloc(1048576,0xc9);
 const at=24*0x4000+0x110;
 b.set([0x3e,0x02,0xea,0x65,0xd6],at);
 return {b,at:at+2};
}
test('physically decode EA D665 and adjacent LD A immediate without claiming execution',()=>{
 const {b,at}=rom();
 const r=inspectScriptStateLiteral({rom:b,bank:24,fileOffset:at,
  address:0xd665,operation:'WRITE_A'});
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.exactOpcodeBytesHex,'ea65d6');
 assert.equal(r.candidateAssignedValue,2);
 assert.equal(r.immediateSource,'ADJACENT_LD_A_IMMEDIATE_CANDIDATE');
 assert.equal(r.instructionBoundaryFromControlFlowVerified,false);
 assert.equal(r.actualRamWriteVerified,false);
});
test('preceding XOR A provides only candidate zero, not executed branch',()=>{
 const b=Buffer.alloc(1048576,0xc9),at=18*0x4000+0x220;
 b.set([0xaf,0xea,0x5f,0xd6],at);
 const r=inspectScriptStateLiteral({rom:b,bank:18,fileOffset:at+1,
  address:0xd65f,operation:'WRITE_A'});
 assert.equal(r.verified,true);
 assert.equal(r.candidateAssignedValue,0);
 assert.equal(r.immediateSource,'ADJACENT_XOR_A_ZERO_CANDIDATE');
 assert.equal(r.runtimeExecuted,false);
});
test('FA read has exact bank-local byte window but no fictitious written state',()=>{
 const b=Buffer.alloc(1048576,0xc9),at=18*0x4000+0x130;
 b.set([0xfa,0x5f,0xd6],at);
 const r=inspectScriptStateLiteral({rom:b,bank:18,fileOffset:at,
  address:0xd65f,operation:'READ_A'});
 assert.equal(r.verified,true);
 assert.equal(r.exactOpcodeBytesHex,'fa5fd6');
 assert.equal(r.candidateAssignedValue,null);
 assert.equal(r.actualRamWriteVerified,false);
 assert.ok(r.contextBytesHex.startsWith('c9'));
});
test('mismatched physical bytes and bank-crossing candidate fail closed',()=>{
 const {b,at}=rom();
 assert.equal(inspectScriptStateLiteral({rom:b,bank:24,fileOffset:at,
  address:0xd65f,operation:'WRITE_A'}).verified,false);
 assert.equal(inspectScriptStateLiteral({rom:b,bank:23,fileOffset:at,
  address:0xd665,operation:'WRITE_A'}).verified,false);
 b[at]=0x00;
 assert.equal(inspectScriptStateLiteral({rom:b,bank:24,fileOffset:at,
  address:0xd665,operation:'WRITE_A'}).verified,false);
 const x=Buffer.alloc(1048576,0xc9),end=24*0x4000+0x3ffe;
 x[end]=0xea;x[end+1]=0x65;x[end+2]=0xd6;
 assert.equal(inspectScriptStateLiteral({rom:x,bank:24,fileOffset:end,
  address:0xd665,operation:'WRITE_A'}).verified,false);
});
test('untrusted synthetic ROM cannot masquerade as known original for whole catalogue',()=>{
 const {b}=rom();
 assert.equal(auditScriptedBattleStateWriteContexts({
  rom:b,scriptAtlas:{verified:true}}).verified,false);
});
for(const [variant,envName] of [
 ['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('physical '+variant+' ROM: all 11 literal candidates have contexts',
  {skip:!process.env[envName]?'Original ROM required':false},()=>{
   const b=readRom(process.env[envName]);
   const profile=inspectRomBuffer(b,variant+'.gb');
   assert.equal(profile.hash.sha256,KNOWN[variant]);
   const r=profile.world.interactionScriptAtlas.scriptedBattleWriteContexts;
   assert.equal(r.verified,true,r.reason);
   assert.equal(r.decodedCandidateCount,11);
   assert.equal(r.readCandidates,2);
   assert.equal(r.writeCandidates,9);
   assert.deepEqual(r.entries.map(e=>[e.mapId,e.reads.length,e.writes.length]),
    [[96,1,5],[135,1,4]]);
   assert.equal(r.actualScriptStateVerified,false);
   assert.ok(r.entries.every(e=>e.battleWon===null&&
    e.writes.every(w=>w.opcodeDecodesAtOffset&&
     w.instructionBoundaryFromControlFlowVerified===false)));
  });
}
