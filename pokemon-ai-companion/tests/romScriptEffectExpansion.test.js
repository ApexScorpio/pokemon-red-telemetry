'use strict';
// T186 diagnostic regressions. No synthetic effect is real-ROM evidence.
// MBC3 fixed/switchable windows: gbdev/pandocs src/MBC3.md.
const test=require('node:test'),assert=require('node:assert/strict');
const {interpretHandler,guidanceForSemantics}=require('../romScriptSemantics');
const entry=0x18020;
function restoreFixture(mirror){
 const rom=Buffer.alloc(1048576);rom[0x147]=0x13;rom[0x148]=5;
 // Entry bank is physically 6. An HRAM mirror is a separate memory value.
 const init=mirror===undefined?[]:[0x3e,mirror,0xe0,0xb8];
 rom.set([8,...init,0xaf,0x37,0xcd,0,1,0x21,0x47,0xd7,0xcb,0xc6,0xc9],entry);
 // Save unknown/concrete mirror and flags, select bank 3, call ROMX,
 // then use the original Red/Blue ROM0 restore suffix at its real address.
 rom.set([0xf0,0xb8,0xf5,0x3e,3,0xe0,0xb8,0xea,0,0x20,0xcd,0,0x40,0xc3,0x8d,0x3e],0x100);
 rom.set([0xc9],0xc000);
 rom.set([0xf1,0xe0,0xb8,0xea,0,0x20,0xc9],0x3e8d);
 return rom;
}
test('restoring an unchanged symbolic HRAM byte executes without inventing a transition',()=>{
 const rom=restoreFixture();
 // Reproduce the original failing fixture: select bank 3 without writing
 // the HRAM mirror. POP AF restores exactly the byte already in memory.
 rom.set([0,0],0x105);
 const h=interpretHandler({rom,fileOffset:entry});
 const u=h.unresolved.find(u=>u.offset===0x3e90);
 assert.ok(u);assert.deepEqual(u.value,{read:0xffb8});
 assert.equal(u.bank,3);assert.equal(u.bankSelection.candidateBankCount,127);
 assert.equal(h.effects.some(e=>e.instructionOffset===0x3e8e),false);
 assert.equal(h.effects.filter(e=>e.gameplayStateTransitionProven).length,0);
 assert.equal(h.complete,false);
});
test('unknown saved HRAM does not become the entry bank after PUSH AF / POP AF',()=>{
 const h=interpretHandler({rom:restoreFixture(),fileOffset:entry});
 const u=h.unresolved.find(u=>u.offset===0x3e90);
 assert.ok(u);assert.equal(u.address,0x2000);assert.deepEqual(u.value,{read:0xffb8});
 assert.equal(u.bank,3);assert.equal(u.bankSelection.candidateBankCount,127);
 const prefix=h.effects.find(e=>e.instructionOffset===0x3e8e);
 assert.ok(prefix);assert.equal(prefix.address,0xffb8);
 assert.deepEqual(prefix.value,{read:0xffb8});assert.equal(prefix.trace.at(-2),0x3e8d);
 assert.ok(prefix.trace.includes(0xc000));
 assert.equal(h.effects.filter(e=>e.gameplayStateTransitionProven).length,0);
 assert.equal(h.complete,false);
});
test('concrete saved mirror restores the physical bank and all PUSH AF flags',()=>{
 const rom=restoreFixture(6);
 // After the call, PUSH AF / POP BC exposes F without modifying it.
 const at=entry+1+4+2+3;
 rom.set([0xf5,0xc1,0x79,0xea,0,0xc1,0x21,0x47,0xd7,0xcb,0xc6,0xc9],at);
 const h=interpretHandler({rom,fileOffset:entry});
 assert.equal(h.complete,true,JSON.stringify(h.unresolved));
 assert.equal(h.effects.find(e=>e.address===0xc100)?.value,0x90);
 const e=h.effects.find(e=>e.gameplayStateTransitionProven);
 assert.ok(e);assert.ok(e.trace.includes(0x3e90));assert.equal(e.address,0xd747);
 assert.equal(e.observedExecution,false);
 assert.equal(guidanceForSemantics(h).find(e=>e.gameplayStateTransitionProven).eventCompleted,null);
});
test('a different concrete mirror never silently restores the caller bank',()=>{
 const rom=restoreFixture(2);
 // The actual return target in bank 2 halts; bank 6 contains a tempting write.
 rom[0x8000+(entry%0x4000)+10]=0x76;
 const h=interpretHandler({rom,fileOffset:entry});
 assert.equal(h.effects.filter(e=>e.gameplayStateTransitionProven).length,0);
 assert.ok(h.unresolved.some(u=>u.reason==='HALT_REQUIRES_INTERRUPT_STATE'));
});
for(const variant of ['RED','BLUE','GREEN'])test('actual '+variant+' restore frontier and prior physical effects',
 {skip:!process.env['POKEMON_'+variant+'_ROM']},()=>{
 const {readRom,KNOWN}=require('../romComprehensiveAudit');
 const {inspectRomBuffer}=require('../romVariantRegistry');
 const rom=readRom(process.env['POKEMON_'+variant+'_ROM']);
 const p=inspectRomBuffer(rom,variant.toLowerCase()+'.gb'),w=p.world.interactionScriptAtlas.scriptSemantics;
 assert.equal(p.hash.sha256,KNOWN[variant.toLowerCase()]);
 const frontier=variant==='GREEN'?0x3e77:0x3e90;
 assert.equal(rom.subarray(frontier-3,frontier+4).toString('hex'),'f1e0b8ea0020c9');
 const matches=u=>u.offset===frontier&&u.reason==='UNRESOLVED_MEMORY_OR_BANK_WRITE';
 const affected=w.handlers.filter(h=>h.unresolved.some(matches));
 const paths=affected.flatMap(h=>h.unresolved.filter(matches));
 assert.equal(affected.length,339);assert.equal(paths.length,1380);
 // The original failure counted all diagnostics at this PC as bank writes.
 // One pending path exhausted the global step budget before executing it.
 const atFrontier=w.handlers.flatMap(h=>h.unresolved.filter(u=>u.offset===frontier));
 assert.equal(atFrontier.length,1381);
 const pending=atFrontier.filter(u=>!matches(u));
 assert.equal(pending.length,1);assert.equal(pending[0].reason,'STEP_BUDGET');
 assert.equal(pending[0].pendingCpu,frontier);
 const affectedOffsets=new Set(affected.map(h=>h.handlerOffset));
 assert.equal(w.rows.filter(r=>affectedOffsets.has(r.handlerOffset)).length,443);
 for(const u of paths){
  assert.equal(u.reason,'UNRESOLVED_MEMORY_OR_BANK_WRITE');assert.equal(u.address,0x2000);
  assert.deepEqual(u.value,{read:0xffb8});
 }
 const h=w.handlers.find(h=>h.handlerOffset===349579);
 const prefix=h.effects.find(e=>e.instructionOffset===frontier-2);
 assert.ok(prefix);assert.equal(prefix.address,0xffb8);
 assert.equal(prefix.before,3);assert.equal(prefix.gameplayStateTransitionProven,false);
 assert.deepEqual(prefix.value,{read:0xffb8});assert.equal(prefix.trace[0],h.handlerOffset+1);
 assert.equal(prefix.trace.at(-2),frontier-3);assert.equal(prefix.trace.at(-1),frontier-2);
 // Exact sequential prefix reaches POP AF, LDH [B8],A, then LD [2000],A.
 assert.equal(rom[prefix.trace.at(-2)],0xf1);assert.equal(rom[prefix.trace.at(-1)],0xe0);
 for(const [handler,at,address,trace,bytes,op,bit] of [
  [0x1cab8,0x1cabe,0xd7bf,[0x1cab9,0x1cabc,0x1cabe],'0821bfd7cb46cbc6','SET_BIT',0],
  [0x514a4,0x514a8,0xd7f0,[0x514a5,0x514a8],'0821f0d7cb8e','RESET_BIT',1]]){
  assert.equal(rom.subarray(handler,handler+bytes.length/2).toString('hex'),bytes);
  const h=w.handlers.find(h=>h.handlerOffset===handler);
  const e=h.effects.find(e=>e.instructionOffset===at&&e.address===address);
  assert.ok(e?.gameplayStateTransitionProven);assert.deepEqual(e.trace,trace);
  assert.deepEqual(e.value,{op,value:{read:address},bit});assert.deepEqual(e.conditions,[]);
  assert.equal(e.observedExecution,false);assert.equal(h.eventCompleted,null);
  assert.equal(guidanceForSemantics(h).find(g=>g.instructionOffset===at).eventCompleted,null);
 }
 assert.ok(w.formallyProvenScriptEffects>=2);
 const reasons={};
 for(const reason of new Set(w.handlers.flatMap(h=>h.unresolved.map(u=>u.reason)))){
  const hs=w.handlers.filter(h=>h.unresolved.some(u=>u.reason===reason));
  const offsets=new Set(hs.map(h=>h.handlerOffset));
  reasons[reason]={paths:hs.reduce((n,h)=>n+h.unresolved.filter(u=>u.reason===reason).length,0),
   handlers:hs.length,references:w.rows.filter(r=>offsets.has(r.handlerOffset)).length};
 }
 console.log(JSON.stringify({variant,sha:p.hash.sha256,frontier,paths:paths.length,
  handlers:affected.length,references:443,reasons,physicalPrefixTrace:prefix.trace,
  effects:w.formallyProvenScriptEffects,expansionProven:w.formallyProvenScriptEffects>2}));
});
