'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {traceMbc3RegisterInput}=require('../romMbc3RegisterInput');
const mk=()=>{const b=Buffer.alloc(1048576,0xc9);b[0x147]=19;b[0x148]=5;return b;};
const witness=(...pcs)=>pcs.map((pc,i)=>({pc,via:i?'fallthrough':'ROOT'}));
test('LD B,d8 through NOP becomes conditional B input to LD A,B',()=>{
 const rom=mk();rom.set([0x06,0x19,0x00,0x78],0x200);
 const r=traceMbc3RegisterInput({rom,witnessPath:witness(0x200,0x202,0x203),
  sourcePc:0x203,sourceRegister:'B'});
 assert.equal(r.verified,true);assert.equal(r.originKind,'LD_R_D8');
 assert.equal(r.originPc,0x200);assert.equal(r.conditionalByte,0x19);
 assert.equal(r.executed,false);assert.equal(r.activeBankKnown,false);
});
test('BC/DE/HL word literals select high and low source bytes',()=>{
 for(const [op,hi,lo,loadHi,loadLo,regHi,regLo] of [
  [0x01,0x78,0x79,0x78,0x79,'B','C'],
  [0x11,0x7a,0x7b,0x7a,0x7b,'D','E'],
  [0x21,0x7c,0x7d,0x7c,0x7d,'H','L']
 ]){
  for(const [reg,load,value] of [[regHi,loadHi,0x23],[regLo,loadLo,0x45]]){
   const rom=mk();rom.set([op,0x45,0x23,load],0x200);
   const r=traceMbc3RegisterInput({rom,witnessPath:witness(0x200,0x203),
    sourcePc:0x203,sourceRegister:reg});
   assert.equal(r.originKind,'LD_RR_D16');assert.equal(r.conditionalByte,value);
   assert.equal(r.runtimeValueKnown,false);
  }
 }
});
test('write to target from another register invalidates earlier literal',()=>{
 const rom=mk();rom.set([0x06,7,0x41,0x78],0x200);
 const r=traceMbc3RegisterInput({rom,witnessPath:witness(0x200,0x202,0x203),
  sourcePc:0x203,sourceRegister:'B'});
 assert.equal(r.conditionalByte,null);
 assert.equal(r.stopReason,'REGISTER_OVERWRITTEN');
});
test('INC B, POP BC, INC BC and changing HL invalidate values',()=>{
 for(const [bytes,pcs,register,stop] of [
  [[0x06,7,0x04,0x78],[0x200,0x202,0x203],'B','REGISTER_ARITHMETIC'],
  [[0x06,7,0xc1,0x78],[0x200,0x202,0x203],'B','REGISTER_PAIR_MUTATION'],
  [[0x06,7,0x03,0x78],[0x200,0x202,0x203],'B','REGISTER_PAIR_MUTATION'],
  [[0x26,7,0x22,0x7c],[0x200,0x202,0x203],'H','HL_SIDE_EFFECT']
 ]){
  const rom=mk();rom.set(bytes,0x200);
  const r=traceMbc3RegisterInput({rom,witnessPath:witness(...pcs),
   sourcePc:pcs.at(-1),sourceRegister:register});
  assert.equal(r.conditionalByte,null);assert.equal(r.stopReason,stop);
 }
});
test('CB modification blocks register, CB BIT does not',()=>{
 const mod=mk();mod.set([0x06,9,0xcb,0x00,0x78],0x200);
 const a=traceMbc3RegisterInput({rom:mod,
  witnessPath:witness(0x200,0x202,0x204),sourcePc:0x204,sourceRegister:'B'});
 assert.equal(a.stopReason,'CB_REGISTER_MUTATION');
 const bit=mk();bit.set([0x06,9,0xcb,0x40,0x78],0x200);
 const b=traceMbc3RegisterInput({rom:bit,
  witnessPath:witness(0x200,0x202,0x204),sourcePc:0x204,sourceRegister:'B'});
 assert.equal(b.originKind,'LD_R_D8');assert.equal(b.conditionalByte,9);
});
test('a call edge and wrong instruction boundaries do not prove register lineage',()=>{
 const rom=mk();rom.set([0x06,7,0x78],0x200);
 const a=traceMbc3RegisterInput({rom,
  witnessPath:[{pc:0x200,via:'ROOT'},{pc:0x202,via:'call'}],
  sourcePc:0x202,sourceRegister:'B'});
 assert.equal(a.stopReason,'NON_LINEAR_WITNESS');
 const bad=mk();bad.set([0x06,7,0x00,0x78],0x200);
 const b=traceMbc3RegisterInput({rom:bad,
  witnessPath:witness(0x200,0x203),sourcePc:0x203,sourceRegister:'B'});
 assert.equal(b.stopReason,'BAD_INSTRUCTION_BOUNDARY');
});
test('wrong header, wrong source register, invalid budget fail closed',()=>{
 const rom=mk();rom.set([0x78],0x200);
 for(const request of [{},{rom,witnessPath:witness(0x200),sourcePc:0x200,sourceRegister:'(HL)'},
  {rom,witnessPath:witness(0x200),sourcePc:0x200,sourceRegister:'B',maxBacktrack:0},
  {rom,witnessPath:[],sourcePc:0x200,sourceRegister:'B'}])
  assert.equal(traceMbc3RegisterInput(request).verified,false);
 rom[0x147]=3;
 assert.equal(traceMbc3RegisterInput({rom,witnessPath:witness(0x200),
  sourcePc:0x200,sourceRegister:'B'}).verified,false);
});
