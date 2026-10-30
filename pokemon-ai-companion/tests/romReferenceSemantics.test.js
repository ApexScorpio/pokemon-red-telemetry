'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {lookupRomReference}=require('../romReferenceSemantics');
const e=require('../data/gen1EventNamesPret.json');
const m=require('../data/gen1MapNamesPret.json');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildStaticWorldFlagDependencies}=require('../romStaticWorldFlagDependencies');
test('pinned reference atlas contains all 248 map identifiers and exactly 507 named event bits',()=>{
 assert.equal(e.sourceCommit,m.sourceCommit);
 assert.equal(e.sourceCommit,'171e2c204f9c1ff8e577ca387a4bbb009e130843');
 assert.equal(e.totalWEventFlagsBits,2560);
 assert.equal(e.namedBitCount,507);
 assert.equal(Object.keys(e.eventNamesByBit).length,507);
 assert.equal(m.totalMapIds,248);
 assert.equal(m.mapNamesById.length,248);
 assert.equal(m.mapNamesById[148],'POKEMON_TOWER_7F');
 assert.equal(m.mapNamesById[149],'MR_FUJIS_HOUSE');
 assert.equal(m.mapNamesById[150],'LAVENDER_MART');
 assert.equal(m.mapNamesById[151],'LAVENDER_CUBONE_HOUSE');
 assert.equal(m.mapNamesById[61],'MT_MOON_B2F');
 assert.equal(m.mapNamesById[7],'FUCHSIA_CITY');
 assert.equal(m.mapNamesById[66],'BIKE_SHOP');
 assert.equal(m.mapNamesById[90],'POKEMON_FAN_CLUB');
});
test('five discovered ROM flags have exact pinned pret event labels, never gameplay truth',()=>{
 const known=[
  [192,'EVENT_GOT_BICYCLE'],
  [342,'EVENT_SEEL_FAN_BOAST'],
  [343,'EVENT_PIKACHU_FAN_BOAST'],
  [1231,'EVENT_RESCUED_MR_FUJI'],
  [1406,'EVENT_GOT_DOME_FOSSIL']
 ];
 for(const [bit,label] of known){
  const r=lookupRomReference({romSha256:KNOWN.red,eventBitIndex:bit,mapId:148});
  assert.equal(r.verified,true,r.reason);
  assert.equal(r.referenceEventName,label);
  assert.equal(r.mapNameComesFromRomBytes,false);
  assert.equal(r.eventNameComesFromRomBytes,false);
  assert.equal(r.gameplaySemanticsVerified,false);
  assert.equal(r.gameplayOutcomeObserved,false);
  assert.equal(r.sourceIsExternalReference,true);
  assert.equal(r.referenceLabelsSource,'pret/pokered');
 }
});
test('unknown ROM or event bit remains unknown instead of receiving a guessed label',()=>{
 assert.equal(lookupRomReference({romSha256:'0'.repeat(64),eventBitIndex:1231}).verified,false);
 assert.equal(lookupRomReference({romSha256:KNOWN.red,eventBitIndex:2560}).verified,false);
 assert.equal(lookupRomReference({romSha256:KNOWN.red,mapId:248}).verified,false);
 const reserved=lookupRomReference({romSha256:KNOWN.red,eventBitIndex:2559,mapId:247});
 assert.equal(reserved.verified,true);
 assert.equal(reserved.referenceEventName,null);
 assert.equal(reserved.knownNamedEventBit,false);
 assert.equal(reserved.referenceMapName,'AGATHAS_ROOM');
});
for(const [name,env] of [['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']]){
 test('real '+name+' ROM: eight physical bit dependencies attach 507-name external index without converting it to gameplay evidence',
 {skip:!process.env[env]?'Original ROM required':false},()=>{
  const rom=readRom(process.env[env]);
  const p=inspectRomBuffer(rom,name+'.gb');
  assert.equal(p.hash.sha256,KNOWN[name]);
  const x=buildStaticWorldFlagDependencies({atlas:p.world.interactionScriptAtlas});
  assert.equal(x.verified,true,x.reason);
  assert.equal(x.candidateLinks.length,8);
  const selected=new Map([
   [192,'EVENT_GOT_BICYCLE'],
   [342,'EVENT_SEEL_FAN_BOAST'],
   [343,'EVENT_PIKACHU_FAN_BOAST'],
   [1231,'EVENT_RESCUED_MR_FUJI'],
   [1406,'EVENT_GOT_DOME_FOSSIL']
  ]);
  for(const row of x.candidateLinks){
   assert.equal(row.referenceEventName,selected.get(row.bitIndex));
   assert.equal(row.referenceNameSource,'pret/pokered');
   assert.equal(row.referenceNameIsRomIntrinsic,false);
   assert.equal(row.writerReferenceMapName,m.mapNamesById[row.possibleWriterMapId]);
   assert.equal(row.readerReferenceMapName,m.mapNamesById[row.possibleReaderMapId]);
   assert.equal(row.verifiedActionDependency,false);
   assert.equal(row.causalLinkObserved,false);
  }
 });
}
