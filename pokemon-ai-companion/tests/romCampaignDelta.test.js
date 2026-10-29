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

function withExactRecords(l){
 for(const m of l.mapProgress){
   m.flagRecords={hiddenItems:[],hiddenCoins:[],trainers:[],stationaryPokemon:[]};
 }
 return l;
}
test('exact hidden bits disclose which map coordinate changed, not merely total',()=>{
 const previous=withExactRecords(ledger());
 const item0={recordId:'hidden-item-0',bitIndex:0,flagSet:false,x:3,y:6};
 const item1={recordId:'hidden-item-1',bitIndex:1,flagSet:false,x:7,y:8};
 previous.mapProgress[15].flagRecords.hiddenItems=[item0,item1];
 const current=copy(previous);
 current.mapProgress[15].flagRecords.hiddenItems[1].flagSet=true;
 current.mapProgress[15].hiddenItems.collected=1;
 const d=diffCampaignProgress({previous,current});
 assert.equal(d.verified,true);
 assert.equal(d.granularity,'EXACT_ROM_EVENT_BIT');
 assert.equal(d.changes.length,1);
 assert.equal(d.changes[0].recordId,'hidden-item-1');
 assert.equal(d.changes[0].x,7);
 assert.equal(d.changes[0].y,8);
});
test('same overall total with a reset bit aborts instead of hiding a save reload',()=>{
 const previous=withExactRecords(ledger());
 previous.mapProgress[15].flagRecords.hiddenItems=[
   {recordId:'hidden-item-0',bitIndex:0,flagSet:true,x:3,y:6},
   {recordId:'hidden-item-1',bitIndex:1,flagSet:false,x:7,y:8}];
 previous.mapProgress[15].hiddenItems.collected=1;
 const current=copy(previous);
 current.mapProgress[15].flagRecords.hiddenItems[0].flagSet=false;
 current.mapProgress[15].flagRecords.hiddenItems[1].flagSet=true;
 // Count stays 1, but two individual flags changed in opposite directions.
 const d=diffCampaignProgress({previous,current});
 assert.equal(d.verified,false);
 assert.equal(d.resetSuspected,true);
 assert.equal(d.changes.length,0);
});
test('special script-victory event is distinct from ordinary trainer gate',()=>{
 const previous=withExactRecords(ledger());
 previous.mapProgress[3].flagRecords.trainers=[
   {recordId:'trainer-1',bitIndex:100,flagSet:false,outcomeEvidence:null},
   {recordId:'trainer-2',bitIndex:152,flagSet:false,outcomeEvidence:'SCRIPT_VICTORY'}];
 const current=copy(previous);
 current.mapProgress[3].flagRecords.trainers[0].flagSet=true;
 current.mapProgress[3].flagRecords.trainers[1].flagSet=true;
 current.mapProgress[3].trainers.gatesClosed=2;
 current.mapProgress[3].trainers.scriptedVictories=1;
 const d=diffCampaignProgress({previous,current});
 assert.equal(d.verified,true);
 assert.deepEqual(d.changes.map(x=>x.kind),[
   'TRAINER_GATE_FLAG_RAISED','SCRIPT_VICTORY_FLAG_RAISED']);
});
test('partially populated bit records reject summary instead of falling back',()=>{
 const previous=withExactRecords(ledger()),current=copy(previous);
 delete current.mapProgress[15].flagRecords;
 const d=diffCampaignProgress({previous,current});
 assert.equal(d.verified,false);
 assert.equal(d.changes.length,0);
});

test('contradictory bit totals fail closed instead of displaying inconsistent progress',()=>{
 const prev=withExactRecords(ledger());
 const now=copy(prev);
 prev.mapProgress[15].flagRecords.hiddenItems=[
   {recordId:'hidden-item-0',bitIndex:0,flagSet:false,x:3,y:6}];
 now.mapProgress[15].flagRecords.hiddenItems=[
   {recordId:'hidden-item-0',bitIndex:0,flagSet:true,x:3,y:6}];
 now.mapProgress[15].hiddenItems.collected=2; // One bit changed, not two.
 const result=diffCampaignProgress({previous:prev,current:now});
 assert.equal(result.verified,false);
 assert.match(result.reason,/diverge dos bits/);
});
test('a trainer gate bit cannot masquerade as two script victories',()=>{
 const before=withExactRecords(ledger());
 before.mapProgress[3].flagRecords.trainers=[
   {recordId:'trainer-1',bitIndex:152,flagSet:false,
     outcomeEvidence:'SCRIPT_VICTORY'}];
 const after=copy(before);
 after.mapProgress[3].flagRecords.trainers[0].flagSet=true;
 after.mapProgress[3].trainers.gatesClosed=1;
 after.mapProgress[3].trainers.scriptedVictories=2;
 const result=diffCampaignProgress({previous:before,current:after});
 assert.equal(result.verified,false);
 assert.match(result.reason,/scriptedVictories/);
});
