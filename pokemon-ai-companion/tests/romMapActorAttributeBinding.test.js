'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {bindMapActorAttributes,auditWorldActorAttributeBindings}=
 require('../romMapActorAttributeBinding');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
const SHA=KNOWN.red;
function sample(){
 const index={verified:true,romSha256:SHA,
  source:'SHA_AUDITED_ROM_PROFILE_ALL_MAP_HEADERS_AND_OBJECT_RECORDS',
  maps:Array.from({length:248},(_,mapId)=>({
   mapId,verified:false,contents:null
  }))};
 const scriptAtlas={verified:true,romSha256:SHA,
  source:'SHA_AUDITED_ROM_ALL_MAP_OBJECT_TEXT_REFERENCES',
  maps:Array.from({length:248},(_,mapId)=>({
   mapId,verified:false,interactions:[]
  }))};
 index.maps[226]={mapId:226,verified:true,
  contents:{visibleItems:[{source:'ROM_MAP_OBJECT_BYTES',
   kind:'item',ordinal:1,x:29,y:9,textId:4,itemOrTrainerId:79}],
   stationaryPokemon:[{source:'ROM_MAP_OBJECT_BYTES',
    kind:'wildPokemon',ordinal:2,x:27,y:13,textId:8,
    wildSpeciesInternalId:131,wildLevel:70}]}};
 scriptAtlas.maps[226]={mapId:226,verified:true,
  interactions:[
   {source:'SHA_AUDITED_ROM_MAP_OBJECT_AND_TEXT_POINTER',
    mapId:226,kind:'ITEM',ordinal:1,x:29,y:9,rawTextId:4,
    actorRomMetadata:{itemId:79},textPointerVerified:true,
    conditionsFullyDecoded:false,scriptEffectsVerified:false,
    accessibleNow:null,alreadyCompleted:null,scriptFileOffset:9460},
   {source:'SHA_AUDITED_ROM_MAP_OBJECT_AND_TEXT_POINTER',
    mapId:226,kind:'STATIC_POKEMON',ordinal:2,x:27,y:13,rawTextId:8,
    actorRomMetadata:{speciesInternalId:131,level:70},
    textPointerVerified:true,conditionsFullyDecoded:false,
    scriptEffectsVerified:false,accessibleNow:null,alreadyCompleted:null,
    scriptFileOffset:286492}
  ]};
 return {index,scriptAtlas};
}
test('missing proof fails closed without any actor coordinates',()=>{
 const r=bindMapActorAttributes();
 assert.equal(r.verified,false);assert.deepEqual(r.bindings,[]);
 assert.equal(r.gameplayCollectionCertified,false);
});
test('same-ROM map index and scripts certify item and stationary species coordinates',()=>{
 const r=bindMapActorAttributes({...sample(),mapId:226});
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.bindings.length,2);
 assert.deepEqual(r.bindings.map(x=>[x.kind,x.x,x.y]),[
  ['ITEM',29,9],['STATIC_POKEMON',27,13]]);
 assert.equal(r.bindings[0].itemId,79);
 assert.equal(r.bindings[1].speciesInternalId,131);
 assert.equal(r.bindings[1].level,70);
 assert.equal(r.bindings.every(x=>x.romCoordinateAndAttributeVerified),true);
 assert.equal(r.bindings.every(x=>x.accessibleNow===null),true);
});
test('mismatched source ROM SHA cannot cross-bind objects',()=>{
 const input=sample();
 input.scriptAtlas.romSha256=KNOWN.green;
 const r=bindMapActorAttributes({...input,mapId:226});
 assert.equal(r.verified,false);
 assert.equal(r.bindings.length,0);
});
test('relocated script coordinates must match local object bytes',()=>{
 const input=sample();
 input.scriptAtlas.maps[226].interactions[0].x=5;
 assert.equal(bindMapActorAttributes({...input,mapId:226}).verified,false);
});
test('same map coordinate but different item ID fails closed',()=>{
 const input=sample();
 input.scriptAtlas.maps[226].interactions[0].actorRomMetadata.itemId=2;
 const r=bindMapActorAttributes({...input,mapId:226});
 assert.equal(r.verified,false);assert.match(r.reason,/Item ID differs/);
});
test('same map coordinate but different species or level fails closed',()=>{
 for(const mismatch of [{speciesInternalId:25,level:70},
  {speciesInternalId:131,level:50}]){
  const input=sample();
  input.scriptAtlas.maps[226].interactions[1].actorRomMetadata=mismatch;
  assert.equal(bindMapActorAttributes({...input,mapId:226}).verified,false);
 }
});
test('map without normal header has no fabricated object coordinates',()=>{
 const r=bindMapActorAttributes({...sample(),mapId:111});
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.hasNormalHeader,false);
 assert.deepEqual(r.bindings,[]);
});
test('full world rejects incomplete index even if one map matches',()=>{
 const input=sample();
 const r=auditWorldActorAttributeBindings(input);
 assert.equal(r.verified,false);
 assert.equal(r.gameplayCollectionCertified,false);
});
for(const [variant,env] of [['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']]){
 test('real '+variant+' ROM certifies 106 item and 12 static actor records',
 {skip:!process.env[env]?'Exact audited ROM required':false},()=>{
  const rom=readRom(process.env[env]);
  const profile=inspectRomBuffer(rom,variant+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[variant]);
  const index=buildWorldContentsIndex(profile);
  const audit=auditWorldActorAttributeBindings({
   index,scriptAtlas:profile.world.interactionScriptAtlas});
  assert.equal(audit.verified,true,audit.reason);
  assert.equal(audit.summary.mapIds,248);
  assert.equal(audit.summary.normalHeaders,226);
  assert.equal(audit.summary.visibleItems,106);
  assert.equal(audit.summary.stationaryPokemon,12);
  assert.equal(audit.summary.actorBindings,118);
  assert.equal(audit.byMap[226].verified,true);
  assert.equal(audit.byMap[227].verified,true);
  assert.equal(audit.runtimeAccessCertified,false);
 });
}
test('real three-ROM map 226/227 preserve six same-ID ordinal coordinate variants',
 {skip:['POKEMON_RED_ROM','POKEMON_BLUE_ROM','POKEMON_GREEN_ROM']
  .some(e=>!process.env[e])?'Three exact ROMs required':false},()=>{
 const evidence={};
 for(const [variant,env] of [['red','POKEMON_RED_ROM'],
  ['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']]){
  const profile=inspectRomBuffer(readRom(process.env[env]),variant+'.gb');
  const index=buildWorldContentsIndex(profile);
  const audit=auditWorldActorAttributeBindings({
   index,scriptAtlas:profile.world.interactionScriptAtlas});
  assert.equal(audit.verified,true,audit.reason);
  evidence[variant]=audit;
 }
 const lookup=(v,m,kind,ord)=>evidence[v].byMap[m].bindings.find(x=>
  x.kind===kind&&x.ordinal===ord);
 const expected=[
  [226,'ITEM',1,[29,9],[5,15],79],
  [226,'ITEM',2,[4,15],[25,13],2],
  [226,'ITEM',3,[13,6],[29,9],16],
  [227,'ITEM',2,[16,9],[24,7],2],
  [227,'ITEM',3,[18,1],[24,1],54],
  [227,'STATIC_POKEMON',1,[27,13],[5,10],131]
 ];
 for(const [m,kind,ord,redXY,greenXY,id] of expected){
  const [r,b,g]=['red','blue','green'].map(v=>lookup(v,m,kind,ord));
  assert.ok(r&&b&&g,'Missing world object '+m+':'+kind+':'+ord);
  assert.deepEqual([r.x,r.y],redXY);
  assert.deepEqual([b.x,b.y],redXY);
  assert.deepEqual([g.x,g.y],greenXY);
  assert.equal(kind==='ITEM'?r.itemId:r.speciesInternalId,id);
  assert.equal(kind==='ITEM'?g.itemId:g.speciesInternalId,id);
  assert.equal(r.collectedNow,null);assert.equal(g.accessibleNow,null);
 }
});

test('map checklist exposes only actor attributes verified in the selected ROM',()=>{
 const {buildMapChecklist}=require('../romWorldChecklist');
 const input=sample();
 const r=buildMapChecklist({...input,mapId:226});
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.actorAttributeAtlasBound,true);
 assert.equal(r.summary.boundStaticActorAttributes,2);
 const item=r.actions.find(x=>x.kind==='ITEM');
 const mon=r.actions.find(x=>x.kind==='STATIC_POKEMON');
 assert.equal(item.romActorCoordinateAndAttributeVerified,true);
 assert.equal(item.romActorItemId,79);
 assert.deepEqual([item.x,item.y],[29,9]);
 assert.equal(mon.romActorSpeciesInternalId,131);
 assert.equal(mon.romActorLevel,70);
 assert.equal(mon.romActorCoordinateAndAttributeVerified,true);
 assert.equal(mon.accessibleNow,null);
 assert.equal(item.completedNow,null);
});
test('map checklist cannot attribute an item from contradictory script coordinates',()=>{
 const {buildMapChecklist}=require('../romWorldChecklist');
 const input=sample();
 input.scriptAtlas.maps[226].interactions[0].x=5;
 const r=buildMapChecklist({...input,mapId:226});
 assert.equal(r.verified,true);
 assert.equal(r.actorAttributeAtlasBound,false);
 assert.equal(r.summary.boundStaticActorAttributes,0);
 assert.equal(r.actions.find(x=>x.kind==='ITEM').romActorItemId,null);
 assert.equal(r.actions.find(x=>x.kind==='ITEM')
  .romActorCoordinateAndAttributeVerified,false);
 assert.equal(r.actions.every(x=>x.completedNow===null),true);
});
test('map checklist refuses actor attributes from a different ROM SHA',()=>{
 const {buildMapChecklist}=require('../romWorldChecklist');
 const input=sample();
 input.scriptAtlas.romSha256=KNOWN.green;
 const r=buildMapChecklist({...input,mapId:226});
 assert.equal(r.verified,true);
 assert.equal(r.actorAttributeAtlasBound,false);
 assert.equal(r.summary.boundStaticActorAttributes,0);
 assert.equal(r.actions.every(x=>x.romActorCoordinateAndAttributeVerified===false),
  true);
});
