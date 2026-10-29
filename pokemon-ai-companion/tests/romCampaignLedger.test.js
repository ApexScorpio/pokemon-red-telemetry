'use strict';
// Integration contracts are tested with deterministic ROM/RAM fixtures. These
// are NOT a substitute for 3 original ROMs and live emulator snapshots.
const test=require('node:test');
const assert=require('node:assert/strict');
const {diffCampaignProgress}=require('../romCampaignDelta');
const fs=require('node:fs');
const path=require('node:path');
const {bindMartPrices}=require('../romMartPriceBinding');
const auditedEconomy=require('../data/gen1EconomyTradesAudited.json');
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
  './romMartPriceBinding':{bindMartPrices},
  './data/gen1EconomyTradesAudited.json':auditedEconomy,
  './romKnownSha256':{isKnownAuditedRomSha:x=>x===sha},
  './romTrainerEvents':{trainerFlagsForCurrentMap:(p,m,flags)=>({
    verified:m.mapId===15,entries:m.mapId===15?[{
      objectOrdinal:1,eventBitIndex:10,
      eventFlagSet:(parseInt(flags[1],16)&4)!==0,victoryRecorded:null,
      battleWasPlayed:null}]:[]})},
  './romStaticEncounterEvents':{stationaryPokemonEvents:(p,m,flags)=>({
    verified:m.mapId===83,entries:m.mapId===83?[{
      objectOrdinal:1,eventBitIndex:0,
      encounterGateClosed:(parseInt(flags[0],16)&1)!==0}]:[]})},
  './romEventState':{fromKnownRom:()=>hidden,
    decodeHiddenCoins:(p,mapId,flags)=>({
     verified:true,coins:mapId===135?Array.from({length:coinCount},(_,i)=>({
       hiddenIndex:i,x:i%6,y:3,
       isCollected:(parseInt(flags[i>>3]||'00',16)&(1<<(i&7)))!==0})):[]})}
 };
 const mod={exports:{}};
 // Execute trusted repository source in the same Node realm to keep
 // array prototypes identical for deepStrictEqual assertions.
 new Function('module','require',src)(mod,id=>{
   if(!Object.hasOwn(mock,id))throw Error('Unexpected dependency '+id);
   return mock[id];
 });
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
 assert.equal(res.bitwiseEventEvidenceAvailable,true);
 assert.equal(res.mapProgress[15].flagRecords.hiddenItems.length,54);
 assert.equal(res.mapProgress[15].flagRecords.hiddenItems[0].bitIndex,0);
 assert.equal(res.mapProgress[15].flagRecords.hiddenItems[0].flagSet,true);
 assert.equal(res.mapProgress[15].flagRecords.trainers[0].bitIndex,10);
 assert.equal(res.mapProgress[83].flagRecords.stationaryPokemon[0].bitIndex,0);
 assert.equal(res.mapProgress[135].flagRecords.hiddenCoins.length,12);
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

test('end-to-end ledger snapshots yield exact, distinct bit changes',()=>{
 const x=rig();
 const before=evaluate(x);
 x.items[0]='01';
 x.coins[0]='01';
 x.hex[1]='04';
 x.hex[0]='01';
 const after=evaluate(x);
 assert.equal(before.verified,true);
 assert.equal(after.verified,true);
 const d=diffCampaignProgress({previous:before,current:after});
 assert.equal(d.verified,true);
 assert.equal(d.granularity,'EXACT_ROM_EVENT_BIT');
 assert.deepEqual(d.changes.map(c=>c.kind).sort(),[
   'HIDDEN_COIN_FLAG_RAISED','HIDDEN_ITEM_FLAG_RAISED',
   'STATIONARY_GATE_FLAG_RAISED','TRAINER_GATE_FLAG_RAISED'
 ].sort());
 assert.ok(d.changes.every(c=>Number.isInteger(c.bitIndex)));
 assert.ok(d.changes.every(c=>c.playerActionConfirmed===false));
});

test('all maps inventory visible item objects without falsely proving pickup',()=>{
 const x=rig();
 x.profile.world.maps.data[18].objects.objects.push({
   kind:'item',x:7,y:3,trainerClassOrItemId:42});
 x.profile.world.maps.data[18].objects.objects.push({
   kind:'item',x:2,y:4,trainerClassOrItemId:43});
 const r=evaluate(x);
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.mapProgress[18].visibleItems.objects,2);
 assert.equal(r.mapProgress[18].visibleItems.unresolved,2);
 assert.equal(r.totals.visibleItemObjects,2);
 assert.equal(r.totals.visibleItemsCollectionUnresolved,2);
 assert.equal(r.mapProgress[18].flagRecords.visibleItems.length,2);
 assert.equal(r.mapProgress[18].flagRecords.visibleItems[0].x,7);
 assert.equal(r.mapProgress[18].flagRecords.visibleItems[0].itemId,42);
 assert.equal(r.mapProgress[18].flagRecords.visibleItems[0].collected,null);
 assert.equal(r.mapProgress[18].flagRecords.visibleItems[0].removedFromCurrentMap,null);
 assert.equal(r.mapProgress[18].hiddenItems.notCollected,0);
 const damaged=rig();
 damaged.profile.world.maps.data[18].objects.objects.push({
   kind:'item',x:-1,y:4});
 assert.equal(evaluate(damaged).verified,false);
});

test('all-map static NPC and sign inventory conservatively refuses to infer dialog outcome',()=>{
 const f=rig();
 f.profile.world.maps.data[19].objects.signs=[
   {x:5,y:2,textId:7},{x:1,y:3,textId:8}];
 f.profile.world.maps.data[19].objects.objects.push(
   {kind:'npc',x:3,y:4,textId:9},
   {kind:'npc',x:2,y:1,textId:10});
 const r=evaluate(f);
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.totals.npcObjects,2);
 assert.equal(r.totals.signObjects,2);
 assert.equal(r.totals.interactionOutcomesUnresolved,4);
 assert.deepEqual(r.mapProgress[19].interactionRecords.npcs,
   [[1,3,4,9],[2,2,1,10]]);
 assert.deepEqual(r.mapProgress[19].interactionRecords.signs,
   [[1,5,2,7],[2,1,3,8]]);
 assert.equal(r.mapProgress[19].interactions.unresolved,4);
 assert.equal(r.mapProgress[19].scriptEffectsComplete,false);
});
test('unlocalized NPC is counted as unknown without fabricating position',()=>{
 const f=rig();
 f.profile.world.maps.data[19].objects.objects=[
   {kind:'npc',x:-1,y:3,textId:5}];
 const r=evaluate(f);
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.mapProgress[19].interactions.npcObjects,1);
 assert.equal(r.mapProgress[19].interactions.coordinatesUnverified,1);
 assert.equal(r.mapProgress[19].interactionRecords.npcs.length,0);
});

test('NPC and sign text pointer evidence enriches tuples without changing flag semantics',()=>{
 const x=rig();
 x.profile.world.maps.data[19].objects.signs=[{x:5,y:2,textId:7,
   textPointerEvidence:{verified:true,command:'TX_FAR',
     romBank:6,textPointerCpu:0x5400}}];
 x.profile.world.maps.data[19].objects.objects=[{kind:'npc',x:3,y:4,
   textId:9,textPointerEvidence:{verified:true,command:'SCRIPT_MART',
     romBank:0,textPointerCpu:0x24ea}}];
 const r=evaluate(x);
 assert.equal(r.verified,true);
 assert.equal(r.totals.interactionTextPointersVerified,2);
 assert.deepEqual(r.mapProgress[19].interactionRecords.signs[0],
   [1,5,2,7,'TX_FAR',6,0x5400]);
 assert.deepEqual(r.mapProgress[19].interactionRecords.npcs[0],
   [1,3,4,9,'SCRIPT_MART',0,0x24ea]);
 assert.equal(r.mapProgress[19].scriptEffectsComplete,false);
});

test('only verified static mart lists add optional eighth tuple element',()=>{
 const f=rig();
 f.profile.world.maps.data[19].objects.objects=[
   {kind:'npc',x:3,y:4,textId:9,textPointerEvidence:{
     verified:true,command:'SCRIPT_MART',romBank:0,textPointerCpu:0x24ea,
     mart:{verified:true,itemIds:[4,20,29]}}}
 ];
 const r=evaluate(f);
 assert.equal(r.verified,true);
 assert.deepEqual(r.mapProgress[19].interactionRecords.npcs[0],
   [1,3,4,9,'SCRIPT_MART',0,0x24ea,[4,20,29]]);
 assert.equal(r.mapProgress[19].scriptEffectsComplete,false);
 f.profile.world.maps.data[19].objects.objects[0].textPointerEvidence.mart.itemIds=[0];
 const invalid=evaluate(f);
 assert.equal(invalid.mapProgress[19].interactionRecords.npcs[0].length,7);
});

test('mart tuple adds audited names and base ROM prices only for exact map and SHA',()=>{
 const f=rig();
 f.profile.world.maps.data[56].objects.objects=[{
   kind:'npc',x:2,y:3,textId:1,textPointerEvidence:{
     verified:true,command:'SCRIPT_MART',romBank:0,textPointerCpu:0x24ea,
     mart:{verified:true,itemIds:[4,20,29,11,12,14,15]}}}];
 const r=evaluate(f),row=r.mapProgress[56].interactionRecords.npcs[0];
 assert.equal(r.verified,true);
 assert.equal(row.length,9);
 assert.equal(row[8][0].name,'POKE_BALL');
 assert.equal(row[8][0].baseRomPricePokedollars,200);
 assert.equal(row[8][0].priceIsLive,false);
 f.profile.world.maps.data[56].objects.objects[0].textPointerEvidence.mart.itemIds.reverse();
 const changed=evaluate(f);
 assert.equal(changed.mapProgress[56].interactionRecords.npcs[0].length,8);
});

test('Tuplo TX_FAR com prévia textual não prova diálogo nem efeitos',()=>{
 const x=rig();
 x.profile.world.maps.data[19].objects.signs=[{
   x:5,y:2,textId:7,textPointerEvidence:{
     verified:true,command:'TX_FAR',romBank:6,textPointerCpu:0x5400,
     staticTextPreview:{verified:true,text:'Hi <PLAYER>!',
       firstStringOnly:true,containsRuntimeVariables:true,
       dialogueExecuted:false,textOutcomeVerified:false}
   }
 }];
 const r=evaluate(x);
 assert.equal(r.verified,true);
 const entry=r.mapProgress[19].interactionRecords.signs[0];
 assert.equal(entry.length,8);
 assert.equal(entry[7].text,'Hi <PLAYER>!');
 assert.equal(entry[7].containsRuntimeVariables,true);
 assert.equal(entry[7].dialogueExecuted,false);
 assert.equal(r.mapProgress[19].scriptEffectsComplete,false);
 x.profile.world.maps.data[19].objects.signs[0].textPointerEvidence
   .staticTextPreview.textOutcomeVerified=true;
 assert.equal(evaluate(x).mapProgress[19].interactionRecords.signs[0].length,7);
});

test('ledger só propaga sequência textual ROM quando todos os campos são seguros',()=>{
 const f=rig();
 const pointer={verified:true,command:'TX_FAR',romBank:0,
   textPointerCpu:0x24e5,
   staticTextPreview:{verified:true,firstStringOnly:true,text:'Hi',
     containsRuntimeVariables:false,dialogueExecuted:false,
     textOutcomeVerified:false,program:{verified:true,scriptComplete:true,
       text:'Hi | There',segmentCount:2,termination:'TEXT_PROMPT',containsRuntimeText:false,
       containsRuntimeCommands:true,dialogueExecuted:false,
       textOutcomeVerified:false,scriptEffectsVerified:false}}};
 f.profile.world.maps.data[19].objects.signs=[
   {x:5,y:2,textId:7,textPointerEvidence:pointer}];
 let r=evaluate(f);
 let preview=r.mapProgress[19].interactionRecords.signs[0][7];
 assert.equal(preview.program.verified,true);
 assert.equal(preview.program.text,'Hi | There');
 assert.equal(preview.program.containsRuntimeCommands,true);
 assert.equal(r.mapProgress[19].scriptEffectsComplete,false);
 pointer.staticTextPreview.program.scriptEffectsVerified=true;
 r=evaluate(f);
 preview=r.mapProgress[19].interactionRecords.signs[0][7];
 assert.equal(preview.text,'Hi');
 assert.equal(preview.program,undefined);
});
