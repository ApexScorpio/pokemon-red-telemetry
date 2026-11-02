'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditTemporaryBattleBitSequence,auditUnboundTrainerTempBattleFlags}=
 require('../romUnboundTrainerTempBattleFlags');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const sequence=Buffer.from([0x21,0x2d,0xd7,0xcb,0xf6,0xcb,0xfe]);
function mock(offset=0x614e6){
 const rom=Buffer.alloc(1048576,0xc9);
 rom[offset]=0x08;sequence.copy(rom,offset+7);
 return rom;
}
test('decodes exact temporary wd72d SET 6 and SET 7, never completed event flags',()=>{
 const offset=0x614e6,rom=mock(offset);
 const x=auditTemporaryBattleBitSequence({rom,fileOffset:offset});
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.bank,24);
 assert.equal(x.loadHlCpu,0x54ed);
 assert.deepEqual(x.mutations.map(x=>[x.bit,x.address,x.physicalOffset]),[
  [6,0xd72d,offset+10],[7,0xd72d,offset+12]]);
 assert.equal(x.directWorldEventBitmapMutation,false);
 assert.equal(x.worldEventBitsRecovered,0);
 assert.ok(x.mutations.every(x=>x.instructionExecuted===false));
});
test('a second bank is decoded from its own physical offset',()=>{
 const offset=0x48e9d,rom=mock(offset);
 const x=auditTemporaryBattleBitSequence({rom,fileOffset:offset});
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.bank,18);
 assert.equal(x.loadHlCpu,0x4ea4);
 assert.equal(x.mutations[0].cpu,0x4ea7);
 assert.equal(x.mutations[1].cpu,0x4ea9);
});
test('mutated opcode or pointer cannot be mistaken for temporary flags',()=>{
 const pos=0x614e6;
 for(const at of [pos,pos+7,pos+8,pos+9,pos+10,pos+11,pos+12,pos+13]){
  const r=mock(pos);r[at]=r[at]===0?1:0;
  assert.equal(auditTemporaryBattleBitSequence({rom:r,fileOffset:pos}).verified,false,
   'mutation at '+at);
 }
 assert.equal(auditTemporaryBattleBitSequence({rom:Buffer.alloc(10),fileOffset:0}).verified,false);
 assert.equal(auditUnboundTrainerTempBattleFlags({rom:mock()}).verified,false);
});
test('physical bank boundary prevents accidental cross-bank decoding',()=>{
 const pos=0x7ffa,rom=Buffer.alloc(1048576,0xc9);
 rom[pos]=0x08;sequence.copy(rom,pos+7);
 assert.equal(auditTemporaryBattleBitSequence({rom,fileOffset:pos}).verified,false);
});
for(const [variant,envName] of [
 ['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('real '+variant+' ROM: both unbound handlers contain transient battle-control bits',
  {skip:!process.env[envName]?'Original ROM required':false},()=>{
   const rom=readRom(process.env[envName]);
   const profile=inspectRomBuffer(rom,variant+'.gb');
   assert.equal(profile.hash.sha256,KNOWN[variant]);
   const ctx=profile.world.interactionScriptAtlas.unboundTrainerTempBattleFlags;
   assert.equal(ctx.verified,true,ctx.reason);
   assert.equal(ctx.handlerCount,2);
   assert.equal(ctx.transientSetBitCandidates,4);
   assert.equal(ctx.temporaryWramAddress,0xd72d);
   assert.deepEqual(ctx.handlers.map(x=>x.scriptFileOffset),
    [0x0614e6,0x048e9d]);
   assert.equal(ctx.worldEventBitsRecovered,0);
   assert.equal(ctx.executed,false);
   assert.ok(ctx.handlers.every(x=>x.eventBitIndex===null&&
    x.trainerVictoryObserved===null&&x.mutations.length===2));
  });
}
