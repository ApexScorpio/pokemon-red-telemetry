'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {interpretHandler,interpretWorld,guidanceForSemantics}=require('../romScriptSemantics');
const at=0x18020;
function run(bytes,extra){const rom=Buffer.alloc(1048576);rom.set([8,...bytes],at);if(extra)extra(rom);return interpretHandler({rom,fileOffset:at});}
test('event test preserves both branches and sets/resets physical event bits',()=>{
 const r=run([0x21,0x47,0xd7,0xcb,0x46,0x28,3,0xcb,0xce,0xc9,0xcb,0x8e,0xc9]);
 assert.equal(r.complete,true);assert.equal(r.effects.length,2);
 assert.deepEqual(new Set(r.effects.map(e=>e.value.op)),new Set(['SET_BIT','RESET_BIT']));
 assert.ok(r.effects.every(e=>e.address===0xd747&&e.value.bit===1&&e.conditions.length===1));
 assert.equal(r.effects[0].conditions[0].predicate.bitClear.value.read,0xd747);
 assert.equal(r.eventCompleted,null);
});
test('known comparison eliminates unreachable event write',()=>{
 const r=run([0xaf,0xfe,0,0x20,6,0x21,0x47,0xd7,0xcb,0xc6,0xc9,0x21,0x48,0xd7,0xcb,0xc6,0xc9]);
 assert.equal(r.effects.length,1);assert.equal(r.effects[0].address,0xd747);
});
test('actual CALL is followed and RET restores continuation',()=>{
 const r=run([0xcd,0x40,0x40,0x21,0x48,0xd7,0xcb,0xce,0xc9],rom=>rom.set([0x21,0x47,0xd7,0xcb,0xc6,0xc9],0x18040));
 assert.equal(r.complete,true);assert.deepEqual(r.effects.map(e=>e.address),[0xd747,0xd748]);
 assert.ok(r.effects[0].trace.includes(at+1));
});
test('unsupported helper prevents claiming writes after CALL',()=>{
 const r=run([0xcd,0x40,0x40,0x21,0x47,0xd7,0xcb,0xc6,0xc9],rom=>rom[0x18040]=0xe9);
 assert.equal(r.effects.length,0);assert.equal(r.complete,false);
});
test('bank writes halt before any subsequent event effect',()=>{
 const r=run([0x3e,2,0xea,0,0x20,0x21,0x47,0xd7,0xcb,0xc6,0xc9]);
 assert.equal(r.effects.length,0);assert.equal(r.unresolved[0].reason,'UNRESOLVED_MEMORY_OR_BANK_WRITE');
});
test('fixed ROM calls use actual bytes in ROM0 with caller bank retained',()=>{
 const r=run([0xcd,0,1,0xc9],rom=>rom.set([0x21,0x47,0xd7,0xcb,0xd6,0xc9],0x100));
 assert.equal(r.effects[0].instructionOffset,0x103);assert.equal(r.effects[0].value.bit,2);
});
test('world propagation evaluates a physical handler once across arbitrary maps',()=>{
 const rom=Buffer.alloc(1048576);rom.set([8,0x21,0x47,0xd7,0xcb,0xc6,0xc9],at);
 const references=[1,19,227].map(mapId=>({mapId,kind:'NPC',ordinal:1,x:2,y:3,scriptFileOffset:at,textPointerVerified:true,scriptCommand:'TX_START_ASM'}));
 const r=interpretWorld({rom,atlas:{references,romSha256:'fixture'}});
 assert.equal(r.handlers.length,1);assert.equal(r.formallyProvenScriptEffects,1);
 assert.ok(r.rows.every(x=>x.semantics===r.handlers[0]));
 const g=guidanceForSemantics(r.handlers[0],{verified:true,bits:[{bitIndex:0,flagSet:true}]});
 assert.equal(g[0].observedCurrentBit,true);assert.equal(g[0].eventCompleted,null);
 assert.equal(g[0].status,'PREDICTED_CONDITIONAL_EFFECT');
});
test('conditional call retains both paths, conditional root return stops taken path',()=>{
 const r=run([0xc8,0x21,0x47,0xd7,0xcb,0xc6,0xc9]);
 assert.equal(r.effects.length,1);assert.equal(r.effects[0].conditions[0].taken,false);
 assert.equal(r.returns,2);
});
test('checklist and advisor consume actual derived transitions for any matching map',()=>{
 const {buildMapChecklist}=require('../romWorldChecklist');
 const {adviseWorld}=require('../romWorldStateAdvisor');
 const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
 for(const mapId of [15,96,227]){
  const actor={kind:'npc',x:2,y:3,spriteId:1,textId:1};
  const data=Array.from({length:248},(_,id)=>({mapId:id,valid:id<225||id===mapId,objects:{objects:[],signs:[],warps:[]}}));
  // Keep exactly 226 normal headers regardless of the chosen map.
  if(mapId<225)data[225].valid=true;
  data[mapId].objects.objects=[actor];
  const rom=Buffer.alloc(1048576);rom.set([8,0x21,0x47,0xd7,0xcb,0xc6,0xc9],at);
  const ref={mapId,kind:'NPC',ordinal:1,x:2,y:3,rawTextId:1,scriptFileOffset:at,textPointerVerified:true,scriptCommand:'TX_START_ASM'};
  const atlas={verified:true,romSha256:sha,references:[ref],maps:Array.from({length:248},(_,id)=>({mapId:id,verified:data[id].valid,interactions:id===mapId?[ref]:[]}))};
  atlas.scriptSemantics=interpretWorld({rom,atlas});
  const profile={hash:{sha256:sha},world:{maps:{valid:true,validMapHeaders:226,data},interactionScriptAtlas:atlas}};
  const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
  const index=buildWorldContentsIndex(profile);
  const list=buildMapChecklist({index,mapId,scriptAtlas:atlas});
  assert.equal(list.actions[0].scriptPredictedEffects.length,1);
  assert.equal(list.actions[0].completedNow,null);
  const advice=adviseWorld({profile,mapId,position:{x:1,y:1},positionVerified:true});
  assert.ok(advice.observations.some(o=>o.status==='PREDICTED_CONDITIONAL_EFFECT'));
  atlas.scriptSemantics.romSha256='wrong';
  assert.equal(buildMapChecklist({index,mapId,scriptAtlas:atlas}).actions[0].scriptPredictedEffects.length,0);
 }
});
test('generic WRAM transitions are interpreted but excluded from gameplay proof counter',()=>{
 const rom=Buffer.alloc(1048576);rom.set([8,0x3e,2,0xea,0x65,0xd6,0xc9],at);
 const r=interpretWorld({rom,atlas:{references:[{mapId:96,kind:'NPC',ordinal:2,textPointerVerified:true,scriptCommand:'TX_START_ASM',scriptFileOffset:at}]}});
 assert.equal(r.handlers[0].effects[0].address,0xd665);
 assert.equal(r.handlers[0].effects[0].value,2);
 assert.equal(r.formallyProvenScriptEffects,0);
});
test('snapshot branch matching is separate from an observed completed event',()=>{
 const r=run([0x21,0x47,0xd7,0xcb,0x46,0x28,3,0xcb,0xce,0xc9,0xcb,0x8e,0xc9]);
 const bits=Array.from({length:8},(_,bitIndex)=>({bitIndex,flagSet:bitIndex===0}));
 const g=guidanceForSemantics(r,{verified:true,bits});
 assert.deepEqual(new Set(g.map(e=>e.conditionsInCurrentSnapshot[0])),new Set(['MATCHES','DOES_NOT_MATCH']));
 assert.ok(g.every(e=>e.eventCompleted===null&&e.observedExecution===false));
});
test('same offset in different ROM bytes is independently interpreted',()=>{
 const set=run([0x21,0x47,0xd7,0xcb,0xc6,0xc9]);
 const reset=run([0x21,0x47,0xd7,0xcb,0x86,0xc9]);
 assert.equal(set.effects[0].value.op,'SET_BIT');
 assert.equal(reset.effects[0].value.op,'RESET_BIT');
});
test('the proof counter deduplicates a shared physical callee across handlers',()=>{
 const rom=Buffer.alloc(1048576);rom.set([0x21,0x47,0xd7,0xcb,0xc6,0xc9],0x100);
 const refs=[at,at+20].map((scriptFileOffset,i)=>{
  rom.set([8,0xcd,0,1,0xc9],scriptFileOffset);
  return {mapId:i,kind:'NPC',ordinal:1,textPointerVerified:true,scriptCommand:'TX_START_ASM',scriptFileOffset};
 });
 const r=interpretWorld({rom,atlas:{references:refs}});
 assert.equal(r.handlers.length,2);assert.equal(r.formallyProvenScriptEffects,1);
});
test('an identity mask and writeback is not counted as a gameplay transition',()=>{
 const r=run([0xfa,0x47,0xd7,0xe6,255,0xea,0x47,0xd7,0xc9]);
 assert.equal(r.effects.length,0);assert.equal(r.complete,true);
});
