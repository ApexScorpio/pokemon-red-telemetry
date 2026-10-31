'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyMbc3Rom0LiteralWrites,classifyMbc3AdjacentImmediateA,
 classifyMbc3AdjacentIndirectWrite}=require('../romMbc3RegisterEvidence');
const make=()=>{const rom=Buffer.alloc(1048576,0xc9);
 rom[0x147]=0x13;rom[0x148]=0x05;return rom;};
test('EA literal bank select is static register evidence, never bank selection',()=>{
 const rom=make();rom.set([0xea,0x00,0x20],0x200);
 const r=classifyMbc3Rom0LiteralWrites({rom,pc:0x200});
 assert.equal(r.verified,true);
 assert.equal(r.candidates.length,1);
 assert.equal(r.candidates[0].registerKind,'ROM_BANK_NUMBER');
 assert.equal(r.candidates[0].targetCpu,0x2000);
 assert.equal(r.candidates[0].valueSource,'A');
 assert.equal(r.candidates[0].valueKnown,false);
 assert.equal(r.candidates[0].bankSelected,null);
 assert.equal(r.executed,false);
 assert.equal(r.activeBankKnown,false);
});
test('EA all four MBC3 control regions are classified without a chosen value',()=>{
 for(const [address,kind] of [
  [0x0000,'RAM_RTC_ENABLE'],[0x3fff,'ROM_BANK_NUMBER'],
  [0x5fff,'RAM_BANK_OR_RTC_SELECT'],[0x7fff,'RTC_LATCH']]){
  const rom=make();rom[0x300]=0xea;rom.writeUInt16LE(address,0x301);
  const r=classifyMbc3Rom0LiteralWrites({rom,pc:0x300});
  assert.equal(r.candidates[0].registerKind,kind);
  assert.equal(r.candidates[0].valueKnown,false);
 }
});
test('08 absolute SP write exposes two literal adjacent addresses safely',()=>{
 const rom=make();rom.set([0x08,0xff,0x3f],0x250);
 const r=classifyMbc3Rom0LiteralWrites({rom,pc:0x250});
 assert.equal(r.verified,true);
 assert.deepEqual(r.candidates.map(x=>x.targetCpu),[0x3fff,0x4000]);
 assert.deepEqual(r.candidates.map(x=>x.registerKind),
  ['ROM_BANK_NUMBER','RAM_BANK_OR_RTC_SELECT']);
 assert.ok(r.candidates.every(x=>x.valueKnown===false&&x.executed===false));
});
test('non-MBC3, indirect opcode, ROMX or truncated ROM0 fail closed',()=>{
 for(const modify of [
  rom=>{rom[0x147]=0x03;rom[0x200]=0xea;},
  rom=>{rom[0x200]=0x77;},
  rom=>{rom[0x200]=0xea;rom[0x148]=0x06;}
 ]){
  const rom=make();modify(rom);
  assert.equal(classifyMbc3Rom0LiteralWrites({rom,pc:0x200}).verified,false);
 }
 for(const o of [{},{rom:make(),pc:0x3ffe},
  {rom:Buffer.alloc(32768),pc:0x200}]){
  assert.equal(classifyMbc3Rom0LiteralWrites(o).verified,false);
 }
});

test('adjacent LD A,d8 and EA yields a conditional literal, never live bank',()=>{
 const rom=make();rom.set([0x3e,0x09,0xea,0x00,0x20],0x200);
 const r=classifyMbc3AdjacentImmediateA({rom,previousPc:0x200,pc:0x202});
 assert.equal(r.verified,true);
 assert.equal(r.conditionalImmediateAValue,9);
 assert.equal(r.runtimeValueKnown,false);
 assert.equal(r.activeBankKnown,false);
 assert.equal(classifyMbc3AdjacentImmediateA({rom,previousPc:0x201,pc:0x202}).verified,false);
});
test('adjacent HL=2000 and indirect A store keeps address without inventing value',()=>{
 const rom=make();rom.set([0x21,0x00,0x20,0x77],0x200);
 const r=classifyMbc3AdjacentIndirectWrite({rom,previousPc:0x200,pc:0x203});
 assert.equal(r.verified,true);
 assert.equal(r.targetCpu,0x2000);
 assert.equal(r.registerKind,'ROM_BANK_NUMBER');
 assert.equal(r.valueSource,'A');
 assert.equal(r.conditionalImmediateByte,null);
 assert.equal(r.executed,false);
});
test('HL immediate store captures possible byte, BC DE and HL increment classify',()=>{
 for(const [load,write,kind] of [
  [0x21,0x22,'HL_POST_INC'],[0x21,0x32,'HL_POST_DEC'],
  [0x01,0x02,'BC'],[0x11,0x12,'DE']
 ]){
  const rom=make();rom.set([load,0x00,0x20,write],0x200);
  const r=classifyMbc3AdjacentIndirectWrite({rom,previousPc:0x200,pc:0x203});
  assert.equal(r.verified,true);
  assert.equal(r.mode,kind);
  assert.equal(r.targetCpu,0x2000);
  assert.equal(r.conditionalImmediateByte,null);
 }
 const rom=make();rom.set([0x21,0x00,0x20,0x36,0x15],0x200);
 const r=classifyMbc3AdjacentIndirectWrite({rom,previousPc:0x200,pc:0x203});
 assert.equal(r.verified,true);
 assert.equal(r.valueSource,'IMM8');
 assert.equal(r.conditionalImmediateByte,0x15);
 assert.equal(r.activeBankKnown,false);
});
test('indirect inference rejects wrong address load, gap, wrong header and boundary',()=>{
 const rom=make();rom.set([0x21,0x00,0x20,0x77],0x200);
 assert.equal(classifyMbc3AdjacentIndirectWrite({rom,previousPc:0x201,pc:0x203}).verified,false);
 assert.equal(classifyMbc3AdjacentIndirectWrite({rom,previousPc:0x200,pc:0x204}).verified,false);
 rom[0x147]=3;
 assert.equal(classifyMbc3AdjacentIndirectWrite({rom,previousPc:0x200,pc:0x203}).verified,false);
 rom[0x147]=0x13;rom.set([0x21,0x00,0x80,0x77],0x300);
 assert.equal(classifyMbc3AdjacentIndirectWrite({rom,previousPc:0x300,pc:0x303}).verified,false);
});
