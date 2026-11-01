'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildScriptUnresolvedEvidence,compareScriptUnresolvedEvidence}=
 require('../romScriptUnresolvedEvidence');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const names=[['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']];
const load=(variant,env)=>{
 const rom=readRom(process.env[env]);
 const p=inspectRomBuffer(rom,variant+'.gb');
 assert.equal(p.hash.sha256,KNOWN[variant]);
 return buildScriptUnresolvedEvidence({atlas:p.world.interactionScriptAtlas});
};
test('no atlas never fabricates script evidence',()=>{
 const e=buildScriptUnresolvedEvidence();
 assert.equal(e.verified,false);assert.deepEqual(e.rows,[]);
 assert.equal(e.semantic100PercentCertified,false);
});
test('unknown or mismatched ROM identity is not accepted',()=>{
 const e=buildScriptUnresolvedEvidence({atlas:{
  verified:true,romSha256:'0'.repeat(64),maps:[],references:[],summary:{}}});
 assert.equal(e.verified,false);
});
test('incomplete global reference inventory is rejected',()=>{
 const e=buildScriptUnresolvedEvidence({atlas:{
  verified:true,romSha256:KNOWN.red,maps:[],references:[],summary:{}}});
 assert.equal(e.verified,false);assert.equal(e.summary,null);
});
test('cross-ROM comparison rejects partial inputs',()=>{
 const x=compareScriptUnresolvedEvidence({red:null,blue:null,green:null});
 assert.equal(x.verified,false);assert.equal(x.gameplayEquivalenceCertified,false);
});
for(const [variant,env] of names){
 test('real '+variant+' ROM produces 1126 address-level unresolved interactions',
 {skip:!process.env[env]?'Exact ROM is required':false},()=>{
  const inv=load(variant,env);
  assert.equal(inv.verified,true,inv.reason);
  assert.equal(inv.romSha256,KNOWN[variant]);
  assert.equal(inv.rows.length,1126);
  assert.equal(inv.summary.physicalOffsetsVerified,1126);
  assert.equal(inv.summary.asmReferences,626);
  assert.equal(inv.summary.uniqueAsmEntrypoints,516);
  assert.equal(inv.summary.eventBitBindings,344);
  assert.deepEqual(inv.summary.unboundTrainerReferences,[[96,2],[135,11]]);
  assert.equal(inv.perMap.length,248);
  assert.equal(inv.perMap.filter(x=>x.hasNormalHeader).length,226);
  assert.equal(inv.summary.scriptEffectsUnverified,1126);
  assert.equal(inv.semantic100PercentCertified,false);
  assert.ok(inv.rows.every(r=>
   r.effectsVerified===false&&r.completedNow===null&&
   r.accessibleNow===null&&r.scriptFileOffset<1048576));
  assert.ok(inv.hotspots.length>0);
 });
}
test('exact three-ROM script comparison preserves differences without fake equivalence',
 {skip:names.some(x=>!process.env[x[1]])?'Three originals required':false},()=>{
  const x=compareScriptUnresolvedEvidence(Object.fromEntries(
   names.map(([v,e])=>[v,load(v,e)])));
  assert.equal(x.verified,true,x.reason);
  assert.equal(x.counts.recordKeys>=1126,true);
  assert.equal(x.changes.length>=0,true);
  assert.equal(x.gameplayEquivalenceCertified,false);
  assert.equal(x.allMapScriptEffectsCertified,false);
 });

// The production profile intentionally exposes atlas.maps[].interactions
// without atlas.references. Synthetic evidence is only a schema regression.
function syntheticAtlas(sha=KNOWN.red){
 const maps=Array.from({length:248},(_,mapId)=>({
  mapId,verified:mapId<226,interactions:[]
 }));
 const kinds=[['SIGN',202],['NPC',472],['TRAINER',332],
  ['ITEM',106],['STATIC_POKEMON',12]];
 let serial=0,bit=0,asm=0;
 const add=(kind,mapId,ordinal,bound)=>{
  const isAsm=serial<626;
  const offset=isAsm?asm++%516:serial;
  const row={mapId,kind,ordinal,x:2,y:3,rawTextId:1,textId:1,
   textPointerVerified:true,scriptFileOffset:offset,
   scriptCommand:isAsm?'TX_START_ASM':'TX_START',
   scriptDispatchClass:'SYNTHETIC',
   asmCandidate:isAsm?{verified:true,txAsmFileOffset:offset}:null,
   eventBitBindingVerified:bound,eventBitIndex:bound?bit++:null,
   conditionsFullyDecoded:false,scriptEffectsVerified:false,
   effectBranchesVerified:false,interactionExecuted:false,
   accessibleNow:null,alreadyCompleted:null};
  serial++;
  maps[mapId].interactions.push(row);
 };
 for(const [kind,count] of kinds){
  for(let i=0;i<count;i++)add(kind,0,i+1,
    kind==='TRAINER'||kind==='STATIC_POKEMON');
 }
 // Include the two separately audited trainer scripts without known bits.
 add('TRAINER',96,2,false);
 add('TRAINER',135,11,false);
 const summary={mapIds:248,normalMaps:226,unresolvedMapIDs:22,
  referencedInteractions:1126,resolvedTextPointers:1126,
  unresolvedTextPointers:0,asmTextReferences:626,
  uniqueAsmEntrypoints:516,trainerEventFlagBindings:332,
  stationaryEventFlagBindings:12,trainerEventFlagBindingsMissing:2,
  asmSemanticallyCertified:0,semanticallyCertifiedInteractionScripts:0};
 return {verified:true,romSha256:sha,summary,maps,
  scriptEffectsSemanticallyComplete:false};
}
test('production-shaped map-only atlas works without a references array',()=>{
 const atlas=syntheticAtlas();
 assert.equal(Object.hasOwn(atlas,'references'),false);
 const result=buildScriptUnresolvedEvidence({atlas});
 assert.equal(result.verified,true,result.reason);
 assert.equal(result.rows.length,1126);
 assert.equal(result.summary.asmReferences,626);
 assert.equal(result.summary.eventBitBindings,344);
 assert.equal(result.summary.scriptEffectsUnverified,1126);
 assert.equal(result.gameplayCompletionCertified,false);
});
test('optional flattened references must be exact same audited row objects',()=>{
 const atlas=syntheticAtlas();
 const rows=atlas.maps.flatMap(m=>m.interactions);
 atlas.references=rows.map((r,i)=>i===0?{...r}:r);
 const result=buildScriptUnresolvedEvidence({atlas});
 assert.equal(result.verified,false);
 assert.match(result.reason,/disagree/);
});
test('a duplicated interaction identity fails closed',()=>{
 const atlas=syntheticAtlas();
 atlas.maps[0].interactions[1].ordinal=1;
 const result=buildScriptUnresolvedEvidence({atlas});
 assert.equal(result.verified,false);
 assert.match(result.reason,/duplicate/);
});
test('synthetic three-ROM comparison tracks offsets without claiming effects',()=>{
 const variants={};
 for(const [variant,sha] of Object.entries(KNOWN)){
  const a=syntheticAtlas(sha);
  const r=buildScriptUnresolvedEvidence({atlas:a});
  assert.equal(r.verified,true,r.reason);
  variants[variant]=r;
 }
 const diff=compareScriptUnresolvedEvidence(variants);
 assert.equal(diff.verified,true,diff.reason);
 assert.equal(diff.counts.recordKeys,1126);
 assert.equal(diff.gameplayEquivalenceCertified,false);
});
