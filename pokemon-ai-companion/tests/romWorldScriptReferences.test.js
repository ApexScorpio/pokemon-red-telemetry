'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditWorldScriptReferences}=require('../romWorldScriptReferences');
const {readRom}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
const {buildCampaignWorldTracker}=require('../romCampaignWorldTracker');
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
  assert.equal(profile.world.interactionScriptAtlas?.verified,true);
  assert.equal(profile.world.interactionScriptAtlas.summary.referencedInteractions,1126);
  assert.equal(profile.world.interactionScriptAtlas.maps.length,248);
  const mapIndex=buildWorldContentsIndex(profile);
  const tracker=buildCampaignWorldTracker({index:mapIndex,
   scriptAtlas:profile.world.interactionScriptAtlas});
  assert.equal(tracker.verified,true);
  assert.equal(tracker.scriptAtlasBound,true);
  assert.equal(tracker.summary.scriptReferencesBound,1126);
  // WARP has no Text ID. It belongs to ROM warp routing, not the
  // 1126 interactions (signs, actors and pickups). Hidden items are
  // bound separately to their own 54 script/bitmap references.
  const allActions=tracker.maps.filter(m=>m.verified).flatMap(m=>m.actions);
  const scripted=allActions.filter(r=>r.kind!=='WARP'&&r.kind!=='HIDDEN_ITEM');
  const warps=allActions.filter(r=>r.kind==='WARP');
  const hidden=allActions.filter(r=>r.kind==='HIDDEN_ITEM');
  assert.equal(scripted.length,1126);
  assert.equal(warps.length,813);
  assert.equal(hidden.length,53);
  assert.ok(scripted.every(row=>row.scriptReferenceBound===true));
  assert.ok(warps.every(row=>row.scriptReferenceBound===false));
  assert.ok(hidden.every(row=>row.scriptReferenceBound===false));
  const expectedPerKind={SIGN:202,NPC:472,TRAINER:334,
   ITEM:106,STATIC_POKEMON:12};
  for(const [kind,n] of Object.entries(expectedPerKind))
   assert.equal(scripted.filter(row=>row.kind===kind&&
    row.scriptReferenceBound===true).length,n);
  for(const m of tracker.maps){
   if(!m.verified)continue;
   const expectedBindings=atlas.maps[m.mapId].interactions;
   const actual=m.actions.filter(r=>r.scriptReferenceBound);
   assert.equal(actual.length,expectedBindings.length,
    'mismatch in map #'+m.mapId);
   for(const r of actual){
    const matches=expectedBindings.filter(x=>
     x.kind===r.kind&&x.ordinal===r.ordinal&&
     x.x===r.x&&x.y===r.y&&
     x.rawTextId===r.staticObject.textId);
    assert.equal(matches.length,1,
     'interaction object mismatch in map '+m.mapId);
   }
  }
  assert.ok(tracker.maps.every(m=>!m.verified||
   m.actions.every(row=>row.scriptEffectSemanticsVerified===false)));

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
