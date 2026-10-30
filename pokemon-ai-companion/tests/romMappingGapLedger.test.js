'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildMappingGapLedger}=require('../romMappingGapLedger');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
const {buildCampaignWorldTracker}=require('../romCampaignWorldTracker');
test('global gap ledger rejects missing and incompatible source evidence',()=>{
 const missing=buildMappingGapLedger({});
 assert.equal(missing.verified,false);
 assert.equal(missing.mapping100PercentCertified,false);
 const fake=buildMappingGapLedger({profile:{hash:{sha256:'a'.repeat(64)}},
  index:{verified:true,romSha256:'b'.repeat(64)},
  scriptAtlas:{verified:true,romSha256:'b'.repeat(64)},
  tracker:{verified:true,romSha256:'b'.repeat(64)}});
 assert.equal(fake.verified,false);
});
for(const [variant,name] of [['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']]){
 test('actual '+variant+' ROM produces a complete 248-ID gap inventory without invented semantics',
 {skip:!process.env[name]?'Requires exact original ROM':false},()=>{
  const rom=readRom(process.env[name]);
  const profile=inspectRomBuffer(rom,variant+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[variant]);
  const index=buildWorldContentsIndex(profile);
  const scriptAtlas=profile.world.interactionScriptAtlas;
  const tracker=buildCampaignWorldTracker({index,scriptAtlas});
  const ledger=buildMappingGapLedger({profile,index,scriptAtlas,tracker});
  assert.equal(ledger.verified,true,ledger.reason);
  assert.equal(ledger.maps.length,248);
  assert.equal(ledger.summary.normalMapHeaders,226);
  assert.equal(ledger.summary.idsWithoutNormalHeader,22);
  assert.equal(ledger.summary.hiddenItemsWithoutNormalHeader,1);
  assert.equal(ledger.summary.staticallyIndexedActions,1992);
  assert.equal(ledger.summary.scriptReferences,1126);
  assert.equal(ledger.summary.textPointersPending,0);
  assert.equal(ledger.summary.asmTextReferences,626);
  assert.equal(ledger.summary.uniqueAsmEntrypoints,516);
  assert.equal(ledger.summary.unverifiedScriptEffects,1126);
  assert.equal(ledger.summary.verifiedRomEventBitBindings,344);
  assert.equal(ledger.summary.verifiedTrainerScriptEventBitBindings,332);
  assert.equal(ledger.summary.verifiedStaticEncounterScriptEventBitBindings,12);
  assert.equal(ledger.summary.verifiedSpecialTrainerScriptEventBitBindings,22);
  assert.equal(ledger.summary.liveEventBitValuesVerified,0);
  assert.equal(ledger.summary.trainerScriptEventBitsUnresolved,2);
  assert.deepEqual(ledger.summary.trainerScriptUnresolvedReferences.map(x=>
   [x.mapId,x.ordinal,x.eventBitIndex]),[[96,2,null],[135,11,null]]);
  assert.equal(ledger.maps.filter(x=>x.staticHeaderVerified).reduce(
   (n,x)=>n+x.verifiedRomEventBitBindings,0),344);
  assert.equal(ledger.summary.mappedRom0BranchReferences,537);
  assert.equal(ledger.summary.mappedRom0CallReferences,1016);
  assert.equal(ledger.summary.rom0CallEffectsProven,0);
  assert.equal(ledger.summary.rom0StillSemanticallyUnknown,537);
  assert.equal(ledger.summary.rom0EffectsProven,0);
  assert.ok(ledger.summary.distinctRom0PhysicalTargets>0);
  assert.ok(ledger.summary.boundedRom0OpcodeCandidates>0);
  assert.equal(ledger.summary.asmInitiallyCapped,7);
  assert.equal(ledger.summary.asmExpanded,7);
  assert.equal(ledger.mapping100PercentCertified,false);
  assert.equal(ledger.runtimeEffectsCertified,false);
  assert.ok(ledger.summary.runtimeActionsUnproven>=1992);
  assert.equal(ledger.maps.filter(x=>!x.staticHeaderVerified).length,22);
  assert.equal(ledger.maps.filter(x=>x.staticHeaderVerified).length,226);
  assert.ok(ledger.priorities.length>0);
  const refs=ledger.maps.reduce((sum,m)=>sum+(m.interactionCount||0),0);
  assert.equal(refs,1126);
  assert.equal(ledger.priorities.length,15);
  for(const map of ledger.maps.filter(x=>x.staticHeaderVerified)){
   assert.equal(map.asmHandlerCandidates.length,map.uniqueAsmEntrypoints);
   assert.equal(map.asmHandlerCandidates.reduce((n,x)=>n+x.references,0),map.asmReferences);
   assert.ok(map.asmHandlerCandidates.every(x=>x.scriptEffectsVerified===false&&
    Array.isArray(x.physicalRom0TargetCpus)&&
    x.physicalRom0AddressKnownOnly===true&&
    x.rom0BranchesExecuted===false&&
    Number.isInteger(x.fileOffset)&&Number.isInteger(x.pendingTargets)&&
    Number.isInteger(x.pendingCalls)));
  }
  const wrong=buildMappingGapLedger({profile,index,scriptAtlas,
   tracker:{...tracker,romSha256:'0'.repeat(64)}});
  assert.equal(wrong.verified,false);
 });
}
