'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const {
 groupMapRootBudgetConditionRamSources,
 mapScriptRootEvidence
}=require('../romMapScriptRootSemantics');

const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {interpretHandler}=require('../romScriptSemantics');

test('budget sources count each address once per stopped path',()=>{
 const read=a=>({read:a});

 const stopped=[
  {
   reason:'PATH_BUDGET',
   conditions:[
    {predicate:{equals:[read(0xc22e),16]}},
    {predicate:{zero:read(0xc22e)}},
    {predicate:{bitClear:{value:read(0xcf17),bit:4}}}
   ]
  },
  {
   reason:'PATH_BUDGET',
   conditions:[
    {predicate:{not:{equals:[0,read(0xc22e)]}}}
   ]
  },
  {
   reason:'INDIRECT_MEMORY_UNKNOWN',
   conditions:[{predicate:{zero:read(0xd369)}}]
  }
 ];

 const result=groupMapRootBudgetConditionRamSources(stopped);

 assert.equal(result.pathBudgetStops,2);
 assert.equal(result.pathsWithCandidateSources,2);
 assert.equal(result.distinctCandidateRamSources,2);
 assert.deepEqual(
  result.candidateSources.map(x=>[
   x.address,x.conditionalStoppedPaths
  ]),
  [[0xc22e,2],[0xcf17,1]]
 );
 assert.equal(result.runtimeRamReadObserved,false);
 assert.equal(result.gameEventCompleted,false);
 assert.equal(result.pathsResolved,false);
});

test('volatile, ROM and unsupported evidence never become RAM requirements',()=>{
 const result=groupMapRootBudgetConditionRamSources([
  {
   reason:'PATH_BUDGET',
   conditions:[{
    predicate:{
     equals:[
      {read:0xcf17,volatile:true},
      {read:0x4000}
     ]
    }
   }]
  }
 ]);

 assert.equal(result.pathBudgetStops,1);
 assert.equal(result.pathsWithCandidateSources,0);
 assert.equal(result.candidateSources.length,0);

 assert.equal(
  groupMapRootBudgetConditionRamSources([]),
  null
 );
 assert.equal(
  groupMapRootBudgetConditionRamSources(null),
  null
 );
});

test('checklist displays only unobserved symbolic dependencies',()=>{
 const app=fs.readFileSync(
  path.join(__dirname,'..','public','app.js'),
  'utf8'
 );

 assert.ok(app.includes('mapRootBudgetRamT220'));
 assert.ok(app.includes(
  'mapRootT190.romSha256===runtimeSha'
 ));
 assert.ok(app.includes(
  'mapRootT190.mapId===advice.mapId'
 ));
 assert.ok(app.includes(
  'mapRootBudgetRamT220.runtimeRamReadObserved===false'
 ));
 assert.ok(app.includes(
  'mapRootBudgetRamT220.pathsResolved===false'
 ));
});

for(const [variant,envName] of [
 ['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('real ROM branch dependencies: '+variant,{
  skip:!process.env[envName]?
   'Original authenticated ROM unavailable':false
 },()=>{
  const rom=readRom(process.env[envName]);

  const sha=crypto.createHash('sha256')
   .update(rom).digest('hex');

  assert.equal(sha,KNOWN[variant]);

  const profile=inspectRomBuffer(rom,variant+'.gb');

  assert.equal(profile.hash.sha256,sha);

  const catalogue=
   profile.world.mapScriptRootSemantics;

  assert.equal(catalogue.verified,true);
  assert.equal(catalogue.roots.length,223);
  assert.equal(catalogue.rows.length,226);

  assert.equal(
   catalogue.summary.completeBoundedRoots,105
  );
  assert.equal(
   catalogue.summary.unresolvedPhysicalPaths,1145
  );
  assert.equal(
   catalogue.summary.uniqueConditionalEffectCandidates,59
  );

  const expected=[
   [31,330921,87],
   [34,332250,90],
   [36,333259,84]
  ];

  for(const [mapId,offset,stepBudget] of expected){
   const evidence=mapScriptRootEvidence({
    catalogue,romSha256:sha,mapId
   });

   assert.equal(evidence?.verified,true);
   assert.equal(evidence.physicalRootOffset,offset);
   assert.equal(
    evidence.unresolvedReasonCounts.STEP_BUDGET,
    stepBudget
   );

   const info=evidence.runtimeBudgetConditionRamSources;

   assert.ok(info);
   assert.equal(
    info.reason,
    'PATH_BUDGET_CONDITION_RAM_DEPENDENCIES'
   );
   assert.ok(info.pathBudgetStops>0);
   assert.ok(info.pathsWithCandidateSources>0);
   assert.ok(info.distinctCandidateRamSources>0);
   assert.ok(info.candidateSources.length>0);
   assert.ok(info.candidateSources.length<=12);
   assert.equal(info.runtimeRamReadObserved,false);
   assert.equal(info.gameplayExecutionObserved,false);
   assert.equal(info.gameEventCompleted,false);
   assert.equal(info.pathsResolved,false);

   for(const source of info.candidateSources){
    assert.ok(
     (source.address>=0xc000&&source.address<0xe000)||
     (source.address>=0xff80&&source.address<0xffff)
    );
    assert.ok(source.conditionalStoppedPaths>=1);
    assert.ok(
     source.conditionalStoppedPaths<=info.pathBudgetStops
    );
    assert.equal(source.runtimeRamReadObserved,false);
    assert.equal(source.liveValueKnown,false);
   }

   const root=catalogue.roots[
    catalogue.rows.find(row=>row.mapId===mapId).rootIndex
   ];

   const baseline=interpretHandler({
    rom,fileOffset:root.fileOffset,
    entryKind:'MAP_SCRIPT_ROOT'
   });

   assert.equal(
    evidence.unresolvedCount,
    baseline.unresolved.length
   );
   assert.equal(evidence.rootInvokedInCurrentPlay,false);
   assert.equal(evidence.gameplayCompleted,false);

   const previous=
    root.runtimeBudgetConditionRamSources
     .candidateSources[0].address;

   info.candidateSources[0].address=0;

   assert.equal(
    root.runtimeBudgetConditionRamSources
     .candidateSources[0].address,
    previous
   );
  }

  // Existing T214/T216 proof must remain usable.
  for(const [mapId,expectedPaths] of [
   [210,42],[212,39]
  ]){
   const evidence=mapScriptRootEvidence({
    catalogue,romSha256:sha,mapId
   });

   assert.equal(
    evidence.runtimeSymbolicWriteRequirements.reduce(
     (sum,r)=>sum+r.conditionalPathRequirements,0
    ),
    expectedPaths
   );

   assert.equal(evidence.gameplayCompleted,false);
  }
 });
}