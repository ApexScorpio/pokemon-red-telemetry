'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {CampaignFlagSession}=require('../romCampaignSession');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const RED=AUDITED_ROM_SHA256.RED,BLUE=AUDITED_ROM_SHA256.BLUE;
function ledger(sha=RED,amount=0){
 return {verified:true,romSha256:sha,mapCount:226,
  mapProgress:Array.from({length:226},(_,mapId)=>({
   mapId,name:'Mapa '+mapId,
   hiddenItems:{collected:mapId===15?amount:0},
   hiddenCoins:{collected:0},
   trainers:{gatesClosed:0,scriptedVictories:0,battlesPlayed:0},
   stationaryPokemon:{gatesClosed:0}
  }))};
}
const publish=(session,entry,pollSequence,opts={})=>
 session.ingestPublished({
  ledger:entry,observedAt:'2026-10-31T22:20:00Z',
  romIdentityMatched:true,mapWindowVerified:true,
  publicationGuardVerified:true,targetHost:'192.0.2.20',
  targetPort:55355,targetGeneration:0,pollSequence,...opts
 });
test('first published campaign reading is a baseline not completed action',()=>{
 const s=new CampaignFlagSession(),r=publish(s,ledger(RED,3),1);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.baselineEstablished,true);
 assert.equal(r.recent.events.length,0);
});
test('consecutive flags produce changes but cannot prove user action',()=>{
 const s=new CampaignFlagSession();publish(s,ledger(),1);
 const r=publish(s,ledger(RED,1),2);
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changes[0].kind,'HIDDEN_ITEM_FLAG_RAISED');
 assert.equal(r.delta.playerActionConfirmed,false);
 assert.equal(r.recent.actionsProven,false);
});
test('missed poll makes next campaign snapshot a new baseline',()=>{
 const s=new CampaignFlagSession();publish(s,ledger(),1);
 const r=publish(s,ledger(RED,1),3);
 assert.equal(r.delta.verified,false);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
});
test('different emulator host cannot inherit world campaign history',()=>{
 const s=new CampaignFlagSession();publish(s,ledger(),1);
 const r=publish(s,ledger(RED,1),2,{targetHost:'192.0.2.21'});
 assert.equal(r.delta.baselineRequired,true);
});
test('different emulator port starts fresh campaign baseline',()=>{
 const s=new CampaignFlagSession();publish(s,ledger(),1);
 const r=publish(s,ledger(RED,1),2,{targetPort:55356});
 assert.equal(r.delta.baselineRequired,true);
});
test('generation invalidates swap away and return to same address',()=>{
 const s=new CampaignFlagSession();publish(s,ledger(),1);
 const r=publish(s,ledger(RED,1),2,{targetGeneration:2});
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
});
test('ROM Red to Blue refuses old campaign counts',()=>{
 const s=new CampaignFlagSession();publish(s,ledger(),1);
 const r=publish(s,ledger(BLUE,4),2);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.romSha256,BLUE);
});
test('final position refusal removes previous campaign history',()=>{
 const s=new CampaignFlagSession();publish(s,ledger(),1);
 publish(s,ledger(RED,1),2);
 const r=publish(s,ledger(RED,2),3,{mapWindowVerified:false});
 assert.equal(r.delta.verified,false);
 assert.equal(r.recent.verified,false);
 assert.equal(r.recent.events.length,0);
});
test('target publication refusal also clears campaign baseline',()=>{
 const s=new CampaignFlagSession();publish(s,ledger(),1);
 const r=publish(s,ledger(RED,2),2,{publicationGuardVerified:false});
 assert.equal(r.delta.verified,false);
 assert.equal(r.recent.events.length,0);
 assert.equal(publish(s,ledger(RED,2),3).delta.baselineRequired,true);
});
test('poll sequence zero and missing identity cannot be published',()=>{
 for(const option of [{pollSequence:0},{romIdentityMatched:false}]){
  const s=new CampaignFlagSession();publish(s,ledger(),1);
  const r=publish(s,ledger(RED,1),2,option);
  assert.equal(r.delta.verified,false);
  assert.equal(r.recent.verified,false);
 }
});
test('legacy unguarded baseline does not become a published campaign transition',()=>{
 const s=new CampaignFlagSession();
 s.ingest({ledger:ledger(),romIdentityMatched:true,mapWindowVerified:true});
 const r=publish(s,ledger(RED,1),2);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
});
test('runtime integrates campaign only after final map and target check',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const final=src.indexOf('const targetScopeStable=matchesTargetScope(this,pollTargetScope)');
 const campaign=src.indexOf('const campaignSession=this._worldCampaignSession.ingestPublished({');
 const named=src.indexOf('const namedChanges=this._worldReferenceSession.ingestPublished({');
 const persist=src.lastIndexOf('this.persistState(this.latestState);');
 assert.ok(final>0&&campaign>final&&named>campaign&&persist>named);
 assert.equal(src.includes('this._worldCampaignSession.ingest({'),false);
 const checks=src.slice(campaign,named);
 assert.match(checks,/publicationGuardVerified:matchesTargetScope\(this,pollTargetScope\)/);
 assert.match(checks,/targetGeneration:pollTargetScope\.generation/);
 assert.match(checks,/pollSequence:this\._scriptedBattlePollSequence/);
});
