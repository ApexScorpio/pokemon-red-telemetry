'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {interpretHandler,interpretWorld,resolveSemantics,guidanceForSemantics}=require('../romScriptSemantics');
const entry=0x18020;
function fixture(prefix){
 const rom=Buffer.alloc(1048576);rom[0x147]=0x13;rom[0x148]=5;
 rom.set([8,...prefix,0xcd,0,1,0xc9],entry);
 // Real Red ROM0 0x35d9..0x35de: LD A,B; LDH [B8],A; LD [2000],A.
 // Remaining dispatcher/targets are synthetic, not real gameplay evidence.
 rom.set([0x78,0xe0,0xb8,0xea,0,0x20,0xcd,0,0x40,0x3e,6,0xea,0,0x20,0xc9],0x100);
 rom.set([0x21,0x47,0xd7,0xcb,0xc6,0xc9],0x8000);
 return rom;
}
test('HRAM equality path proves one bank and exact physical target, excluding the unequal sibling',()=>{
 // CP 2; JR NZ to RET; LD B,A; call dispatcher.
 const rom=fixture([0xf0,0xb8,0xfe,2,0x20,1,0x47]);
 // JR NZ must skip dispatcher to the final RET.
 rom[entry+6]=4;
 const h=interpretHandler({rom,fileOffset:entry});
 assert.equal(h.complete,true);assert.equal(h.effects.filter(e=>e.gameplayStateTransitionProven).length,1);
 const e=h.effects.find(e=>e.gameplayStateTransitionProven);
 assert.equal(e.instructionOffset,0x8003);assert.equal(e.address,0xd747);
 assert.deepEqual(e.conditions,[{instructionOffset:entry+5,predicate:{not:{equals:[{read:0xffb8},2]}},taken:false}]);
 assert.ok(e.trace.includes(0x103));assert.ok(e.trace.includes(0x8000));
 assert.equal(e.observedExecution,false);
 const references=[12,35,96,227].map(mapId=>({mapId,kind:'NPC',ordinal:1,scriptFileOffset:entry,textPointerVerified:true,scriptCommand:'TX_START_ASM'}));
 const world=JSON.parse(JSON.stringify(interpretWorld({rom,atlas:{references}})));
 assert.equal(world.formallyProvenScriptEffects,1);
 for(const row of world.rows){
  const g=guidanceForSemantics(resolveSemantics(world,row)).find(e=>e.gameplayStateTransitionProven);
  assert.deepEqual(g.conditionsInCurrentSnapshot,['UNKNOWN']);assert.equal(g.eventCompleted,null);
 }
});
test('conditional bank effects reach checklist and advisor on every applicable reference',()=>{
 const {buildMapChecklist}=require('../romWorldChecklist');
 const {adviseWorld}=require('../romWorldStateAdvisor');
 const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
 const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
 // Synthetic profile with an accepted identity exercises the existing SHA guards.
 for(const mapId of [15,96,227]){
  const rom=fixture([0xf0,0xb8,0xfe,2,0x20,4,0x47]);
  const data=Array.from({length:248},(_,id)=>({mapId:id,valid:id<225||id===mapId,objects:{objects:[],signs:[],warps:[]}}));
  if(mapId<225)data[225].valid=true;
  data[mapId].objects.objects=[{kind:'npc',x:2,y:3,spriteId:1,textId:1}];
  const ref={mapId,kind:'NPC',ordinal:1,x:2,y:3,rawTextId:1,scriptFileOffset:entry,textPointerVerified:true,scriptCommand:'TX_START_ASM'};
  const atlas={verified:true,romSha256:sha,references:[ref],maps:data.map(m=>({mapId:m.mapId,verified:m.valid,interactions:m.mapId===mapId?[ref]:[]}))};
  atlas.scriptSemantics=JSON.parse(JSON.stringify(interpretWorld({rom,atlas})));
  const profile={hash:{sha256:sha},world:{maps:{valid:true,validMapHeaders:226,data},interactionScriptAtlas:atlas}};
  const index=buildWorldContentsIndex(profile);
  const action=buildMapChecklist({index,mapId,scriptAtlas:atlas}).actions[0];
  const effect=action.scriptPredictedEffects.find(e=>e.gameplayStateTransitionProven);
  assert.equal(effect.instructionOffset,0x8003);assert.deepEqual(effect.conditionsInCurrentSnapshot,['UNKNOWN']);
  assert.equal(action.completedNow,null);assert.equal(action.scriptEffectSemanticsVerified,false);
  const advice=adviseWorld({profile,mapId,position:{x:1,y:1},positionVerified:true});
  assert.ok(advice.observations.some(o=>o.predictedEffects?.some(e=>e.instructionOffset===0x8003&&e.observedExecution===false)));
  atlas.scriptSemantics.romSha256='wrong';
  assert.equal(buildMapChecklist({index,mapId,scriptAtlas:atlas}).actions[0].scriptPredictedEffects.length,0);
 }
});
test('unconstrained HRAM stops with bounded banks and preserves earlier ASM effects',()=>{
 const rom=fixture([0x21,0x48,0xd7,0xcb,0xce,0xf0,0xb8,0x47]);
 const h=interpretHandler({rom,fileOffset:entry});
 assert.equal(h.complete,false);assert.equal(h.effects.filter(e=>e.gameplayStateTransitionProven).length,1);
 const u=h.unresolved[0];assert.equal(u.offset,0x103);
 assert.equal(u.bankSelection.sourceAddress,0xffb8);assert.equal(u.bankSelection.feasibleByteCount,256);
 assert.equal(u.bankSelection.candidateBankCount,127);assert.equal(u.bankSelection.selectedBanks.length,8);
 assert.equal(u.bankSelection.candidatesBounded,true);
});
test('masked HRAM equality ignores bit seven only when all feasible bytes select the same bank',()=>{
 const rom=fixture([0xf0,0xb8,0x47,0xe6,0x7f,0xfe,2,0x20,3,0x78,0x18,1,0xc9]);
 const h=interpretHandler({rom,fileOffset:entry});
 assert.equal(h.complete,true);assert.equal(h.effects.find(e=>e.gameplayStateTransitionProven).instructionOffset,0x8003);
});
test('out-of-file conditional bank and bounded exploration cannot certify a target',()=>{
 const rom=fixture([0xf0,0xb8,0xfe,64,0x20,4,0x47]);
 const h=interpretHandler({rom,fileOffset:entry});
 assert.equal(h.complete,false);assert.equal(h.effects.filter(e=>e.gameplayStateTransitionProven).length,0);
 assert.ok(h.unresolved.some(u=>u.reason==='ROM_BANK_OR_TARGET_UNKNOWN'));
 for(const limits of [{maxPaths:1},{maxSteps:2}]){
  const bounded=interpretHandler({rom,fileOffset:entry,...limits});
  assert.equal(bounded.complete,false);assert.equal(bounded.effects.length,0);
 }
});
