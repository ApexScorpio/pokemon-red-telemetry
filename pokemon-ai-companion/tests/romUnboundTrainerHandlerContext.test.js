'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readPhysicalHandlerWindow,auditUnboundTrainerHandlerContext}=
 require('../romUnboundTrainerHandlerContext');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
test('reads 32 exact physical bytes beginning with TX_START_ASM',()=>{
 const rom=Buffer.alloc(1048576,0xc9),offset=18*0x4000+0xe9d;
 rom[offset]=0x08;rom[offset+1]=0x3e;rom[offset+2]=0x16;
 const x=readPhysicalHandlerWindow({rom,fileOffset:offset});
 assert.equal(x.verified,true);
 assert.equal(x.bank,18);
 assert.equal(x.cpu,0x4e9d);
 assert.equal(x.handlerStartCpu,0x4e9e);
 assert.equal(x.handlerStartFileOffset,offset+1);
 assert.equal(x.sampledBytesHex.slice(0,6),'083e16');
 assert.equal(x.bytesSampled,32);
});
test('bank-local read is truncated instead of crossing into next bank',()=>{
 const rom=Buffer.alloc(1048576,0xc9),offset=8*0x4000+0x3ffe;
 rom[offset]=0x08;rom[offset+1]=0xc9;
 const x=readPhysicalHandlerWindow({rom,fileOffset:offset});
 assert.equal(x.verified,true);
 assert.equal(x.bytesSampled,2);
 assert.equal(x.handlerStartCpu,0x7fff);
 assert.equal(x.sampledBytesHex,'08c9');
});
test('invalid TX_ASM opcode, beyond-bank handler and missing ROM fail closed',()=>{
 const rom=Buffer.alloc(1048576,0xc9);
 assert.equal(readPhysicalHandlerWindow({rom,fileOffset:1}).verified,false);
 rom[0x7fff]=0x08;
 assert.equal(readPhysicalHandlerWindow({rom,fileOffset:0x7fff}).verified,false);
 assert.equal(readPhysicalHandlerWindow({rom:Buffer.alloc(20),fileOffset:0}).verified,false);
 assert.equal(readPhysicalHandlerWindow({rom,fileOffset:0x8000,length:65}).verified,false);
 assert.equal(auditUnboundTrainerHandlerContext({rom}).verified,false);
});
for(const [variant,envName] of [
 ['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('real '+variant+' ROM: exact physical handlers for both unbound trainer scripts',
  {skip:!process.env[envName]?'Original ROM is required':false},()=>{
   const rom=readRom(process.env[envName]);
   const profile=inspectRomBuffer(rom,variant+'.gb');
   assert.equal(profile.hash.sha256,KNOWN[variant]);
   const inspected=auditUnboundTrainerHandlerContext({
    rom,scriptAtlas:profile.world.interactionScriptAtlas});
   assert.equal(inspected.verified,true,inspected.reason);
   assert.equal(inspected.handlerCount,2);
   assert.deepEqual(inspected.handlers.map(x=>x.txAsmFileOffset),
    [0x0614e6,0x048e9d]);
   assert.deepEqual(inspected.handlers.map(x=>x.bank),[24,18]);
   assert.deepEqual(inspected.handlers.map(x=>x.cpu),[0x54e6,0x4e9d]);
   assert.ok(inspected.handlers.every(x=>
    x.txAsmByte===0x08&&x.opcodeCandidateCount>0&&
    x.handlerRuntimeExecuted===false&&x.eventFlagBitIndex===null&&
    x.eventBitRecovered===false&&x.trainerVictoryObserved===null));
   assert.equal(inspected.eventBitsRecovered,0);
   assert.equal(inspected.victoriesObserved,0);
  });
}
