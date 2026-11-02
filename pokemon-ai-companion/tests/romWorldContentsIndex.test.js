'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {buildWorldContentsIndex,getMapContents}=require('../romWorldContentsIndex');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const {readRom}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const reserved=new Set([11,105,106,107,109,110,111,112,114,115,116,117,
 204,205,206,231,237,238,241,242,243,244]);
const hash=AUDITED_ROM_SHA256.RED;
function profile(){
 const data=Array.from({length:248},(_,mapId)=>({
  mapId,valid:!reserved.has(mapId),
  mapBank:1,
  objects:{warps:[],signs:[],objects:[]}
 }));
 data[15].objects={
  warps:[{x:4,y:5,destinationMap:255,destinationWarp:3}],
  signs:[{x:9,y:10,textId:4}],
  objects:[
   {x:5,y:8,kind:'item',spriteId:11,textId:129,trainerClassOrItemId:45},
   {x:8,y:9,kind:'trainer',spriteId:12,textId:65,
    trainerClassOrItemId:205,trainerNumberOrLevel:2},
   {x:7,y:7,kind:'npc',spriteId:13,textId:1},
   {x:12,y:6,kind:'wildPokemon',spriteId:14,textId:66,
    wildSpeciesInternalId:150,wildLevel:70}
  ]
 };
 const hidden=Array.from({length:54},(_,i)=>({
  hiddenIndex:i,mapId:15,x:2+i%15,y:4+Math.floor(i/15),itemId:30
 }));
 return {hash:{sha256:hash},unknownLayout:false,world:{
  maps:{valid:true,validMapHeaders:226,data},
  hiddenItemScripts:{valid:true,sha256:hash,items:hidden}
 }};
}
test('248 map IDs, 226 normal maps, 22 undecoded slots, all static actors retained',()=>{
 const index=buildWorldContentsIndex(profile());
 assert.equal(index.verified,true);
 assert.equal(index.maps.length,248);
 assert.equal(index.totals.normalMaps,226);
 assert.equal(index.totals.reservedOrUnresolvedMapIds,22);
 assert.equal(index.totals.visibleItems,1);
 assert.equal(index.totals.hiddenItems,54);
 assert.equal(index.totals.hiddenItemsInNormalMaps,54);
 assert.equal(index.totals.hiddenItemsWithoutNormalHeader,0);
 assert.deepEqual(index.unassignedHiddenItems,[]);
 assert.equal(index.totals.trainers,1);
 assert.equal(index.totals.npcs,1);
 assert.equal(index.totals.stationaryPokemon,1);
 assert.equal(index.totals.warps,1);
 assert.equal(index.totals.signs,1);
 assert.equal(index.runtimeStateVerified,false);
 const m=getMapContents(index,15);
 assert.equal(m.verified,true);
 assert.equal(m.contents.visibleItems[0].itemOrTrainerId,45);
 assert.equal(m.contents.trainers[0].trainerNumberOrLevel,2);
 assert.equal(m.contents.stationaryPokemon[0].wildLevel,70);
 assert.equal(m.contents.warps[0].destinationDynamic,true);
 assert.equal(m.contents.warps[0].destinationMap,255);
 assert.equal(m.contents.signs[0].textMeaningVerified,false);
 assert.equal(m.activeMapVerified,false);
 assert.equal(m.liveProgressVerified,false);
 for(const contents of Object.values(m.contents)){
  for(const item of contents){
   assert.equal(item.accessibleNow,null);
   assert.equal(item.completed,null);
   assert.equal(item.collected,null);
   assert.equal(item.needsCut,null);
   assert.equal(item.needsSurf,null);
  }
 }
});
test('map is not dropped because it has no objects; reserved maps do not claim absence',()=>{
 const index=buildWorldContentsIndex(profile());
 assert.equal(getMapContents(index,0).verified,true);
 assert.deepEqual(getMapContents(index,0).contents.visibleItems,[]);
 assert.equal(getMapContents(index,11).verified,false);
 assert.equal(getMapContents(index,11).contents,null);
 assert.equal(getMapContents(index,248).verified,false);
});
test('rejects unknown SHA, duplicate index, 225 headers, corrupt map contents',()=>{
 const p=profile();
 assert.equal(buildWorldContentsIndex({...p,hash:{sha256:'0'.repeat(64)}}).verified,false);
 const duplicate=structuredClone(p);
 duplicate.world.maps.data[15].mapId=16;
 assert.equal(buildWorldContentsIndex(duplicate).verified,false);
 const truncated=structuredClone(p);
 truncated.world.maps.data[15].valid=false;
 assert.equal(buildWorldContentsIndex(truncated).verified,false);
 const corrupt=structuredClone(p);
 corrupt.world.maps.data[15].objects.warps[0].destinationMap=999;
 assert.equal(buildWorldContentsIndex(corrupt).verified,false);
});
test('hidden item list is not accepted without same-ROM provenance',()=>{
 const p=profile();p.world.hiddenItemScripts.sha256='0'.repeat(64);
 const index=buildWorldContentsIndex(p);
 assert.equal(index.verified,true);
 assert.equal(index.hiddenItemCoordinatesVerified,false);
 assert.equal(index.totals.hiddenItems,0);
 assert.equal(index.totals.hiddenItemsInNormalMaps,0);
 assert.equal(index.totals.hiddenItemsWithoutNormalHeader,0);
 assert.equal(index.totals.visibleItems,1);
});
for(const [variant,env] of [
 ['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('all 226 maps from genuine '+variant+' ROM expose exact object totals',
 {skip:!process.env[env]?'Provide original validated ROM to audit all map objects':false},()=>{
  const bytes=readRom(process.env[env]);
  const p=inspectRomBuffer(bytes,variant+'.gb');
  const index=buildWorldContentsIndex(p);
  assert.equal(index.verified,true);
  assert.equal(index.totals.normalMaps,226);
  assert.equal(index.maps.length,248);
  assert.equal(index.totals.warps,813);
  assert.equal(index.totals.npcs,472);
  assert.equal(index.totals.trainers,334);
  assert.equal(index.totals.visibleItems,106);
  assert.equal(index.totals.stationaryPokemon,12);
  assert.ok(index.totals.signs>=200);
  assert.equal(index.totals.hiddenItems,54);
  assert.equal(index.totals.hiddenItemsInNormalMaps,53);
  assert.equal(index.totals.hiddenItemsWithoutNormalHeader,1);
  assert.equal(index.unassignedHiddenItems.length,1);
  const orphan=index.unassignedHiddenItems[0];
  assert.equal(orphan.hiddenIndex,34);
  assert.equal(orphan.mapId,111);
  assert.equal(orphan.x,14);
  assert.equal(orphan.y,11);
  assert.equal(orphan.itemId>0,true);
  assert.equal(orphan.accessibleNow,null);
  assert.equal(orphan.collected,null);
  assert.equal(orphan.completed,null);
  assert.equal(orphan.scriptBindingVerified,null);
  assert.equal(index.maps[111].verified,false);
  assert.equal(index.maps[111].contents,null);
  assert.equal(index.maps[111].unassignedHiddenItems[0].hiddenIndex,34);
  assert.equal(index.totalMapsWithLiveCompletionVerified,0);
  const all=index.maps.filter(m=>m.verified).reduce(
   (count,m)=>count+Object.values(m.contents).reduce((n,rows)=>n+rows.length,0),0);
  const expected=Object.entries(index.totals).filter(
   ([key])=>!['normalMaps','reservedOrUnresolvedMapIds',
     'hiddenItems','hiddenItemsWithoutNormalHeader'].includes(key))
   .reduce((sum,[,value])=>sum+value,0);
  assert.equal(all,expected);
 });
}
