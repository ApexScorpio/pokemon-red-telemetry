'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditWorldScriptReferences}=require('../romWorldScriptReferences');
const {readRom}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const cases=[
 ['red','POKEMON_RED_ROM',AUDITED_ROM_SHA256.RED],
 ['blue','POKEMON_BLUE_ROM',AUDITED_ROM_SHA256.BLUE],
 ['green','POKEMON_GREEN_ROM',AUDITED_ROM_SHA256.GREEN_INTERNATIONAL_1_2_1]
];
test('refuses a short ROM or unknown SHA without inventing script outcomes',()=>{
 const a=auditWorldScriptReferences({rom:Buffer.alloc(1024),profile:{}});
 assert.equal(a.verified,false);
 assert.equal(a.scriptEffectsSemanticallyComplete,false);
 const rom=Buffer.alloc(1048576);
 const b=auditWorldScriptReferences({rom,profile:{hash:{sha256:'0'.repeat(64)}}});
 assert.equal(b.verified,false);
 assert.deepEqual(b.references,[]);
});
for(const [name,env,sha] of cases){
 test('real '+name+' ROM: every one of 1126 NPC/sign/trainer/item/static-mon references is accounted for',
 {skip:!process.env[env]?'Original ROM file required':false},()=>{
  const buffer=readRom(process.env[env]);
  const profile=inspectRomBuffer(buffer,name+'.gb');
  assert.equal(profile.hash.sha256,sha);
  const atlas=auditWorldScriptReferences({rom:buffer,profile});
  assert.equal(atlas.verified,true,atlas.reason);
  assert.equal(atlas.romSha256,sha);
  assert.equal(atlas.maps.length,248);
  assert.equal(atlas.maps.filter(m=>m.verified).length,226);
  assert.equal(atlas.summary.mapScriptPointers,226);
  assert.equal(atlas.references.length,1126);
  assert.deepEqual(atlas.summary.byKind,{
   SIGN:202,NPC:472,TRAINER:334,ITEM:106,STATIC_POKEMON:12
  });
  assert.equal(atlas.summary.resolvedTextPointers+
   atlas.summary.unresolvedTextPointers,1126);
  assert.equal(Object.values(atlas.summary.commandCounts)
    .reduce((n,v)=>n+v,0),1126);
  assert.equal(atlas.summary.semanticallyCertifiedInteractionScripts,0);
  assert.equal(atlas.scriptEffectsSemanticallyComplete,false);
  assert.equal(atlas.runtimeFlagsVerified,false);
  assert.equal(atlas.maps[111].verified,false);
  assert.equal(atlas.maps[111].interactions.length,0);
  const joined=atlas.maps.reduce((n,m)=>n+m.interactions.length,0);
  assert.equal(joined,1126);
  const seen=new Set();
  for(const r of atlas.references){
   const key=r.mapId+':'+r.kind+':'+r.ordinal;
   assert.equal(seen.has(key),false,'duplicate map/kind/ordinal '+key);
   seen.add(key);
   assert.equal(r.conditionsFullyDecoded,false);
   assert.equal(r.scriptEffectsVerified,false);
   assert.equal(r.effectBranchesVerified,false);
   assert.equal(r.interactionExecuted,false);
   assert.equal(r.accessibleNow,null);
   assert.equal(r.alreadyCompleted,null);
   if(r.textPointerVerified){
    assert.ok(Number.isInteger(r.scriptFileOffset));
    assert.ok(r.scriptFileOffset>=0&&r.scriptFileOffset<1048576);
    assert.equal(r.unresolvedReason,null);
   }else{
    assert.ok(typeof r.unresolvedReason==='string'&&r.unresolvedReason.length>0);
   }
  }
  assert.equal(atlas.references.some(r=>r.kind==='NPC'),true);
  assert.equal(atlas.references.some(r=>r.kind==='SIGN'),true);
 });
}
test('unknown identity of same-size ROM is refused even with a genuine profile',()=>{
 const b=Buffer.alloc(1048576);
 const fake={hash:{sha256:AUDITED_ROM_SHA256.RED},world:{maps:{valid:true,
  validMapHeaders:226,data:Array.from({length:248},(_,mapId)=>({
   mapId,valid:mapId<226,objects:{objects:[],signs:[]}}))}}};
 assert.equal(auditWorldScriptReferences({rom:b,profile:fake}).verified,false);
});
