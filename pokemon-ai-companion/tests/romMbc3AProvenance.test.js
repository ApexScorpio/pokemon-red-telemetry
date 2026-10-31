'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {traceMbc3AProvenance}=require('../romMbc3AProvenance');
const fake=()=>{const r=Buffer.alloc(1048576,0xc9);r[0x147]=19;r[0x148]=5;return r;};
const path=(...p)=>p.map((pc,i)=>({pc,via:i?'fallthrough':'ROOT'}));
test('LD A,d8 through transparent LD B,d8 supplies only a conditional candidate',()=>{
 const rom=fake();rom.set([0x3e,0x17,0x06,0x04,0xea,0x00,0x20],0x100);
 const r=traceMbc3AProvenance({rom,witnessPath:path(0x100,0x102,0x104),writePc:0x104});
 assert.equal(r.verified,true);assert.equal(r.sourceKind,'IMMEDIATE_A');
 assert.equal(r.sourcePc,0x100);assert.equal(r.conditionalByte,0x17);
 assert.equal(r.scannedInstructions,2);assert.equal(r.executed,false);
 assert.equal(r.runtimeValueKnown,false);assert.equal(r.activeBankKnown,false);
});
test('XOR A and SUB A provide conditional zero only, never observed write',()=>{
 for(const op of [0xaf,0x97]){
  const rom=fake();rom.set([op,0xea,0x00,0x20],0x100);
  const r=traceMbc3AProvenance({rom,witnessPath:path(0x100,0x101),writePc:0x101});
  assert.equal(r.sourceKind,'ZEROING_A');assert.equal(r.conditionalByte,0);
  assert.equal(r.executed,false);
 }
});
test('source LD A,(a16) records source address but cannot read RAM',()=>{
 const rom=fake();rom.set([0xfa,0x22,0xd1,0xea,0x00,0x20],0x100);
 const r=traceMbc3AProvenance({rom,witnessPath:path(0x100,0x103),writePc:0x103});
 assert.equal(r.sourceKind,'MEMORY_READ');assert.equal(r.sourceAddressCpu,0xd122);
 assert.equal(r.conditionalByte,null);assert.equal(r.runtimeValueKnown,false);
});
test('A copy from C remains a register source of unknown value',()=>{
 const rom=fake();rom.set([0x79,0xea,0x00,0x20],0x100);
 const r=traceMbc3AProvenance({rom,witnessPath:path(0x100,0x101),writePc:0x101});
 assert.equal(r.sourceKind,'REGISTER_OR_HL_READ');assert.equal(r.sourceRegister,'C');
 assert.equal(r.conditionalByte,null);assert.equal(r.activeBankKnown,false);
});
test('INC A invalidates prior immediate instead of guessing the bank',()=>{
 const rom=fake();rom.set([0x3e,7,0x3c,0xea,0x00,0x20],0x100);
 const r=traceMbc3AProvenance({rom,witnessPath:path(0x100,0x102,0x103),writePc:0x103});
 assert.equal(r.sourceKind,'UNRESOLVED');assert.equal(r.stopReason,'UNMODELLED_A_WRITE_OR_CONTROL');
 assert.equal(r.conditionalByte,null);
});
test('CALL witness or false instruction boundary breaks provenance',()=>{
 const rom=fake();rom.set([0x3e,7,0xea,0x00,0x20],0x100);
 const a=traceMbc3AProvenance({rom,
  witnessPath:[{pc:0x100,via:'ROOT'},{pc:0x102,via:'call'}],writePc:0x102});
 assert.equal(a.stopReason,'NON_LINEAR_WITNESS');
 const b=traceMbc3AProvenance({rom,
  witnessPath:[{pc:0x101,via:'ROOT'},{pc:0x102,via:'fallthrough'}],writePc:0x102});
 assert.equal(b.stopReason,'BAD_INSTRUCTION_BOUNDARY');
});
test('unsupported header, invalid witness and out-of-range budgets fail closed',()=>{
 const rom=fake();rom.set([0xea,0x00,0x20],0x200);
 for(const arg of [{},{rom,witnessPath:[],writePc:0x200},
  {rom,witnessPath:path(0x100),writePc:0x200},
  {rom,witnessPath:path(0x200),writePc:0x200,maxBacktrack:0},
  {rom:Buffer.alloc(256),witnessPath:path(0x200),writePc:0x200}]){
  assert.equal(traceMbc3AProvenance(arg).verified,false);
 }
 rom[0x147]=3;
 assert.equal(traceMbc3AProvenance({rom,witnessPath:path(0x200),writePc:0x200}).verified,false);
});
