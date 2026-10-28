'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {enrichKnownEconomyProfile}=require('../romLiveResolver');
const audit=require('../data/gen1EconomyTradesAudited.json');
const expected={
 red:['5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b','9F7FDD53'],
 blue:['2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d','D6DA8A1A'],
 green:['aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db','3C2DD8AE']};
test('all three exact SHA+CRC imported profiles gain ROM-derived economy without original .gb',()=>{
 assert.equal(Object.keys(audit.entries).length,3);
 for(const [variant,[sha,crc32]] of Object.entries(expected)){
  const p={hash:{sha256:sha,crc32},bytes:1048576,bytesRead:1048576};
  const result=enrichKnownEconomyProfile(p);
  assert.equal(result,p);assert.equal(result.economyTrades?.verified,true);
  assert.equal(result.economyTrades?.version,variant);
  assert.equal(result.economyTrades?.itemPrices?.itemCount,83);
  assert.equal(result.economyTrades?.npcTrades?.recordCount,10);
  assert.equal(result.economyTrades?.itemDispatch?.entries?.length,83);
  assert.equal(result.economyTrades?.runtimeIdentityVerified,false);
  assert.equal(result.economyTrades?.livePurchaseFlagsVerified,false);
 }
});
test('wrong CRC, unknown SHA or wrong ROM length cannot inherit catalogue',()=>{
 const [sha,crc32]=expected.red;
 for(const p of [
  {hash:{sha256:sha,crc32:'00000000'},bytes:1048576,bytesRead:1048576},
  {hash:{sha256:'0'.repeat(64),crc32},bytes:1048576,bytesRead:1048576},
  {hash:{sha256:sha,crc32},bytes:524288,bytesRead:524288},
  {hash:{sha256:sha,crc32},bytes:1048576,bytesRead:1000000}
 ]){
  assert.equal(enrichKnownEconomyProfile(p).economyTrades,undefined);
 }
});
test('already locally re-read and SHA-verified catalogue is never overwritten',()=>{
 const [sha,crc32]=expected.blue;
 const local={verified:true,source:'DIRECT_LOCAL_ROM',itemPrices:{itemCount:83}};
 const p={hash:{sha256:sha,crc32},bytes:1048576,bytesRead:1048576,economyTrades:local};
 assert.equal(enrichKnownEconomyProfile(p).economyTrades,local);
});
