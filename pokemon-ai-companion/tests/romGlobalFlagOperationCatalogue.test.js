'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildGlobalFlagOperationCatalogue,getMapFlagOperationCandidates}
 =require('../romGlobalFlagOperationCatalogue');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
function fixture(){
 const maps=Array.from({length:248},(_,mapId)=>({mapId,interactions:[]}));
 const summary={referencedInteractions:1126,
  uniqueAsmFlagBitTestCandidates:90,uniqueAsmFlagBitSetCandidates:41,
  uniqueAsmFlagBitResetCandidates:4,
  uniqueAsmFlagConditionalBranchGates:88,
  uniqueAsmFlagDualTextAlternatives:16};
 for(let i=0;i<1126;i++){
  const mapId=i%248,kind='NPC';
  const ordinal=Math.floor(i/248)+1;
  const handlerOffset=0x18000+(i%516)*16;
  const isAsm=i<626;
  const pattern=[];
  if(isAsm&&i%516<135){
   const order=i%516;
   const op=order<90?'BIT_TEST':order<131?'SET_BIT':'RESET_BIT';
   const branch=order<88?{verified:true,condition:'NZ',branchActuallyTaken:null,
    jumpTakenIfBitSet:true}:null;
   const dual=order<16?{verified:true,
    alternativeTextScriptsStaticallyProven:true,
    dialogueShown:false,playerEffectVerified:false}:null;
   const src=op==='BIT_TEST'?0xfa:0x21;
   const cbBase=op==='BIT_TEST'?0x40:op==='SET_BIT'?0xc0:0x80;
   pattern.push({
    operation:op,domain:'WORLD_EVENT_BIT',bitIndex:order,
    address:0xd747+Math.floor(order/8),offset:handlerOffset+1,
    secondOffset:handlerOffset+4,bitNumber:order%8,bank:6,
    cpu:0x4000+(handlerOffset+1)%0x4000,
    firstOpcode:src,secondOpcode:0xcb,
    cbOpcode:cbBase+((order%8)<<3)+(src===0xfa?7:6),
    operandsAndAdjacencyVerified:true,
    instructionSequenceExecuted:false,eventBitValueKnown:false,
    eventOutcomeCertified:false,staticConditionalBranch:branch,
    staticDualTextChoice:dual
   });
  }
  maps[mapId].interactions.push({
   mapId,kind,ordinal,scriptCommand:isAsm?'TX_START_ASM':'TX_FAR',
   scriptFileOffset:isAsm?handlerOffset:null,
   asmMemoryEffectExecuted:false,
   asmCandidate:isAsm?{verified:true,txAsmFileOffset:handlerOffset,
    adjacentRomFlagBitPatterns:pattern,
    adjacentRomFlagBitInstructionsExecuted:false}:null
  });
 }
 return {verified:true,romSha256:KNOWN.red,summary,maps};
}
test('all 135 handler-scoped patterns are indexed by physical opcode, actor and map',()=>{
 const atlas=fixture(),a=buildGlobalFlagOperationCatalogue({atlas});
 assert.equal(a.verified,true,a.reason);
 assert.equal(a.totalHandlerScopedOperations,135);
 assert.equal(a.totalPhysicallyDecodedOperations,135);
 assert.equal(a.distinctHandlerRefs,516);
 assert.equal(a.asmActorReferences,626);
 assert.deepEqual(a.handlerScopedOperationCounts,
  {BIT_TEST:90,SET_BIT:41,RESET_BIT:4});
 assert.equal(a.handlerScopedBitBranches,88);
 assert.equal(a.handlerScopedDualTextChoices,16);
 assert.equal(a.handlerScopedWritesIfExecuted,45);
 assert.equal(a.conditionalMemoryWritesIfExecuted,45);
 assert.equal(a.unconditionalGameplayEffectsCertified,0);
 assert.equal(a.operationReferences,245);
 assert.ok(a.mapsWithBitOperations>0);
 const map0=getMapFlagOperationCandidates({atlas,mapId:0});
 assert.equal(map0.verified,true,map0.reason);
 assert.equal(map0.mapId,0);
 assert.ok(map0.operations.some(x=>x.bitIndex===0));
 assert.ok(map0.operations.every(x=>
  x.instructionExecuted===false&&
  x.interactionEffectVerified===false&&
  x.bitValueInCurrentSave===null));
 assert.equal(map0.eventsExecutedVerified,0);
 assert.ok(map0.operations.every(x=>
  x.ifExecuted?.verified===true&&
  x.ifExecuted.instructionActuallyExecuted===false));
 const empty=getMapFlagOperationCandidates({atlas,mapId:247});
 assert.equal(empty.verified,true);
 assert.equal(empty.operations.length,0);
});
test('reject forged ROM identities, incomplete maps and false runtime outcomes',()=>{
 const a=fixture();a.romSha256='f'.repeat(64);
 assert.equal(buildGlobalFlagOperationCatalogue({atlas:a}).verified,false);
 const b=fixture();b.maps[4].mapId=5;
 assert.equal(buildGlobalFlagOperationCatalogue({atlas:b}).verified,false);
 const c=fixture();c.summary.uniqueAsmFlagBitSetCandidates=42;
 assert.equal(buildGlobalFlagOperationCatalogue({atlas:c}).verified,false);
 const d=fixture();d.maps[0].interactions[0].asmCandidate
  .adjacentRomFlagBitPatterns[0].instructionSequenceExecuted=true;
 assert.equal(buildGlobalFlagOperationCatalogue({atlas:d}).verified,false);
 assert.equal(getMapFlagOperationCandidates({atlas:fixture(),mapId:-1}).verified,false);
 assert.equal(getMapFlagOperationCandidates({atlas:fixture(),mapId:248}).verified,false);
});
for(const [name,env] of [['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']]){
 test('original '+name+' ROM: every physical BIT/SET/RES in map scripts remains unexecuted',
 {skip:!process.env[env]?'Original ROM input not provided':false},()=>{
  const rom=readRom(process.env[env]);
  const p=inspectRomBuffer(rom,name+'.gb');
  assert.equal(p.hash.sha256,KNOWN[name]);
  const atlas=p.world.interactionScriptAtlas;
  const a=buildGlobalFlagOperationCatalogue({atlas});
  assert.equal(a.verified,true,a.reason);
  assert.equal(a.totalHandlerScopedOperations,135);
  assert.deepEqual(a.handlerScopedOperationCounts,
   {BIT_TEST:90,SET_BIT:41,RESET_BIT:4});
  assert.equal(a.handlerScopedBitBranches,88);
  assert.equal(a.handlerScopedDualTextChoices,16);
  assert.equal(a.handlerScopedWritesIfExecuted,45);
  assert.ok(a.conditionalMemoryWritesIfExecuted>0);
  assert.ok(a.conditionalMemoryWritesIfExecuted<=45);
  assert.equal(a.unconditionalGameplayEffectsCertified,0);
  assert.equal(a.asmActorReferences,626);
  assert.equal(a.distinctHandlerRefs,516);
  assert.ok(a.totalPhysicallyDecodedOperations>0);
  assert.ok(a.totalPhysicallyDecodedOperations<=135);
  assert.equal(a.perMap.length,248);
  assert.equal(a.executedOperationsCertified,0);
  const mapViews=new Map();
  for(const e of a.operations){
   if(e.operation==='BIT_TEST')
    assert.ok([0xfa,0x21].includes(rom[e.opcodeFileOffset]));
   else assert.equal(rom[e.opcodeFileOffset],0x21);
   assert.equal(rom.readUInt16LE(e.opcodeFileOffset+1),e.operandAddress);
   assert.equal(rom[e.bitInstructionFileOffset],0xcb);
   assert.equal(e.instructionExecuted,false);
   assert.equal(e.causalEffectVerified,false);
   assert.equal(e.bitValueInCurrentSave,null);
   assert.equal(e.ifExecuted.verified,true);
   assert.equal(e.ifExecuted.instructionActuallyExecuted,false);
   assert.equal(e.ifExecuted.scriptRewardVerified,false);
   assert.equal(e.ifExecuted.memoryBitWriteIfExecuted,
    e.operation==='SET_BIT'||e.operation==='RESET_BIT');
   assert.ok(e.invokedBy.length>=1);
   for(const actor of e.invokedBy){
    if(!mapViews.has(actor.mapId))
     mapViews.set(actor.mapId,getMapFlagOperationCandidates({
      atlas,mapId:actor.mapId}));
    const perMap=mapViews.get(actor.mapId);
    assert.equal(perMap.verified,true,perMap.reason);
    assert.ok(perMap.operations.some(x=>
      x.physicalOperationId===e.physicalOperationId&&
      x.actorId===actor.actorId));
   }
  }
 });
}
