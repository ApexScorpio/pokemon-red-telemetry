'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {packHandlers,unpackHandlers,interpretHandler,interpretWorld,resolveSemantics}=require('../romScriptSemantics');

test('shared traces and symbolic expressions roundtrip without losing any effects',()=>{
 const trace=Array.from({length:700},(_,i)=>0x18000+i);
 const conditions=Array.from({length:24},(_,i)=>({instructionOffset:i,predicate:{zero:{read:0xd747+i}},taken:true}));
 const effects=Array.from({length:100},(_,i)=>({instructionOffset:trace.at(-1),trace,conditions,value:{op:'ADD_BYTE',value:{read:0xd747},delta:-1},address:0xd747+i}));
 const h={handlerOffset:0x18000,effects,unresolved:[],complete:true};
 const packed=JSON.parse(JSON.stringify(packHandlers([h]))),[decoded]=unpackHandlers(packed);
 assert.deepEqual(decoded.effects,effects);assert.equal(decoded.complete,true);
 assert.ok(JSON.stringify(packed).length<JSON.stringify(h).length/10);
});

test('bounded frontier samples retain exact total, reason counts and incomplete status',()=>{
 const unresolved=Array.from({length:128},(_,offset)=>({offset,reason:offset%2?'PATH_BUDGET':'STEP_BUDGET',conditions:[]}));
 const [h]=unpackHandlers(packHandlers([{handlerOffset:1,effects:[],unresolved,complete:false}]));
 assert.equal(h.unresolved.length,4);assert.equal(h.unresolvedCount,128);
 assert.deepEqual(h.unresolvedReasonCounts,{STEP_BUDGET:64,PATH_BUDGET:64});
 assert.equal(h.unresolvedSamplesBounded,true);assert.equal(h.complete,false);
 assert.deepEqual(unpackHandlers(packHandlers([h]))[0],h);
});

test('serialized rows resolve the shared handler after JSON loading',()=>{
 const rom=Buffer.alloc(1048576),at=0x18020;
 rom.set([8,0x21,0x47,0xd7,0xcb,0xc6,0xc9],at);
 const references=[1,12,96].map(mapId=>({mapId,kind:'NPC',ordinal:1,scriptFileOffset:at,textPointerVerified:true,scriptCommand:'TX_START_ASM'}));
 const original=interpretWorld({rom,atlas:{romSha256:'fixture',references}});
 const loaded=JSON.parse(JSON.stringify(original));
 assert.equal(loaded.handlers,undefined);assert.equal(loaded.rows[0].semantics,undefined);
 const handlers=loaded.rows.map(r=>resolveSemantics(loaded,r));
 assert.ok(handlers.every(h=>h===handlers[0]));
 assert.deepEqual(handlers[0].effects,original.handlers[0].effects);
});

test('repeated symbolic branch predicates cannot contradict their earlier path',()=>{
 const rom=Buffer.alloc(1048576),at=0x18020;
 // BIT; JR Z to RET; JR NZ over an impossible write to the real write.
 rom.set([8,0x21,0x47,0xd7,0xcb,0x46,0x28,7,0x20,2,0xcb,0xc6,0xcb,0xce,0xc9,0xc9],at);
 const h=interpretHandler({rom,fileOffset:at});
 assert.equal(h.complete,true);assert.equal(h.effects.length,1);
 assert.equal(h.effects[0].value.bit,1);assert.equal(h.effects[0].conditions.length,1);
});

test('HALT cannot invent interrupt wake-up or certify subsequent writes',()=>{
 const rom=Buffer.alloc(1048576),at=0x18020;
 rom.set([8,0x76,0x21,0x47,0xd7,0xcb,0xc6,0xc9],at);
 const h=interpretHandler({rom,fileOffset:at});
 assert.equal(h.complete,false);assert.equal(h.effects.length,0);
 assert.equal(h.unresolved[0].offset,at+1);
 assert.equal(h.unresolved[0].reason,'HALT_REQUIRES_INTERRUPT_STATE');
});

const realRedRom=process.env.POKEGUIDE_T182_RED_ROM||process.env.POKEMON_RED_ROM;
test('real Red profile fits unchanged archive limits and preserves all physical effects',
 {skip:!realRedRom},()=>{
 const {readRom}=require('../romComprehensiveAudit');
 const {inspectRomBuffer}=require('../romVariantRegistry');
 const {writeArchiveEntries}=require('../romProfileArchive');
 const rom=readRom(realRedRom);
 const profile=inspectRomBuffer(rom,'red.gb'),world=profile.world.interactionScriptAtlas.scriptSemantics;
 const loaded=JSON.parse(JSON.stringify(world));
 for(let i=0;i<world.rows.length;i++){
  const original=world.rows[i].semantics;if(!original)continue;
  const restored=resolveSemantics(loaded,loaded.rows[i]);
  assert.deepEqual(restored.effects,original.effects);
  assert.equal(restored.complete,original.complete);
  assert.equal(restored.unresolvedCount,original.unresolved.length);
 }
 const prior=require('../../semantic-proof-t181.json').red;
 assert.equal(profile.hash.sha256,prior.sha);
 for(const effect of prior.examples)assert.ok(world.examples.some(e=>e.instructionOffset===effect.instructionOffset&&e.address===effect.address&&JSON.stringify(e.value)===JSON.stringify(effect.value)));
 assert.ok(world.formallyProvenScriptEffects>=prior.effects);
 const archived={...profile,capabilities:{...profile.capabilities,tmHmReadForSpecies:150}};
 const bytes=Buffer.byteLength(JSON.stringify(archived));
 assert.ok(bytes<=3*4*1024*1024);
 const zip=writeArchiveEntries([['pokemon_red_rom_profile.json',archived]]);
 assert.ok(zip.length>0);
 console.log(JSON.stringify({targetedRealRed:'PASS',profileBytes:bytes,zipBytes:zip.length,handlers:world.handlers.length,effects:world.formallyProvenScriptEffects}));
});
