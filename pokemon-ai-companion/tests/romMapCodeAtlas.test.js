'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {cpuToOffset,decodeOpcode,mapScriptAndTextReferences,staticCodeGraph,auditMapCodeAtlas}=require('../romMapCodeAtlas');
const SHA={red:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',blue:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',green:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'};
const fixture=()=>Buffer.alloc(0x8000);
test('CPU addresses: fixed bank, switchable bank, invalid VRAM',()=>{
 assert.equal(cpuToOffset(0,0x100,32768),0x100);
 assert.equal(cpuToOffset(1,0x4000,32768),0x4000);
 assert.equal(cpuToOffset(1,0x8000,32768),null);
 assert.equal(cpuToOffset(0,0x4000,32768),null);
});
test('decode JR signed, CALL, CB prefix and rejects illegal opcodes',()=>{
 const b=fixture();b.set([0x20,0xfe,0xcd,0x10,0x00,0xcb,0x11,0xd3],0x4000);
 const a=decodeOpcode(b,1,0x4000);assert.equal(a.size,2);assert.equal(a.targets[0].pc,0x4000);
 const call=decodeOpcode(b,1,0x4002);assert.equal(call.targets[0].pc,0x10);
 assert.equal(decodeOpcode(b,1,0x4005).size,2);
 assert.equal(decodeOpcode(b,1,0x4007).ok,false);
});
test('bank 0 -> unknown switchable target cannot be assigned a guessed bank',()=>{
 const b=fixture();b.set([0xcd,0x10,0x40,0xc9],0x100);
 const g=staticCodeGraph(b,[{bank:0,pc:0x100}],{maxInstructions:50});
 assert.equal(g.instructions,2);assert.equal(g.candidateInstructionBytes,4);
 assert.ok(g.unresolvedTargets.some(x=>x.reason.includes('unknown')));
});
test('map header script and text tables follow verified pointers only',()=>{
 const b=fixture();const head=0x4200;
 b.writeUInt16LE(0x4300,head+5);b.writeUInt16LE(0x4400,head+7);
 b.writeUInt16LE(0x4500,0x4300);b.set([0xc9],0x4400);
 const maps=[{valid:true,mapId:0,mapBank:1,mapHeaderPointerCpu:0x4200,
  objects:{objects:[{textId:1}],signs:[]}}];
 const out=mapScriptAndTextReferences(b,maps);
 assert.equal(out.totals.scriptSeeds,1);assert.equal(out.totals.referencedTextEntries,1);
 assert.equal(out.maps[0].textReferences[0].fileOffset,0x4500);
 const graph=staticCodeGraph(b,out.scriptSeeds,{maxInstructions:20});assert.equal(graph.instructions,1);
 assert.equal(graph.candidateInstructionBytes,1);
});
test('fails closed on malformed ROM, map root and boundary-crossing 16 bit instruction',()=>{
 const b=fixture();b[0x7fff]=0xcd;
 assert.equal(decodeOpcode(b,1,0x7fff).ok,false);
 assert.throws(()=>mapScriptAndTextReferences(b,{}));
 assert.throws(()=>staticCodeGraph(b,[{bank:null,pc:0x4000}]));
});
const input={red:process.env.POKEMON_RED_ROM,blue:process.env.POKEMON_BLUE_ROM,green:process.env.POKEMON_GREEN_ROM};
const atlasPath=process.env.POKEGUIDE_INVENTORY_JSON;
for(const name of Object.keys(SHA)){
 test('real ROM '+name+' / map header pointers and graph',{skip:!input[name]||!atlasPath},()=>{
  const b=require('../romComprehensiveAudit').readRom(input[name]);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),SHA[name]);
  const maps=JSON.parse(fs.readFileSync(atlasPath,'utf8')).variants[name].catalogue.maps;
  const result=auditMapCodeAtlas(b,maps,{maxInstructions:40000});
  assert.equal(result.totals.scriptSeeds,226);
  assert.ok(result.totals.referencedTextEntries>200);
  assert.ok(result.graph.instructions>100);
  assert.equal(result.graph.verified,false);
  assert.equal(result.semantic100PercentCertified,false);
  assert.ok(result.graph.byBank.length===64);
 });
}