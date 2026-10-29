'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {bindMartPrices}=require('../romMartPriceBinding');
const catalogue=require('../data/gen1EconomyTradesAudited.json');
const sha=Object.keys(catalogue.entries)[0];
test('real ROM economy catalogue binds a shop by SHA, map and exact ordered IDs',()=>{
 const match=bindMartPrices({romSha256:sha,mapId:56,
   itemIds:[4,20,29,11,12,14,15],catalogue});
 assert.equal(match.verified,true,match.reason);
 assert.equal(match.shopLabel,'PewterMart');
 assert.equal(match.offers[0].name,'POKE_BALL');
 assert.equal(match.offers[0].baseRomPricePokedollars,200);
 assert.equal(match.offers[1].baseRomPricePokedollars,300);
 assert.equal(match.livePricesVerified,false);
 assert.equal(match.purchaseObserved,false);
});
test('real TM shop uses separately audited TM base prices',()=>{
 const match=bindMartPrices({romSha256:sha,mapId:123,
   itemIds:[232,233,202,207,237,201,205,209,217],catalogue});
 assert.equal(match.verified,true,match.reason);
 assert.equal(match.offers[1].name,'TM33');
 assert.equal(match.offers[1].baseRomPricePokedollars,1000);
});
test('fail closed on wrong map, article order, SHA and unaudited map',()=>{
 for(const args of [{mapId:57},{itemIds:[20,4]},
   {romSha256:'0'.repeat(64)},{mapId:173}]){
   const s=bindMartPrices({romSha256:sha,mapId:56,
     itemIds:[4,20,29,11,12,14,15],catalogue,...args});
   assert.equal(s.verified,false);
 }
});
