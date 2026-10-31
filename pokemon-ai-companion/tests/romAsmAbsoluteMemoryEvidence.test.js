'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {decodeOpcode}=require('../romMapCodeAtlas');
const {inspectAbsoluteOperand,category}=require('../romAsmAbsoluteMemoryEvidence');
const {inspectTxAsmHandler}=require('../romTxAsmHandlerAtlas');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const FIXTURE=0x18000;
const fake=bytes=>{const b=Buffer.alloc(1048576);b.set(bytes,FIXTURE);return b;};
test('LR35902 direct WRAM write is a static operand, not proof of any side effect',()=>{
 const rom=fake([0x08,0xea,0x47,0xd7,0xc9]);
 const d=decodeOpcode(rom,6,0x4001);
 const e=inspectAbsoluteOperand({rom,decoded:d});
 assert.equal(d.ok,true);
 assert.equal(e.opcode,0xea);
 assert.equal(e.operandAddress,0xd747);
 assert.equal(e.kind,'DIRECT_STORE_A');
 assert.equal(e.classification,'EVENT_FLAGS_D747_D886');
 assert.equal(e.directWramWriteCandidate,true);
 assert.equal(e.directWramReadCandidate,false);
 assert.equal(e.instructionExecuted,false);
 assert.equal(e.actualMemoryEffectVerified,false);
 const graph=inspectTxAsmHandler({rom,fileOffset:FIXTURE});
 assert.equal(graph.verified,true);
 assert.equal(graph.directWramWriteCandidateCount,1);
 assert.equal(graph.memoryEffectsExecuted,false);
 assert.equal(graph.absoluteMemoryOperands[0].operandAddress,0xd747);
});
test('direct reads and 16-bit SP stores distinguish real instructions',()=>{
 const rom=fake([0x08,0xfa,0xf0,0xd6,0x08,0xfe,0xd6,0xc9]);
 const graph=inspectTxAsmHandler({rom,fileOffset:FIXTURE});
 assert.equal(graph.verified,true);
 assert.equal(graph.directWramReadCandidateCount,1);
 assert.equal(graph.directWramWriteCandidateCount,1);
 assert.deepEqual(graph.absoluteMemoryOperands.map(x=>x.kind),
  ['DIRECT_LOAD_A','DIRECT_STORE_SP_16']);
 assert.deepEqual(graph.absoluteMemoryOperands[0].targetClassifications,
  ['HIDDEN_ITEMS_D6F0_D6FD']);
 assert.deepEqual(graph.absoluteMemoryOperands[1].targetClassifications,
  ['HIDDEN_COINS_D6FE_D6FF','HIDDEN_COINS_D6FE_D6FF']);
 assert.equal(graph.absoluteMemoryOperands[1].instructionExecuted,false);
});
test('LD HL,d16 is an immediate literal and not a verified RAM dereference',()=>{
 const rom=fake([0x08,0x21,0x47,0xd7,0xc9]);
 const graph=inspectTxAsmHandler({rom,fileOffset:FIXTURE});
 assert.equal(graph.verified,true);
 assert.equal(graph.wramPointerLiteralCount,1);
 assert.equal(graph.directWramReadCandidateCount,0);
 assert.equal(graph.directWramWriteCandidateCount,0);
 assert.equal(graph.absoluteMemoryOperands[0].pointerConstantOnly,true);
 assert.equal(graph.absoluteMemoryOperands[0].directMemoryAccess,false);
});
test('unrelated opcodes and forged instruction parameters cannot imply memory effects',()=>{
 const rom=fake([0x08,0x00,0xc9]);
 const d=decodeOpcode(rom,6,0x4001);
 assert.equal(inspectAbsoluteOperand({rom,decoded:d}),null);
 assert.equal(inspectAbsoluteOperand({rom,decoded:{...d,opcode:0xea,size:3}}),null);
 assert.equal(inspectAbsoluteOperand({rom:Buffer.alloc(512),decoded:d}),null);
 assert.equal(category(0x4000),'ROM_OR_MBC_CONTROL');
 assert.equal(category(0xd35e),'CURRENT_MAP_D35E');
 assert.equal(category(0xd886),'EVENT_FLAGS_D747_D886');
 assert.equal(category(0xd887),'OTHER_WRAM');
 assert.equal(category(0xd6f0),'HIDDEN_ITEMS_D6F0_D6FD');
 assert.equal(category(0xd6fe),'HIDDEN_COINS_D6FE_D6FF');
});
for(const [name,env] of [['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']]){
 test('original '+name+' ROM: all ASM candidate WRAM operands match physical bytes',
 {skip:!process.env[env]?'Original ROM path not set':false},()=>{
  const rom=readRom(process.env[env]),profile=inspectRomBuffer(rom,name+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[name]);
  const atlas=profile.world.interactionScriptAtlas;
  assert.equal(atlas.verified,true);
  const rows=atlas.maps.flatMap(m=>m.interactions||[]).filter(x=>x.scriptCommand==='TX_START_ASM');
  assert.equal(rows.length,626);
  const unique=new Map();
  for(const row of rows){
   assert.equal(row.asmCandidate?.verified,true);
   const graph=row.asmCandidate;
   assert.equal(row.asmMemoryEffectExecuted,false);
   assert.equal(row.asmDirectWramReadCandidates,graph.directWramReadCandidateCount);
   assert.equal(row.asmDirectWramWriteCandidates,graph.directWramWriteCandidateCount);
   assert.equal(row.asmWramPointerLiteralCandidates,graph.wramPointerLiteralCount);
   unique.set(row.scriptFileOffset,graph);
  }
  assert.equal(unique.size,516);
  let operands=0,reads=0,writes=0,pointers=0;
  for(const graph of unique.values()){
   assert.ok(Array.isArray(graph.absoluteMemoryOperands));
   assert.equal(graph.memoryEffectsExecuted,false);
   operands+=graph.absoluteMemoryOperands.length;
   reads+=graph.directWramReadCandidateCount;
   writes+=graph.directWramWriteCandidateCount;
   pointers+=graph.wramPointerLiteralCount;
   for(const x of graph.absoluteMemoryOperands){
    assert.equal(rom[x.sourceFileOffset],x.opcode);
    assert.equal(rom.readUInt16LE(x.sourceFileOffset+1),x.operandAddress);
    assert.equal(x.instructionExecuted,false);
    assert.equal(x.actualMemoryEffectVerified,false);
    assert.equal(x.conditionAndBranchVerified,false);
   }
  }
  assert.equal(atlas.summary.uniqueAsmMemoryOperandInstructions,operands);
  assert.equal(atlas.summary.uniqueAsmDirectWramReadCandidates,reads);
  assert.equal(atlas.summary.uniqueAsmDirectWramWriteCandidates,writes);
  assert.equal(atlas.summary.uniqueAsmWramPointerLiterals,pointers);
  assert.equal(atlas.summary.asmMemoryWritesExecuted,0);
  assert.ok(operands>0,'Expected ROM operands physically found');
 });
}
