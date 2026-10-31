'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compareCrossVariantWorldContents,
 compareCrossVariantWorldFieldDifferences}=require('../romCrossVariantWorldContents');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
const reserved=new Set([11,105,106,107,109,110,111,112,114,115,116,117,
 204,205,206,231,237,238,241,242,243,244]);
const blank=()=>({accessibleNow:null,collected:null,completed:null,
 needsCut:null,needsSurf:null,reason:'unknown'});
function actor(id){return {...blank(),ordinal:1,kind:'item',x:3,y:4,
 spriteId:5,textId:7,itemOrTrainerId:id,
 trainerNumberOrLevel:null,wildSpeciesInternalId:null,wildLevel:null,
 source:'ROM_MAP_OBJECT_BYTES'};}
function fixture(sha){
 const maps=Array.from({length:248},(_,mapId)=>reserved.has(mapId)?
  {mapId,verified:false,status:'NO_NORMAL_MAP_HEADER',
   contents:null,unassignedHiddenItems:[]}:
  {mapId,verified:true,status:'ROM_STATIC_CONTENTS',
   widthBlocks:12,heightBlocks:10,
   contents:{visibleItems:[],hiddenItems:[],trainers:[],npcs:[],
    stationaryPokemon:[],signs:[],warps:[]}});
 maps[0].contents.visibleItems.push(actor(1));
 maps[1].contents.visibleItems.push(actor(2));
 maps[0].contents.warps.push({...blank(),ordinal:1,x:2,y:3,
  destinationMap:20,destinationWarp:0,destinationDynamic:false,
  source:'ROM_MAP_WARP_BYTES'});
 maps[0].contents.signs.push({...blank(),ordinal:1,x:6,y:7,textId:10,
  textMeaningVerified:false,source:'ROM_MAP_SIGN_BYTES'});
 for(let i=0;i<54;i++)maps[0].contents.hiddenItems.push({...blank(),
  hiddenIndex:i,x:i,y:1,itemId:30,
  source:'ROM_HIDDEN_ITEM_SCRIPT_AND_COORDINATES'});
 return {verified:true,romSha256:sha,
  source:'SHA_AUDITED_ROM_PROFILE_ALL_MAP_HEADERS_AND_OBJECT_RECORDS',
  hiddenItemCoordinatesVerified:true,runtimeStateVerified:false,
  totalMapsWithLiveCompletionVerified:0,maps,unassignedHiddenItems:[],
  totals:{normalMaps:226,reservedOrUnresolvedMapIds:22,
   visibleItems:2,hiddenItems:54,hiddenItemsInNormalMaps:54,
   hiddenItemsWithoutNormalHeader:0,trainers:0,npcs:0,
   stationaryPokemon:0,warps:1,signs:1}};
}
function trio(){return {
 red:fixture(AUDITED_ROM_SHA256.RED),
 blue:fixture(AUDITED_ROM_SHA256.BLUE),
 green:fixture(AUDITED_ROM_SHA256.GREEN_INTERNATIONAL_1_2_1)};}
test('compares 248 real-shaped map object records, not only gap counts',()=>{
 const x=compareCrossVariantWorldContents(trio());
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.mapsCompared,248);
 assert.equal(x.equalDecodedMaps,248);
 assert.equal(x.decodedMapDifferences,0);
 assert.equal(x.sameDecodedObjectRecords,true);
 assert.equal(x.gameplayEquivalent,null);
 assert.equal(x.gameplayCompletionCertified,false);
});
test('item IDs exchanged between maps are detected despite matching totals',()=>{
 const r=trio();
 [r.blue.maps[0].contents.visibleItems[0].itemOrTrainerId,
  r.blue.maps[1].contents.visibleItems[0].itemOrTrainerId]=
  [r.blue.maps[1].contents.visibleItems[0].itemOrTrainerId,
   r.blue.maps[0].contents.visibleItems[0].itemOrTrainerId];
 const x=compareCrossVariantWorldContents(r);
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.decodedMapDifferences,2);
 assert.deepEqual(x.differingMaps.map(m=>m.mapId),[0,1]);
 assert.deepEqual(x.differingMaps[0].categories,['visibleItems']);
 assert.equal(x.perCategoryMapDifferences.visibleItems,2);
 assert.equal(x.gameplayEquivalent,null);
});
test('warp destination and sign text changes distinguish physical content',()=>{
 const r=trio();
 r.green.maps[0].contents.warps[0].destinationMap=25;
 r.blue.maps[0].contents.signs[0].textId=8;
 const x=compareCrossVariantWorldContents(r);
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.decodedMapDifferences,1);
 assert.deepEqual(x.differingMaps[0].categories,['signs','warps']);
 assert.equal(x.perCategoryMapDifferences.signs,1);
 assert.equal(x.perCategoryMapDifferences.warps,1);
 assert.equal(x.differingMaps[0].gameEffectProven,false);
});
test('map geometry can differ even when all action counters match',()=>{
 const r=trio();r.green.maps[10].widthBlocks=14;
 const x=compareCrossVariantWorldContents(r);
 assert.equal(x.verified,true,x.reason);
 assert.deepEqual(x.differingMaps.map(m=>m.mapId),[10]);
 assert.deepEqual(x.differingMaps[0].categories,['geometry']);
});
test('unknown SHA and fake runtime completion evidence fail closed',()=>{
 const x=trio();x.red.romSha256='0'.repeat(64);
 assert.equal(compareCrossVariantWorldContents(x).verified,false);
 const y=trio();y.blue.runtimeStateVerified=true;
 assert.equal(compareCrossVariantWorldContents(y).verified,false);
 const z=trio();z.green.maps[0].contents.visibleItems[0].collected=true;
 assert.equal(compareCrossVariantWorldContents(z).verified,false);
});
test('missing hidden item, duplicate map ID, fake warp are all rejected',()=>{
 const a=trio();a.red.maps[0].contents.hiddenItems.pop();
 assert.equal(compareCrossVariantWorldContents(a).verified,false);
 const b=trio();b.green.maps[10].mapId=11;
 assert.equal(compareCrossVariantWorldContents(b).verified,false);
 const c=trio();c.blue.maps[0].contents.warps[0].destinationDynamic=true;
 assert.equal(compareCrossVariantWorldContents(c).verified,false);
});
test('non-normal map headers cannot silently claim to have parsed objects',()=>{
 const t=trio();
 const row=t.red.maps[11];row.contents={visibleItems:[]};
 assert.equal(compareCrossVariantWorldContents(t).verified,false);
});
test('original Red Blue Green ROMs compare every decoded map actor and warp',
 {skip:!['POKEMON_RED_ROM','POKEMON_BLUE_ROM','POKEMON_GREEN_ROM']
 .every(n=>process.env[n])?'Three original ROMs required':false},()=>{
  const records={};
  for(const [variant,env] of [
   ['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
   ['green','POKEMON_GREEN_ROM']]){
   const profile=inspectRomBuffer(readRom(process.env[env]),variant+'.gb');
   assert.equal(profile.hash.sha256,KNOWN[variant]);
   const index=buildWorldContentsIndex(profile);
   assert.equal(index.verified,true,index.reason);
   assert.equal(index.hiddenItemCoordinatesVerified,true);
   assert.equal(index.totals.warps,813);
   assert.equal(index.totals.trainers,334);
   assert.equal(index.totals.visibleItems,106);
   assert.equal(index.totals.hiddenItems,54);
   records[variant]=index;
  }
  const result=compareCrossVariantWorldContents(records);
  assert.equal(result.verified,true,result.reason);
  assert.equal(result.mapsCompared,248);
  assert.equal(result.equalDecodedMaps+result.decodedMapDifferences,248);
  assert.equal(result.gameplayEquivalent,null);
  assert.equal(result.gameplayCompletionCertified,false);
 });

test('signs and warps use the original ROM coordinate range minus four to 255',()=>{
 const r=trio();
 r.red.maps[0].contents.signs[0].x=-4;
 r.blue.maps[0].contents.warps[0].y=-2;
 const x=compareCrossVariantWorldContents(r);
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.decodedMapDifferences,1);
 assert.deepEqual(x.differingMaps[0].categories,['signs','warps']);
});

test('field-level comparison returns zero entries on matching decoded records',()=>{
 const r=compareCrossVariantWorldFieldDifferences(trio());
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.mapsCompared,248);
 assert.equal(r.fieldDifferenceCount,0);
 assert.deepEqual(r.differingMapIds,[]);
 assert.equal(r.gameplayEquivalent,null);
 assert.equal(r.gameplayCompletionCertified,false);
});
test('item IDs exchanged between maps identify the exact ID and raw variants',()=>{
 const x=trio();
 [x.blue.maps[0].contents.visibleItems[0].itemOrTrainerId,
  x.blue.maps[1].contents.visibleItems[0].itemOrTrainerId]=
  [x.blue.maps[1].contents.visibleItems[0].itemOrTrainerId,
   x.blue.maps[0].contents.visibleItems[0].itemOrTrainerId];
 const r=compareCrossVariantWorldFieldDifferences(x);
 assert.equal(r.verified,true,r.reason);
 assert.deepEqual(r.differingMapIds,[0,1]);
 assert.equal(r.fieldDifferenceCount,2);
 const first=r.fieldDifferences[0];
 assert.equal(first.mapId,0);
 assert.equal(first.category,'visibleItems');
 assert.equal(first.recordIndex,0);
 assert.equal(first.field,'itemOrTrainerId');
 assert.deepEqual(first.values,{RED:1,BLUE:2,GREEN:1});
 assert.equal(first.decodedRecordOnly,true);
 assert.equal(first.playerProgressProven,false);
 assert.equal(first.gameEffectProven,false);
 assert.equal(r.recordAlignment,
  'POSITION_WITHIN_DECODED_TYPE_NOT_PROVEN_SAME_ACTOR');
});
test('warp, sign, and stationary Pokemon differences identify precise fields',()=>{
 const x=trio();
 x.blue.maps[0].contents.warps[0].destinationMap=44;
 x.green.maps[0].contents.signs[0].textId=22;
 x.green.maps[0].contents.stationaryPokemon.push({...blank(),
  ordinal:1,kind:'wildPokemon',x:9,y:10,spriteId:2,textId:1,
  itemOrTrainerId:null,trainerNumberOrLevel:null,
  wildSpeciesInternalId:151,wildLevel:30,source:'ROM_MAP_OBJECT_BYTES'});
 x.red.maps[0].contents.stationaryPokemon.push({...blank(),
  ordinal:1,kind:'wildPokemon',x:9,y:10,spriteId:2,textId:1,
  itemOrTrainerId:null,trainerNumberOrLevel:null,
  wildSpeciesInternalId:150,wildLevel:30,source:'ROM_MAP_OBJECT_BYTES'});
 x.blue.maps[0].contents.stationaryPokemon.push({...blank(),
  ordinal:1,kind:'wildPokemon',x:9,y:10,spriteId:2,textId:1,
  itemOrTrainerId:null,trainerNumberOrLevel:null,
  wildSpeciesInternalId:150,wildLevel:30,source:'ROM_MAP_OBJECT_BYTES'});
 x.red.totals.stationaryPokemon=1;
 x.blue.totals.stationaryPokemon=1;
 x.green.totals.stationaryPokemon=1;
 const r=compareCrossVariantWorldFieldDifferences(x);
 assert.equal(r.verified,true,r.reason);
 assert.deepEqual(r.differingMapIds,[0]);
 assert.deepEqual(r.fieldDifferences.map(d=>[d.category,d.field]),
  [['stationaryPokemon','wildSpeciesInternalId'],
   ['signs','textId'],['warps','destinationMap']]);
 assert.deepEqual(r.fieldDifferences[0].values,{RED:150,BLUE:150,GREEN:151});
 assert.deepEqual(r.fieldDifferences[2].values,{RED:20,BLUE:44,GREEN:20});
});
test('record count change produces presence evidence rather than an invented actor',()=>{
 const x=trio();
 x.green.maps[0].contents.visibleItems.push({...actor(3),ordinal:2,x:5,y:6});
 x.green.totals.visibleItems++;
 const r=compareCrossVariantWorldFieldDifferences(x);
 assert.equal(r.verified,true,r.reason);
 assert.deepEqual(r.differingMapIds,[0]);
 assert.ok(r.fieldDifferences.some(d=>d.field==='recordPresent'&&
  d.category==='visibleItems'&&d.recordIndex===1&&
  d.values.RED===false&&d.values.GREEN===true));
 assert.equal(r.gameplayCompletionCertified,false);
});
test('original three ROMs: 226/227 detailed item and stationary records',
 {skip:!['POKEMON_RED_ROM','POKEMON_BLUE_ROM','POKEMON_GREEN_ROM']
 .every(n=>process.env[n])?'Three original ROMs required':false},()=>{
  const records={};
  for(const [variant,env] of [
   ['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
   ['green','POKEMON_GREEN_ROM']]){
   const p=inspectRomBuffer(readRom(process.env[env]),variant+'.gb');
   assert.equal(p.hash.sha256,KNOWN[variant]);
   const index=buildWorldContentsIndex(p);
   assert.equal(index.verified,true,index.reason);
   records[variant]=index;
  }
  const result=compareCrossVariantWorldFieldDifferences(records);
  assert.equal(result.verified,true,result.reason);
  assert.equal(result.mapsCompared,248);
  assert.deepEqual(result.differingMapIds,[226,227]);
  assert.ok(result.fieldDifferenceCount>=3);
  const at226=result.fieldDifferences.filter(d=>d.mapId===226);
  const at227=result.fieldDifferences.filter(d=>d.mapId===227);
  assert.ok(at226.some(d=>d.category==='visibleItems'));
  assert.ok(at227.some(d=>d.category==='visibleItems'));
  assert.ok(at227.some(d=>d.category==='stationaryPokemon'));
  assert.equal(result.gameplayEquivalent,null);
  assert.equal(result.gameplayCompletionCertified,false);
 });
