'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {compileOne,compileWorldInteractionPrograms}=require('../romWorldInteractionProgramIR');
const position=0x18020;
const make=(bytes)=>{const rom=Buffer.alloc(1048576);rom.set(bytes,position);return rom;};
const base=(command)=>({
 mapId:2,kind:'NPC',ordinal:1,x:3,y:5,
 scriptFileOffset:position-10,scriptCommand:command,
 textPointerVerified:true,eventBitBindingVerified:false,
 eventBitIndex:null,asmCandidate:null,
 indirectTextTarget:null,specialDispatchReference:null
});
test('complete linear text has independently known presentation opcode semantics, not game outcome',()=>{
 const rom=make([0,0x87,0xa8,0x57,0x08,0x50]);
 const p=compileOne({rom,reference:{...base('TX_FAR'),
  indirectTextTarget:{fileOffset:position,bank:6,cpu:0x4020}}});
 assert.equal(p.verified,true);
 assert.equal(p.programClass,'LINEAR_PRESENTATION_TEXT');
 assert.equal(p.textProcessorCommandsVerified,true);
 assert.equal(p.gameEventBitWriteByTextOpcodes,false);
 assert.equal(p.gameplayEffectsFullyInterpreted,false);
 assert.equal(p.mapScriptConditionsFullyInterpreted,false);
 assert.equal(p.observedExecution,false);
 assert.equal(p.eventCompleted,null);
 assert.equal(p.accessibleNow,null);
});
test('text reading live RAM is still presentation-only, not a captured memory value',()=>{
 const rom=make([1,0x00,0xc0,0,0x80,0x57]);
 const p=compileOne({rom,reference:{...base('TX_FAR'),
  indirectTextTarget:{fileOffset:position}}});
 assert.equal(p.textProcessorCommandsVerified,true);
 assert.equal(p.containsRuntimeRenderingCommands,true);
 assert.equal(p.gameplayEffectsFullyInterpreted,false);
});
test('ASM byte inside a far text target never becomes a certified linear stream',()=>{
 const rom=make([0,0x80,0x50,0x08,0x50]);
 const p=compileOne({rom,reference:{...base('TX_FAR'),
  indirectTextTarget:{fileOffset:position}}});
 assert.equal(p.textProcessorCommandsVerified,false);
 assert.equal(p.programClass,'FAR_TEXT_NOT_LINEARLY_INTERPRETED');
});
test('unresolved far pointer cannot fabricate semantics',()=>{
 const p=compileOne({rom:make([0x00]),reference:base('TX_FAR')});
 assert.equal(p.programClass,'FAR_TARGET_NOT_RESOLVED');
 assert.equal(p.gameplayEffectsFullyInterpreted,false);
});
test('special dispatch requires independently verified physical reference',()=>{
 const rom=make([0xff]);
 const r=base('SCRIPT_POKECENTER_NURSE');
 const no=compileOne({rom,reference:r});
 assert.equal(no.programClass,'SPECIAL_SERVICE_HANDLER_UNRESOLVED');
 const ok=compileOne({rom,reference:{...r,
  specialDispatchReference:{verified:true,handlerReferenceVerified:true,
   scriptFileOffset:r.scriptFileOffset,scriptCommand:r.scriptCommand,
   referenceHandler:'DisplayPokemonCenterDialogue',
   conditionalService:'POKEMON_CENTER_HEALING_DIALOGUE',
   staticItemIds:null}}});
 assert.equal(ok.programClass,'SPECIAL_SERVICE_DISPATCH');
 assert.equal(ok.conditionalServiceHandlerVerified,true);
 assert.equal(ok.gameplayEffectsFullyInterpreted,false);
});
test('ASM entrypoint does not imply branching and memory writes are understood',()=>{
 const rom=make([0x08]);
 const r=base('TX_START_ASM');
 const p=compileOne({rom,reference:{...r,asmCandidate:{
  verified:true,txAsmFileOffset:r.scriptFileOffset,opcodeCandidateCount:55}}});
 assert.equal(p.programClass,'ASM_CONTROL_FLOW_PENDING');
 assert.equal(p.asmCandidateInstructions,55);
 assert.equal(p.gameplayEffectsFullyInterpreted,false);
 assert.equal(p.observedExecution,false);
});
test('invalid object/ROM identity is never accepted as a physical reference',()=>{
 const rom=make([0]);
 assert.equal(compileOne({rom:Buffer.alloc(32),reference:base('TX_FAR')}).verified,false);
 assert.equal(compileOne({rom,reference:{...base('TX_FAR'),textPointerVerified:false}}).verified,false);
 assert.equal(compileOne({rom,reference:{...base('TX_FAR'),mapId:248}}).verified,false);
 assert.equal(compileWorldInteractionPrograms({rom,atlas:{}}).verified,false);
});
