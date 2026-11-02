'use strict';
// Instruction regressions for the real T181 frontiers, using the production
// interpreter. Synthetic bytes never enter real-ROM proof counters.
const test=require('node:test'),assert=require('node:assert/strict');
const {interpretHandler,interpretWorld,guidanceForSemantics}=require('../romScriptSemantics');
const entry=0x18020;
function run(code,setup=()=>{}){
 const rom=Buffer.alloc(1048576);rom.set([8,...code],entry);setup(rom);
 return interpretHandler({rom,fileOffset:entry});
}
// Save A and the physical F byte through PUSH AF / POP BC.
const dump=[0xea,0x00,0xc1,0xf5,0xc1,0x79,0xea,0x01,0xc1,0xc9];
function result(code){
 const r=run([...code,...dump]);assert.equal(r.complete,true,JSON.stringify(r.unresolved));
 return [0xc100,0xc101].map(a=>r.effects.findLast(e=>e.address===a)?.value);
}

test('ADD/ADC/SUB/SBC boundary results and all four flags',()=>{
 const cases=[
  [[0x3e,255,0xc6,1],[0,0xb0]],
  [[0x3e,15,0xc6,1],[16,0x20]],
  [[0x3e,255,0x37,0xce,0],[0,0xb0]],
  [[0x3e,0,0xd6,1],[255,0x70]],
  [[0x3e,16,0xd6,1],[15,0x60]],
  [[0x3e,0,0x37,0xde,255],[0,0xf0]],
  [[0x3e,1,0x06,255,0x80],[0,0xb0]],
  [[0x3e,1,0x06,0,0x37,0x88],[2,0]],
  [[0x3e,0,0x06,1,0x90],[255,0x70]],
  [[0x3e,1,0x06,0,0x37,0x98],[0,0xc0]]
 ];
 for(const [code,want] of cases)assert.deepEqual(result(code),want,code.toString());
});

test('carry, zero and half-carry preservation across INC/DEC, BIT, RES/SET and 16-bit operations',()=>{
 assert.deepEqual(result([0xaf,0x37,0x06,15,0x04]),[0,0x30]);
 assert.deepEqual(result([0xaf,0x37,0x06,16,0x05]),[0,0x70]);
 assert.deepEqual(result([0xaf,0x37,0x06,0,0xcb,0x40,0xcb,0xc0,0xcb,0x80]),[0,0xb0]);
 assert.deepEqual(result([0xaf,0x21,255,15,0x11,1,0,0x19]),[0,0xa0]);
 assert.deepEqual(result([0xaf,0x21,255,255,0x09]),[0,{flags:{z:true,n:false,h:null,c:null}}]);
 assert.deepEqual(result([0xaf,0x37,0x21,255,255,0x23,0x2b]),[0,0x90]);
 assert.deepEqual(result([0xaf,0x2f]),[255,0xe0]);
 assert.deepEqual(result([0xaf,0x37,0x3f]),[0,0x80]);
});

test('all CB rotate/shift families compute the byte, carry, zero, N and H',()=>{
 for(const [op,input,carry,value,f] of [
  [0x00,128,false,1,0x10],[0x08,1,false,128,0x10],
  [0x10,128,true,1,0x10],[0x18,1,true,128,0x10],
  [0x20,128,false,0,0x90],[0x28,129,false,192,0x10],
  [0x30,0xf0,true,15,0],[0x38,1,false,0,0x90]
 ])assert.deepEqual(result([0xaf,...(carry?[0x37]:[]),0x06,input,0xcb,op,0x78]),[value,f]);
 for(const op of [0x07,0x0f,0x17,0x1f])assert.deepEqual(result([0xaf,op]),[0,0]);
});

test('HRAM immediate and C-relative loads preserve flags, support readback and exclude I/O writes',()=>{
 assert.deepEqual(result([0xaf,0x37,0x3e,42,0xe0,0x8c,0x0e,0x8c,0xf2]),[42,0x90]);
 assert.deepEqual(result([0xaf,0x3e,43,0x0e,0x8c,0xe2,0xf0,0x8c]),[43,0x80]);
 for(const low of [0,0x7f,0xff]){
  const r=run([0x3e,1,0xe0,low,0xea,0x47,0xd7,0xc9]);
  assert.equal(r.effects.length,0);assert.equal(r.complete,false);
 }
 const unknown=run([0xf0,0x8c,0xfe,1,0x28,1,0xc9,0xea,0x47,0xd7,0xc9]);
 assert.equal(unknown.effects.length,1);
 assert.deepEqual(unknown.effects[0].conditions[0].predicate,{equals:[{read:0xff8c},1]});
 const changing=run([0xf0,4,0x47,0xf0,4,0xa8,0xea,0x47,0xd7,0xc9]);
 assert.equal(changing.effects[0].value.op,'XOR');
 assert.notEqual(changing.effects[0].value.value.sample,changing.effects[0].value.mask.sample);
});

test('ADD HL and ROM BC/DE reads use the mapped physical bytes',()=>{
 const r=run([0xaf,0x21,0x40,0x40,0x11,1,0,0x19,0x7e,0xea,0x47,0xd7,0x01,0x42,0x40,0x0a,0xea,0x48,0xd7,0x11,0x43,0x40,0x1a,0xea,0x49,0xd7,0xc9],rom=>rom.set([3,7,9],0x18041));
 assert.equal(r.complete,true);assert.deepEqual(r.effects.map(e=>e.value),[3,7,9]);
 const w=run([0x01,0x47,0xd7,0x3e,5,0x02,0x11,0x48,0xd7,0x12,0xc9]);
 assert.deepEqual(w.effects.map(e=>[e.address,e.value]),[[0xd747,5],[0xd748,5]]);
});

test('repeated shared calls and bounded concrete loops continue; unchanged cycles stop',()=>{
 const r=run([0x06,2,0xcd,0x60,0x40,0xcd,0x60,0x40,0x78,0xea,0x47,0xd7,0xc9],rom=>rom.set([0x05,0xc9],0x18060));
 assert.equal(r.complete,true);assert.equal(r.effects[0].value,0);
 assert.equal(run([0x06,2,0x05,0x20,0xfd,0xc9]).complete,true);
 assert.equal(run([0x18,0xfe]).unresolved[0].reason,'LOOP_REQUIRES_FIXPOINT');
});

test('RST, stack return-address bytes and PUSH HL/RET dispatch follow actual ROM bytes',()=>{
 const r=run([0xcf,0xc9],rom=>rom.set([0xe1,0xe5,0x3e,7,0xea,0x47,0xd7,0xc9],8));
 assert.equal(r.complete,true);assert.equal(r.effects[0].instructionOffset,12);
 const ret=run([0x21,0x60,0x40,0xe5,0xc9],rom=>rom.set([0x3e,9,0xea,0x47,0xd7,0xc9],0x18060));
 assert.equal(ret.complete,true);assert.equal(ret.effects[0].value,9);
 const jp=run([0x21,0x60,0x40,0xe9],rom=>rom.set([0x3e,11,0xea,0x47,0xd7,0xc9],0x18060));
 assert.equal(jp.effects[0].value,11);
 assert.equal(run([0xe9]).complete,false);
});

test('MBC3 known bank writes change instruction fetch; unknown/restored mirrors never invent a bank',()=>{
 const setup=rom=>{rom[0x147]=0x13;rom[0x148]=5;rom.set([0x3e,7,0xea,0x47,0xd7,0xc9],0x8000);
  rom.set([0x3e,2,0xea,0,0x20,0xcd,0,0x40,0x3e,6,0xea,0,0x20,0xc9],0x100);};
 const r=run([0xcd,0,1,0xc9],setup);
 assert.equal(r.complete,true);
 assert.equal(r.effects[0].instructionOffset,0x8002);assert.equal(r.effects[0].value,7);
 for(const bank of [0,0x80,0x81]){
  const alias=run([0xcd,0,1,0xc9],rom=>{setup(rom);rom[0x101]=bank;
   rom.set([0x3e,8,0xea,0x47,0xd7,0xc9],0x4000);});
  assert.equal(alias.effects[0].instructionOffset,0x4002);
 }
 for(const code of [[0xf0,0xb8,0xea,0,0x20],[0x3e,64,0xea,0,0x20]]){
  const stopped=run([...code,0xea,0x47,0xd7,0xc9],setup);
  assert.equal(stopped.effects.filter(e=>e.gameplayStateTransitionProven).length,0);assert.equal(stopped.complete,false);
 }
});

test('new instruction-derived event effects propagate to every reference with uncertain conditions',()=>{
 const rom=Buffer.alloc(1048576);
 rom.set([8,0xf0,0x8c,0xc6,1,0x20,1,0xc9,0xea,0x47,0xd7,0xc9],entry);
 const refs=[12,35,96].map(mapId=>({mapId,kind:'NPC',ordinal:1,scriptFileOffset:entry,textPointerVerified:true,scriptCommand:'TX_START_ASM'}));
 const world=interpretWorld({rom,atlas:{references:refs}});
 assert.equal(world.formallyProvenScriptEffects,1);assert.equal(world.handlers.length,1);
 for(const row of world.rows){
  const [g]=guidanceForSemantics(row.semantics);
  assert.equal(g.address,0xd747);assert.equal(g.observedExecution,false);
  assert.equal(g.conditionsInCurrentSnapshot[0],'UNKNOWN');assert.equal(g.eventCompleted,null);
 }
});
