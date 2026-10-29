'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CampaignFlagSession}=require('../romCampaignSession');
const known='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const blue='2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d';
function makeLedger(sha=known){
 return {verified:true,romSha256:sha,mapCount:226,
   mapProgress:Array.from({length:226},(_,mapId)=>({
     mapId,name:'Mapa '+mapId,
     hiddenItems:{collected:0},hiddenCoins:{collected:0},
     trainers:{gatesClosed:0,scriptedVictories:0,battlesPlayed:0},
     stationaryPokemon:{gatesClosed:0}
   }))};
}
const clone=x=>JSON.parse(JSON.stringify(x));
const sample=(session,ledger)=>session.ingest({ledger,romIdentityMatched:true,
   mapWindowVerified:true,observedAt:'2026-10-29T00:00:00Z'});
test('first live reading is only a baseline, never a fake item event',()=>{
 const s=new CampaignFlagSession(),l=makeLedger();
 l.mapProgress[15].hiddenItems.collected=7;
 const r=sample(s,l);
 assert.equal(r.delta.verified,false);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
 assert.equal(r.recent.baselineEstablished,true);
});
test('second verified reading records only observed positive deltas',()=>{
 const s=new CampaignFlagSession(),first=makeLedger();
 sample(s,first);
 const next=clone(first);next.mapProgress[15].hiddenItems.collected=1;
 const r=sample(s,next);
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changes.length,1);
 assert.equal(r.recent.events.length,1);
 assert.equal(r.recent.events[0].kind,'HIDDEN_ITEM_FLAG_RAISED');
 assert.equal(r.recent.actionsProven,false);
});
test('disconnection resets both baseline and history, even for identical ROM',()=>{
 const s=new CampaignFlagSession(),first=makeLedger();
 sample(s,first);
 const next=clone(first);next.mapProgress[15].hiddenItems.collected=1;
 sample(s,next);
 const bad=s.ingest({ledger:null,romIdentityMatched:false,mapWindowVerified:false});
 assert.equal(bad.recent.verified,false);
 assert.equal(bad.recent.events.length,0);
 const after=clone(next);after.mapProgress[15].hiddenItems.collected=2;
 const r=sample(s,after);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
});
test('ROM swap resets progress deltas without reusing earlier save',()=>{
 const s=new CampaignFlagSession();
 sample(s,makeLedger());
 const changed=makeLedger(blue);changed.mapProgress[15].hiddenItems.collected=3;
 const r=sample(s,changed);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
 assert.equal(r.recent.romSha256,blue);
});
test('a decreasing flag count clears history and restarts baseline',()=>{
 const s=new CampaignFlagSession();
 const first=makeLedger();sample(s,first);
 const second=clone(first);second.mapProgress[15].hiddenItems.collected=2;
 sample(s,second);
 const reset=sample(s,first);
 assert.equal(reset.delta.verified,false);
 assert.equal(reset.delta.resetSuspected,true);
 assert.equal(reset.recent.events.length,0);
 assert.equal(sample(s,second).recent.events.length,1);
});
test('session timeline is bounded to 80 entries',()=>{
 const s=new CampaignFlagSession();
 let prev=makeLedger();sample(s,prev);
 for(let i=1;i<=100;i++){
   const curr=clone(prev);curr.mapProgress[i].hiddenItems.collected++;
   sample(s,curr);prev=curr;
 }
 assert.equal(s.events.length,80);
 assert.equal(s.events[0].mapId,21);
});
test('unverified map reads never advance baseline',()=>{
 const s=new CampaignFlagSession(),first=makeLedger();
 sample(s,first);
 const unverified=clone(first);unverified.mapProgress[15].hiddenItems.collected=1;
 s.ingest({ledger:unverified,romIdentityMatched:true,mapWindowVerified:false});
 const later=clone(unverified);later.mapProgress[15].hiddenItems.collected=2;
 const r=sample(s,later);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
});
test('returned evidence is a copy, not an editable internal timeline reference',()=>{
 const s=new CampaignFlagSession(),first=makeLedger();sample(s,first);
 const next=clone(first);next.mapProgress[1].hiddenCoins.collected=1;
 const r=sample(s,next);r.recent.events[0].amount=100;
 assert.equal(s.events[0].amount,1);
});
