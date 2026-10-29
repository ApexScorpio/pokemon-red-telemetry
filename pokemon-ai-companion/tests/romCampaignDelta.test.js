'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {diffCampaignProgress}=require('../romCampaignDelta');
// Known audited RED SHA; do not substitute a sample or guess from headers.
const known='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function ledger(){
 return {verified:true,romSha256:known,mapCount:226,
   mapProgress:Array.from({length:226},(_,mapId)=>({
     mapId,name:'Mapa '+mapId,
     hiddenItems:{collected:0},hiddenCoins:{collected:0},
     trainers:{gatesClosed:0,scriptedVictories:0,battlesPlayed:0},
     stationaryPokemon:{gatesClosed:0}
   }))};
}
function copy(x){return JSON.parse(JSON.stringify(x));}
test('a newly set hidden flag is an observed change, not a proven player action',()=>{
 const previous=ledger(),current=copy(previous);
 current.mapProgress[15].hiddenItems.collected=1;
 const d=diffCampaignProgress({previous,current,observedAt:'2026-10-29T00:00:00Z'});
 assert.equal(d.verified,true);
 assert.equal(d.changes.length,1);
 assert.equal(d.changes[0].mapId,15);
 assert.equal(d.changes[0].kind,'HIDDEN_ITEM_FLAG_RAISED');
 assert.equal(d.changes[0].playerActionConfirmed,false);
 assert.equal(d.snapshotAtomicVerified,false);
 assert.equal(d.totalChangedFlags,1);
});
test('trainer gate, scripted victory and Pokémon gate are independently named',()=>{
 const previous=ledger(),current=copy(previous);
 current.mapProgress[20].trainers.gatesClosed=1;
 current.mapProgress[20].trainers.scriptedVictories=1;
 current.mapProgress[20].stationaryPokemon.gatesClosed=1;
 const d=diffCampaignProgress({previous,current});
 assert.deepEqual(new Set(d.changes.map(x=>x.kind)),
   new Set(['TRAINER_GATE_FLAG_RAISED','SCRIPT_VICTORY_FLAG_RAISED',
     'STATIONARY_GATE_FLAG_RAISED']));
 assert.equal(d.playerActionConfirmed,false);
});
test('flags decreasing reject the whole delta as a possible save reload',()=>{
 const current=ledger(),previous=copy(current);
 previous.mapProgress[15].hiddenCoins.collected=3;
 current.mapProgress[18].hiddenItems.collected=1;
 const d=diffCampaignProgress({previous,current});
 assert.equal(d.verified,false);
 assert.equal(d.resetSuspected,true);
 assert.equal(d.changes.length,0);
});
test('first read or mismatched ROM never reuses old flags',()=>{
 const current=ledger();
 assert.equal(diffCampaignProgress({current}).baselineRequired,true);
 const previous=ledger();previous.romSha256='0'.repeat(64);
 assert.equal(diffCampaignProgress({previous,current}).verified,false);
});
test('duplicate map IDs and malformed counters reject the delta',()=>{
 const old=ledger(),current=ledger();
 current.mapProgress[2].mapId=1;
 assert.equal(diffCampaignProgress({previous:old,current}).verified,false);
 const x=ledger();x.mapProgress[2].trainers.gatesClosed=-1;
 assert.equal(diffCampaignProgress({previous:old,current:x}).verified,false);
});
test('unchanged snapshots produce zero events, not false completions',()=>{
 const previous=ledger(),current=copy(previous);
 const d=diffCampaignProgress({previous,current});
 assert.equal(d.verified,true);
 assert.equal(d.changes.length,0);
 assert.equal(d.actionObserved,false);
});
