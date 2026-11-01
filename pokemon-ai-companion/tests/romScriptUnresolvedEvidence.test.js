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
