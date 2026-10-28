'use strict';
// Integration contracts are tested with deterministic ROM/RAM fixtures. These
// are NOT a substitute for 3 original ROMs and live emulator snapshots.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../romCampaignLedger.js'),'utf8');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function rig({coinCount=12}={}){
 const data=Array.from({length:248},(_,mapId)=>({
   mapId,valid:mapId<226,objects:{objects:[]}}));
 data[15].objects.objects=[{kind:'trainer',trainerClassOrItemId:201}];
 data[83].objects.objects=[{kind:'wildPokemon',trainerClassOrItemId:6}];
 const profile={hash:{sha256:sha},world:{maps:{valid:true,data}}};
 const hex=Array(320).fill('00'),items=Array(14).fill('00'),coins=Array(2).fill('00');
 const hidden=Array.from({length:54},(_,hiddenIndex)=>({
   hiddenIndex,mapId:15,x:3,y:hiddenIndex%20}));
 const mock={
  './romKnownSha256':{isKnownAuditedRomSha:x=>x===sha},
  './romTrainerEvents':{trainerFlagsForCurrentMap:(p,m,flags)=>({
    verified:m.mapId===15,entries:m.mapId===15?[{
      eventFlagSet:(parseInt(flags[1],16)&4)!==0,victoryRecorded:null,
      battleWasPlayed:null}]:[]})},
  './romStaticEncounterEvents':{stationaryPokemonEvents:(p,m,flags)=>({
    verified:m.mapId===83,entries:m.mapId===83?[{
      encounterGateClosed:(parseInt(flags[0],16)&1)!==0}]:[]})},
  './romEventState':{fromKnownRom:()=>hidden,
    decodeHiddenCoins:(p,mapId,flags)=>({
     verified:true,coins:mapId===135?Array.from({length:coinCount},(_,i)=>({
       isCollected:(parseInt(flags[i>>3]||'00',16)&(1<<(i&7)))!==0})):[]})}
 };
 const mod={exports:{}};
 vm.runInNewContext(src,{module:mod,require:id=>{
   if(!Object.hasOwn(mock,id))throw Error('Unexpected dependency '+id);
   return mock[id];
 }});
 return {build:mod.exports.buildCampaignLedger,profile,hex,items,coins};
}
function evaluate(x){return x.build({profile:x.profile,
 romIdentityMatched:true,mapWindowVerified:true,
 eventFlagsHex:x.hex,hiddenItemHex:x.items,hiddenCoinHex:x.coins});}
test('global world count and independent event domains, not fake victories',()=>{
 const x=rig();
 x.hex[1]='04';x.hex[0]='01';x.items[0]='01';x.coins[0]='01';
 const res=evaluate(x);
 assert.equal(res.verified,true);
 assert.equal(res.mapCount,226);
 assert.equal(res.totals.hiddenItems,54);
 assert.equal(res.totals.hiddenItemsCollected,1);
 assert.equal(res.totals.hiddenCoins,12);
 assert.equal(res.totals.hiddenCoinsCollected,1);
 assert.equal(res.totals.trainerGatesClosed,1);
 assert.equal(res.totals.scriptedVictories,0);
 assert.equal(res.totals.stationaryGatesClosed,1);
 assert.equal(res.stationaryGateClosedIsCaptured,false);
 assert.equal(res.trainerGateClosedIsVictory,false);
 assert.equal(res.accessCurrentlyProven,false);
 assert.equal(res.snapshotAtomicVerified,false);
});
test('refuses incomplete RAM and unknown ROM identity, no partial values',()=>{
 const x=rig();
 x.items.pop();
 assert.equal(evaluate(x).verified,false);
 const y=rig();y.profile.hash.sha256='0'.repeat(64);
 assert.equal(evaluate(y).verified,false);
 const z=rig();z.profile.world.maps.data.pop();
 assert.equal(evaluate(z).verified,false);
});
test('no global state on uncorroborated live map or ROM',()=>{
 const x=rig();
 const a=x.build({profile:x.profile,romIdentityMatched:false,
 mapWindowVerified:true,eventFlagsHex:x.hex,hiddenItemHex:x.items,hiddenCoinHex:x.coins});
 assert.equal(a.verified,false);
 const b=x.build({profile:x.profile,romIdentityMatched:true,
 mapWindowVerified:false,eventFlagsHex:x.hex,hiddenItemHex:x.items,hiddenCoinHex:x.coins});
 assert.equal(b.verified,false);
});
test('missing any one of 12 hidden coin records rejects completeness',()=>{
 const x=rig({coinCount:11});
 assert.equal(evaluate(x).verified,false);
});
