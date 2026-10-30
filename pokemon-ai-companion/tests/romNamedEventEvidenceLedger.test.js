'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildNamedEventEvidenceLedger}=require('../romNamedEventEvidenceLedger');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
test('a name list or unknown ROM alone cannot claim 507 resolved scripts',()=>{
 const a=buildNamedEventEvidenceLedger({});
 assert.equal(a.verified,false);
 assert.equal(a.semanticallyComplete,false);
 assert.equal(buildNamedEventEvidenceLedger({atlas:{
  verified:true,romSha256:KNOWN.red,
  maps:[],summary:{referencedInteractions:1126}
 }}).verified,false);
});
for(const [variant,env] of [['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']]){
 test('real '+variant+' ROM: group 507 named event labels by opcode, header and unresolved evidence',
 {skip:!process.env[env]?'Original ROM input required':false},()=>{
  const rom=readRom(process.env[env]);
  const p=inspectRomBuffer(rom,variant+'.gb');
  assert.equal(p.hash.sha256,KNOWN[variant]);
  const ledger=buildNamedEventEvidenceLedger({
   atlas:p.world.interactionScriptAtlas});
  assert.equal(ledger.verified,true,ledger.reason);
  assert.equal(ledger.romSha256,KNOWN[variant]);
  assert.equal(ledger.flags.length,507);
  const s=ledger.summary;
  assert.equal(s.totalEventFlagBitSlots,2560);
  assert.equal(s.namedReferenceEvents,507);
  assert.equal(s.unnamedOrReservedBitSlots,2053);
  assert.equal(Object.values(s.categories).reduce((a,b)=>a+b,0),507);
  assert.equal(s.namedBitsWithRomOpcode,
   s.categories.ROM_OPCODE_ONLY+s.categories.BOTH_OPCODE_AND_HEADER);
  assert.equal(s.namedBitsWithActorHeaderBinding,
   s.categories.HEADER_BINDING_ONLY+s.categories.BOTH_OPCODE_AND_HEADER);
  assert.equal(s.namedBitsWithoutAnyDirectEvidence,
   s.categories.NO_DIRECT_EVIDENCE);
  assert.ok(s.namedBitsWithRomOpcode>0);
  assert.ok(s.namedBitsWithRomOpcode<507);
  assert.equal(s.fullyExplainedNamedEvents,0);
  assert.equal(s.eventCompletionsObserved,0);
  assert.equal(ledger.semanticallyComplete,false);
  assert.equal(ledger.flagsCurrentValuesObserved,false);
  const gaps=ledger.unresolvedNamedFlagEvidence;
  assert.equal(gaps.gameplayCompletionEvidence,false);
  assert.equal(gaps.noDirectEvidenceCount,
   s.categories.NO_DIRECT_EVIDENCE);
  assert.equal(gaps.headerOnlyCount,
   s.categories.HEADER_BINDING_ONLY);
  assert.equal(gaps.noDirectEvidenceFlags.length,gaps.noDirectEvidenceCount);
  assert.equal(gaps.headerOnlyFlags.length,gaps.headerOnlyCount);
  assert.equal(gaps.noDirectEvidenceFlags.every(x=>
   x.eventCompleted===null&&x.romOpcodeCount===0&&
   x.romHeaderActorCount===0),true);
  assert.equal(gaps.headerOnlyFlags.every(x=>
   x.eventCompleted===null&&x.romOpcodeCount===0&&
   x.romHeaderActorCount>0),true);
  const expectedNoEvidence=ledger.flags.filter(x=>
   x.evidenceCategory==='NO_DIRECT_EVIDENCE').map(x=>x.bitIndex);
  const expectedHeaderOnly=ledger.flags.filter(x=>
   x.evidenceCategory==='HEADER_BINDING_ONLY').map(x=>x.bitIndex);
  assert.deepEqual(gaps.noDirectEvidenceFlags.map(x=>x.bitIndex),
   expectedNoEvidence);
  assert.deepEqual(gaps.headerOnlyFlags.map(x=>x.bitIndex),
   expectedHeaderOnly);
  const named=new Map(ledger.flags.map(x=>[x.bitIndex,x]));
  assert.equal(named.size,507);
  for(const [bit,name] of [
   [192,'EVENT_GOT_BICYCLE'],
   [342,'EVENT_SEEL_FAN_BOAST'],
   [343,'EVENT_PIKACHU_FAN_BOAST'],
   [1231,'EVENT_RESCUED_MR_FUJI'],
   [1406,'EVENT_GOT_DOME_FOSSIL']
  ]){
   const row=named.get(bit);
   assert.equal(row.referenceEventName,name);
   assert.equal(row.nameIntrinsicToRom,false);
   assert.ok(row.romOpcodeCount>=1,'Expected direct ROM event flag evidence for '+bit);
   assert.equal(row.eventCompleted,null);
   assert.equal(row.actualGameplayOutcomeProven,false);
   assert.equal(row.fullScriptCausalityVerified,false);
  }
  for(const flag of ledger.flags){
   assert.equal(flag.gameFlagSetInCurrentSave,null);
   assert.equal(flag.eventActuallyTriggered,null);
   assert.equal(flag.semanticCausalChainCertified,false);
   for(const op of [
    ...flag.readerPhysicalOpcodes,
    ...flag.writerSetPhysicalOpcodes,
    ...flag.writerResetPhysicalOpcodes
   ]){
    assert.ok(Number.isInteger(op.opcodeFileOffset));
    assert.equal(op.instructionExecuted,false);
    assert.equal(op.gameplayEffectVerified,false);
    assert.ok(op.actorCount>=1);
   }
   for(const a of flag.boundActorReferences){
    assert.ok(a.mapId>=0&&a.mapId<248);
    assert.equal(a.scriptExecuted,false);
    assert.equal(a.actorCompletionVerified,false);
   }
  }
 });
}
