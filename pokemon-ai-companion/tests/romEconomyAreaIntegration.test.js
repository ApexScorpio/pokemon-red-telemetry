'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {staticServicesForMap}=require('../romAreaGuide');
const catalogue=require('../data/gen1EconomyTradesAudited.json');
const species=Array.from({length:190},(_,i)=>({internalId:i+1,name:'ROM_MON_'+(i+1),dex:i+1}));
for(const [sha,economyTrades] of Object.entries(catalogue.entries)){
 test(economyTrades.version+' 4 shop/rod/trade/prize services derived from exact SHA',()=>{
  const p={species,hash:{sha256:sha},economyTrades};
  const mart=staticServicesForMap(p,42);
  assert.equal(mart.verified,true);
  assert.equal(mart.shops.length,1);
  assert.equal(mart.shops[0].inventory.length,4);
  assert.equal(mart.shops[0].inventory[0].pricePokedollars,200);
  assert.equal(mart.shops[0].shopIsOpenNow,null);
  const prize=staticServicesForMap(p,137).gameCorner;
  assert.ok(prize);assert.equal(prize.menus.length,3);
  assert.equal(prize.menus[0].products[0].coinPrice,economyTrades.prizeCorner.menus[0].products[0].coinPrice);
  const drinks=staticServicesForMap(p,126).vending;
  assert.equal(drinks.inventory.length,3);
  const trades=staticServicesForMap(p,48).trades;
  assert.equal(trades.length,1);
  assert.equal(trades[0].nickname,economyTrades.npcTrades.trades[1].receivedNickname);
  assert.equal(trades[0].completed,null);
  assert.equal(trades[0].liveNpcScriptVerified,false);
  const fishing=staticServicesForMap(p,0).fishing;
  assert.equal(fishing.superRod.slots.length,2);
  assert.equal(fishing.eligibleFishingActionVerified,false);
 });
}
test('no local full-ROM proof does not fabricate shop inventories',()=>{
 const p={species,economyTrades:null};
 assert.equal(staticServicesForMap(p,42).verified,false);
});
