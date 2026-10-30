'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectAdjacentFlagPatterns}=require('../romAsmEventBitEvidence');
const {inspectTxAsmHandler}=require('../romTxAsmHandlerAtlas');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
function fixture(code){
 const rom=Buffer.alloc(1048576),fileOffset=0x18000;
 rom.set([0x08,...code],fileOffset);
 return {rom,fileOffset};
}
test('LD A,[wEventFlags] followed by BIT 0,A identifies exact ROM bit 0',()=>{
 const r=inspectTxAsmHandler(fixture([0xfa,0x47,0xd7,0xcb,0x47,0xc9]));
 assert.equal(r.verified,true);
 assert.equal(r.adjacentRomFlagBitTests,1);
 assert.equal(r.adjacentRomFlagBitSetCandidates,0);
 const hit=r.adjacentRomFlagBitPatterns[0];
 assert.equal(hit.domain,'WORLD_EVENT_BIT');
 assert.equal(hit.address,0xd747);
 assert.equal(hit.bitIndex,0);
 assert.equal(hit.operation,'BIT_TEST');
 assert.equal(hit.register,'A');
 assert.equal(hit.operandsAndAdjacencyVerified,true);
 assert.equal(hit.instructionSequenceExecuted,false);
 assert.equal(hit.eventOutcomeCertified,false);
});
test('literal HL with SET event bit and RES hidden-item bit retains domain',()=>{
 const r=inspectTxAsmHandler(fixture([
  0x21,0x48,0xd7,0xcb,0xde,
  0x21,0xf0,0xd6,0xcb,0xbe,0xc9
 ]));
 assert.equal(r.verified,true);
 assert.equal(r.adjacentRomFlagBitSetCandidates,1);
 assert.equal(r.adjacentRomFlagBitResetCandidates,1);
 assert.deepEqual(r.adjacentRomFlagBitPatterns.map(x=>
  [x.domain,x.bitIndex,x.operation]),[
   ['WORLD_EVENT_BIT',11,'SET_BIT'],
   ['HIDDEN_ITEM_BIT',7,'RESET_BIT']
  ]);
 assert.equal(r.adjacentRomFlagBitInstructionsExecuted,false);
});
test('intervening instructions and wrong registers never fabricate bit bindings',()=>{
 for(const code of [
  [0xfa,0x47,0xd7,0x00,0xcb,0x47,0xc9],
  [0xfa,0x47,0xd7,0xcb,0x46,0xc9],
  [0x21,0x47,0xd7,0xcb,0x47,0xc9],
  [0xfa,0x47,0xd7,0xcd,0x00,0x10,0xcb,0x47,0xc9]
 ]){
  const r=inspectTxAsmHandler(fixture(code));
  assert.equal(r.verified,true);
  assert.equal(r.adjacentRomFlagBitPatterns.length,0);
 }
});
test('malformed candidate instruction boundaries fail closed',()=>{
 const rom=Buffer.alloc(1048576);
 assert.equal(inspectAdjacentFlagPatterns({rom,instructions:null}).verified,false);
 assert.equal(inspectAdjacentFlagPatterns({
  rom,instructions:[{offset:1,opcode:0xfa,size:3},
   {offset:1,opcode:0xfa,size:3}]
 }).verified,false);
});
for(const [name,env] of [['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']]){
 test('original '+name+' ROM: validate every adjacent WRAM flag pattern against exact original bytes',
 {skip:!process.env[env]?'Original ROM required':false},()=>{
  const rom=readRom(process.env[env]),p=inspectRomBuffer(rom,name+'.gb');
  assert.equal(p.hash.sha256,KNOWN[name]);
  const atlas=p.world.interactionScriptAtlas;
  assert.equal(atlas.verified,true);
  const unique=new Map(atlas.references.filter(x=>x.scriptCommand==='TX_START_ASM')
   .map(row=>[row.scriptFileOffset,row.asmCandidate]));
  assert.equal(unique.size,516);
  let tests=0,sets=0,resets=0;
  for(const graph of unique.values()){
   assert.ok(Array.isArray(graph.adjacentRomFlagBitPatterns));
   assert.equal(graph.adjacentRomFlagBitInstructionsExecuted,false);
   tests+=graph.adjacentRomFlagBitTests;
   sets+=graph.adjacentRomFlagBitSetCandidates;
   resets+=graph.adjacentRomFlagBitResetCandidates;
   for(const e of graph.adjacentRomFlagBitPatterns){
    assert.equal(rom[e.offset],e.firstOpcode);
    assert.equal(rom.readUInt16LE(e.offset+1),e.address);
    assert.equal(rom[e.secondOffset],0xcb);
    assert.equal(rom[e.secondOffset+1],e.cbOpcode);
    assert.equal(e.secondOffset,e.offset+3);
    assert.equal(e.operandsAndAdjacencyVerified,true);
    assert.equal(e.eventBitValueKnown,false);
    assert.equal(e.eventOutcomeCertified,false);
   }
  }
  assert.equal(atlas.summary.uniqueAsmFlagBitTestCandidates,tests);
  assert.equal(atlas.summary.uniqueAsmFlagBitSetCandidates,sets);
  assert.equal(atlas.summary.uniqueAsmFlagBitResetCandidates,resets);
  assert.equal(atlas.summary.asmBitEffectsExecuted,0);
 });
}
