'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const {interpretHandler}=require('../romScriptSemantics');

const {
  buildMapScriptRootSemantics,
  mapScriptRootEvidence
}=require('../romMapScriptRootSemantics');

const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');

const OFFSET=0x18020;

test('map root begins at the physical opcode',()=>{
  const rom=Buffer.alloc(1048576);

  rom.set([
    0x21,0x47,0xd7,
    0xcb,0xc6,0xc9
  ],OFFSET);

  const result=interpretHandler({
    rom,
    fileOffset:OFFSET,
    entryKind:'MAP_SCRIPT_ROOT'
  });

  assert.equal(result.verified,true);
  assert.equal(result.handlerOffset,OFFSET);
  assert.equal(result.effects.length,1);
  assert.equal(result.effects[0].instructionOffset,OFFSET+3);
  assert.equal(result.effects[0].address,0xd747);
  assert.equal(result.observedExecution,false);

  assert.ok(result.preconditions.includes(
    'MAP_SCRIPT_ROOT_INVOKED'
  ));

  assert.ok(result.preconditions.includes(
    'HEADER_BANK_CONTEXT_ASSUMED_NOT_OBSERVED'
  ));

  assert.equal(interpretHandler({
    rom,fileOffset:OFFSET
  }).verified,false);
});

test('old TX_ASM behavior is preserved',()=>{
  const rom=Buffer.alloc(1048576);

  rom.set([
    0x08,0x21,0x47,0xd7,
    0xcb,0xc6,0xc9
  ],OFFSET);

  const result=interpretHandler({
    rom,fileOffset:OFFSET
  });

  assert.equal(result.verified,true);
  assert.equal(result.effects.length,1);
  assert.equal(result.effects[0].address,0xd747);
  assert.ok(result.preconditions.includes('HANDLER_INVOKED'));
});

test('unsupported entry kind and offset fail closed',()=>{
  const rom=Buffer.alloc(1048576);

  assert.equal(interpretHandler({
    rom,fileOffset:OFFSET,entryKind:'UNKNOWN'
  }).verified,false);

  assert.equal(interpretHandler({
    rom,fileOffset:rom.length,entryKind:'MAP_SCRIPT_ROOT'
  }).verified,false);
});

test('wrong SHA or incomplete catalogue is rejected',()=>{
  const rom=Buffer.alloc(1048576);

  const result=buildMapScriptRootSemantics({
    rom,maps:[],romSha256:KNOWN.red
  });

  assert.equal(result.verified,false);
  assert.equal(result.gameplayCompleted,false);

  const foreign={
    verified:true,
    source:'SHA_VERIFIED_MAP_SCRIPT_ROOT_ABSTRACT_EXECUTION_V1',
    romSha256:KNOWN.red,
    rows:[{mapId:5,rootIndex:0}],
    roots:[],
    rootInvocationObserved:false,
    gameplayCompleted:false,
    fullMapScriptSemanticsCertified:false
  };

  assert.equal(mapScriptRootEvidence({
    catalogue:foreign,romSha256:KNOWN.blue,mapId:5
  }),null);

  assert.equal(mapScriptRootEvidence({
    catalogue:foreign,romSha256:KNOWN.red,mapId:5
  }),null);
});

test('checklist, advisor and UI expose guarded evidence',()=>{
  const root=path.join(__dirname,'..');

  const checklist=fs.readFileSync(
    path.join(root,'romWorldChecklist.js'),'utf8'
  );

  const advisor=fs.readFileSync(
    path.join(root,'romWorldStateAdvisor.js'),'utf8'
  );

  const app=fs.readFileSync(
    path.join(root,'public/app.js'),'utf8'
  );

  assert.ok(checklist.includes('mapScriptRootEvidence:'));
  assert.ok(advisor.includes('mapScriptRootSemantics:'));
  assert.ok(advisor.includes('MAP_SCRIPT_ROOT_CONDITIONAL'));
  assert.ok(app.includes('const mapRootT190='));
  assert.ok(app.includes('rootInvokedInCurrentPlay===false'));
  assert.ok(app.includes('gameplayCompleted===false'));
});

for(const [variant,variable] of [
  ['red','POKEMON_RED_ROM'],
  ['blue','POKEMON_BLUE_ROM'],
  ['green','POKEMON_GREEN_ROM']
]){
  test('real ROM map roots: '+variant,{
    skip:!process.env[variable]?
      'Original ROM not provided':false
  },()=>{
    const rom=readRom(process.env[variable]);
    const profile=inspectRomBuffer(rom,variant+'.gb');

    assert.equal(profile.hash.sha256,KNOWN[variant]);

    const catalogue=profile.world.mapScriptRootSemantics;

    assert.equal(catalogue.verified,true,catalogue.reason);
    assert.equal(catalogue.romSha256,KNOWN[variant]);

    const summary=catalogue.summary;

    assert.equal(summary.mapScriptPointers,226);
    assert.equal(summary.uniquePhysicalMapScriptRoots,223);
    assert.equal(summary.uniqueConditionalEffectCandidates,59);
    assert.equal(summary.completeBoundedRoots,105);
    assert.equal(summary.unresolvedPhysicalPaths,1145);

    const restored=JSON.parse(JSON.stringify(catalogue));

    assert.equal(restored.rows.length,226);
    assert.equal(restored.roots.length,223);

    let mapsWithEffects=0;

    for(const row of restored.rows){
      const evidence=mapScriptRootEvidence({
        catalogue:restored,
        romSha256:KNOWN[variant],
        mapId:row.mapId
      });

      assert.equal(evidence?.verified,true);
      assert.equal(evidence.gameplayCompleted,false);
      assert.equal(evidence.rootInvokedInCurrentPlay,false);
      assert.equal(evidence.actualBankSelectionVerified,false);
      assert.equal(evidence.fullMapScriptCertified,false);

      if(evidence.conditionalEffectCandidates>0){
        mapsWithEffects++;

        for(const effect of evidence.effects){
          assert.equal(effect.observedExecution,false);
          assert.equal(effect.completedNow,null);
          assert.equal(effect.accessibleNow,null);
          assert.ok(Number.isInteger(effect.instructionOffset));
          assert.ok(Number.isInteger(effect.address));
        }
      }
    }

    assert.ok(mapsWithEffects>0);

    assert.equal(
      profile.world.interactionScriptAtlas
        .scriptSemantics.formallyProvenScriptEffects,
      2
    );
  });
}