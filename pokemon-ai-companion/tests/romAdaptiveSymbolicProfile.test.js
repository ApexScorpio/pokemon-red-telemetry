'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {interpretHandler}=require('../romScriptSemantics');
const {mapScriptRootEvidence}=
 require('../romMapScriptRootSemantics');

const expectedAdaptiveMaps=[31,34,36,210,212,233];

test('adaptive feature preserves existing guarded UI',()=>{
 const app=fs.readFileSync(
  path.join(__dirname,'..','public','app.js'),
  'utf8'
 );

 assert.ok(app.includes('mapRootSymbolicT214'));
 assert.ok(app.includes('mapRootT190.romSha256===runtimeSha'));
 assert.ok(app.includes('mapRootT190.mapId===advice.mapId'));
 assert.ok(app.includes('r.memoryWriteObserved===false'));
 assert.ok(app.includes('r.gameEventCompleted===false'));
});

for(const [variant,envName] of [
 ['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('real ROM adaptive profile: '+variant,{
  skip:!process.env[envName]?
   'Original authenticated ROM unavailable':false
 },()=>{
  const rom=readRom(process.env[envName]);

  const sha=crypto.createHash('sha256')
   .update(rom).digest('hex');

  assert.equal(sha,KNOWN[variant]);

  const profile=inspectRomBuffer(
   rom,variant+'.gb'
  );

  assert.equal(profile.hash.sha256,sha);

  const catalogue=
   profile.world.mapScriptRootSemantics;

  assert.equal(catalogue.verified,true);
  assert.equal(catalogue.romSha256,sha);
  assert.equal(catalogue.rows.length,226);
  assert.equal(catalogue.roots.length,223);

  // The initial 2048-step audit remains authoritative.
  assert.equal(
   catalogue.summary.uniqueConditionalEffectCandidates,
   59
  );
  assert.equal(
   catalogue.summary.completeBoundedRoots,
   105
  );
  assert.equal(
   catalogue.summary.unresolvedPhysicalPaths,
   1145
  );
  assert.equal(
   catalogue.summary.globallyCertifiedGameplayEffects,
   0
  );

  assert.equal(catalogue.rootInvocationObserved,false);
  assert.equal(catalogue.selectedBankObserved,false);
  assert.equal(catalogue.gameplayCompleted,false);

  const eligible=catalogue.roots
   .filter(root=>root.symbolicWriteEnrichment)
   .flatMap(root=>catalogue.rows
    .filter(row=>row.rootIndex===root.rootIndex)
    .map(row=>row.mapId))
   .sort((a,b)=>a-b);

  assert.deepEqual(eligible,expectedAdaptiveMaps);

  for(const [mapId,writes,budget,distinct] of [
   [210,42,64,683],
   [212,39,61,697]
  ]){
   const evidence=mapScriptRootEvidence({
    catalogue,
    romSha256:sha,
    mapId
   });

   assert.equal(evidence?.verified,true);
   assert.equal(evidence.gameplayCompleted,false);
   assert.equal(evidence.rootInvokedInCurrentPlay,false);
   assert.equal(evidence.actualBankSelectionVerified,false);

   // No second-pass rewrite of the original analysis.
   assert.equal(
    evidence.unresolvedReasonCounts.STEP_BUDGET,
    budget
   );

   assert.equal(
    evidence.unresolvedReasonCounts.INDIRECT_MEMORY_UNKNOWN,
    4
   );

   const root=catalogue.roots[
    catalogue.rows.find(x=>x.mapId===mapId).rootIndex
   ];

   const original=interpretHandler({
    rom,
    fileOffset:root.fileOffset,
    entryKind:'MAP_SCRIPT_ROOT'
   });

   assert.equal(
    evidence.unresolvedCount,
    original.unresolved.length
   );

   assert.equal(
    evidence.conditionalEffectCandidates,
    original.effects.filter(e=>
     e.gameplayStateTransitionProven===true
    ).length
   );

   const info=evidence.symbolicWriteEnrichment;

   assert.equal(info.source,'BOUNDED_ROM_SECOND_PASS');
   assert.equal(info.firstPassMaxSteps,2048);
   assert.equal(info.secondPassMaxSteps,8192);
   assert.equal(info.secondPassMaxPaths,128);
   assert.equal(info.additionalConditionalPaths,writes);
   assert.equal(info.firstPassEffectsPreserved,true);
   assert.equal(info.firstPassUnresolvedPreserved,true);
   assert.equal(info.runtimeRamReadObserved,false);
   assert.equal(info.memoryWriteObserved,false);
   assert.equal(info.gameplayExecutionObserved,false);
   assert.equal(info.gameEventCompleted,false);

   const groups=evidence.runtimeSymbolicWriteRequirements;

   assert.equal(groups.length,3);

   assert.equal(
    groups.reduce(
     (n,r)=>n+r.conditionalPathRequirements,0
    ),
    writes
   );

   const candidates=new Set();

   for(const requirement of groups){
    assert.equal(requirement.sourceAddress,0xd369);
    assert.equal(requirement.instructionOffset,0xeebf);
    assert.equal(requirement.memoryRegion,'WRAM');
    assert.equal(requirement.candidateCount,256);
    assert.equal(requirement.runtimeRamReadObserved,false);
    assert.equal(requirement.targetAddressObserved,false);
    assert.equal(requirement.memoryWriteObserved,false);
    assert.equal(requirement.gameplayExecutionObserved,false);
    assert.equal(requirement.gameEventCompleted,false);

    for(let byte=0;byte<256;byte++){
     const e=(byte+6)&255;

     const address=(
      requirement.baseCpuAddress+
      requirement.symbolicMultiplier*e+
      requirement.fixedAddend+
      requirement.finalBC
     )&65535;

     assert.ok(address>=0xc000&&address<0xe000);
     candidates.add(address);
    }
   }

   assert.equal(candidates.size,distinct);

   // Projection must not share mutable objects with profile.
   const previous=root.symbolicWriteEnrichment.secondPassMaxSteps;

   evidence.symbolicWriteEnrichment.secondPassMaxSteps=1;

   assert.equal(
    root.symbolicWriteEnrichment.secondPassMaxSteps,
    previous
   );
  }
 });
}