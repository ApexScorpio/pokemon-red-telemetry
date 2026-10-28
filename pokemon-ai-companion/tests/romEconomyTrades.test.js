'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {readRom}=require('../romComprehensiveAudit');
const {auditEconomyTrades,bcd,ITEM_NAMES,SHA}=require('../romEconomyTrades');
const dir=process.env.POKEMON_ROM_DIR||null;
const files={red:process.env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon - Red Version (UE)[!].zip')),
 blue:process.env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
 green:process.env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon%20Green%20International%20v1.2.1.gb'))};
const ready=Object.values(files).every(f=>f&&fs.existsSync(f));
const testRoms=ready?test:test.skip;
function file(variant){return readRom(files[variant]);}
const profiles={};
test('BCD decodes with strict digit validation',()=>{
 assert.equal(bcd(Buffer.from([0x01,0x23])),123);
 assert.equal(bcd(Buffer.from([0x12,0x34,0x56])),123456);
 assert.equal(bcd(Buffer.from([0x1a])),null);
});
test('fail-closed for unrecognised ROM SHA',()=>{
 const fake=Buffer.alloc(1048576);assert.equal(auditEconomyTrades(fake).verified,false);
 assert.equal(auditEconomyTrades(Buffer.alloc(32)).verified,false);
});
for(const version of Object.keys(files)){
 testRoms(version+' exact 1 MiB ROM: all 7 economy/trade/fishing catalogues validated',()=>{
  const rom=file(version),a=auditEconomyTrades(rom);profiles[version]=a;
  assert.equal(a.verified,true,JSON.stringify(a.failed));assert.equal(a.romSha256,SHA[version]);
  assert.equal(a.itemPrices.itemCount,83);
  assert.equal(a.itemDispatch.verified,true);
  assert.equal(a.itemDispatch.itemCount,83);
  assert.equal(a.itemDispatch.distinctHandlers,30);
  assert.equal(a.itemDispatch.entries[75].handler,'ItemUseOldRod');
  assert.equal(a.itemDispatch.entries[76].handler,'ItemUseGoodRod');
  assert.equal(a.itemDispatch.entries[77].handler,'ItemUseSuperRod');assert.equal(a.itemPrices.floorIdEntries,14);
  assert.equal(a.itemPrices.items.find(x=>x.name==='NUGGET').pricePokedollars,10000);
  assert.equal(a.itemPrices.items.find(x=>x.name==='POKE_BALL').pricePokedollars,200);
  assert.equal(a.itemPrices.items.find(x=>x.name==='COIN').pricePokedollars,10);
  assert.equal(a.martShops.shopCount,16);assert.equal(a.martShops.referencedShopScripts,14);
  assert.equal(a.tmPrices.entries.length,50);
  assert.deepEqual(a.vending.items.map(x=>x.pricePokedollars),[200,300,350]);
  assert.equal(a.vending.mapId,126);
  assert.equal(a.npcTrades.recordCount,10);
  assert.equal(a.prizeCorner.menus.length,3);
  assert.equal(a.fishing.superRodMaps,33);
  assert.equal(a.fishing.superRod.reduce((n,m)=>n+m.slots.length,0)>60,true);
  assert.equal(a.fishing.oldRod.immediateVerified,true);
  assert.equal(a.fishing.oldRod.speciesInternalId,133);
  assert.equal(a.fishing.goodRod.slots.length,2);
  assert.equal(a.fishing.superRod[0].bitesChanceOnEligibleAttempt.numerator,1);
  assert.equal(a.fishing.superRod[0].bitesChanceOnEligibleAttempt.denominator,2);
  assert.equal(a.runtimeIdentityVerified,false);assert.equal(a.livePurchaseFlagsVerified,false);
 });
}
testRoms('Red and Blue share NPC trades but Green International genuinely changes them',()=>{
 const red=profiles.red.npcTrades.trades,blue=profiles.blue.npcTrades.trades,green=profiles.green.npcTrades.trades;
 assert.deepEqual(red.map(x=>[x.requestedInternalId,x.receivedInternalId,x.receivedNickname]),blue.map(x=>[x.requestedInternalId,x.receivedInternalId,x.receivedNickname]));
 assert.notDeepEqual(red.map(x=>x.requestedInternalId),green.map(x=>x.requestedInternalId));
 assert.deepEqual(red[0]&&[red[0].requestedInternalId,red[0].receivedInternalId,red[0].receivedNickname],[167,168,'TERRY']);
 assert.deepEqual(green[0]&&[green[0].requestedInternalId,green[0].receivedInternalId,green[0].receivedNickname],[1,2,'RODIN']);
 assert.deepEqual(green[9]&&[green[9].requestedInternalId,green[9].receivedInternalId,green[9].receivedNickname],[165,71,'SWIRLY']);
});
testRoms('Game Corner prizes and received levels differ for each exact ROM while TM prizes stay fixed',()=>{
 const red=profiles.red.prizeCorner,blue=profiles.blue.prizeCorner,green=profiles.green.prizeCorner;
 assert.equal(red.menus[0].products[0].coinPrice,180);
 assert.equal(blue.menus[0].products[0].coinPrice,120);
 assert.equal(green.menus[0].products[0].coinPrice,150);
 assert.equal(green.menus[1].products[2].coinPrice,8300);
 assert.equal(red.menus[0].products[0].level,9);
 assert.equal(blue.menus[0].products[0].level,6);
 assert.equal(green.menus[0].products[0].level,8);
 assert.deepEqual(red.menus[2],blue.menus[2]);assert.deepEqual(red.menus[2],green.menus[2]);
});
testRoms('all shop stocks match referenced mart-script counts with zero guessed accessibility',()=>{
 for(const version of Object.keys(profiles)){
  const shops=profiles[version].martShops.shops;
  assert.deepEqual(shops[0].inventory.map(x=>x.id),[4,11,15,12]);
  assert.deepEqual(shops[3].inventory.map(x=>x.name),['BICYCLE']);
  assert.equal(shops[3].referencedInCanonicalScript,false);
  assert.equal(shops[12].referencedInCanonicalScript,false);
  assert.equal(shops[15].mapId,174);
  assert.equal(shops.every(x=>x.liveAccessible===null),true);
 }
});

testRoms('tampered real 1 MiB ROM does not inherit exact SHA-verified tables',()=>{
 const b=file('blue'),changed=Buffer.from(b);changed[0x4608]^=1;
 assert.equal(auditEconomyTrades(changed).verified,false);
});

testRoms('83 item dispatch pointers are identical across Red Blue and Green, but do not certify all effects',()=>{
 const red=profiles.red.itemDispatch.entries.map(x=>x.pointerCpu);
 for(const name of ['blue','green'])assert.deepEqual(red,profiles[name].itemDispatch.entries.map(x=>x.pointerCpu));
 assert.equal(profiles.green.itemDispatch.allHandlerEffectsCertified,false);
});