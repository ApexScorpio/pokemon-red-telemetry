'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ScriptedBattleStateSession}=require('../romScriptedBattleStateSession');
const RED='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const BLUE='2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d';
const labels={
 96:['SCRIPT_SSANNE2F_DEFAULT','SCRIPT_SSANNE2F_RIVAL_START_BATTLE',
 'SCRIPT_SSANNE2F_RIVAL_AFTER_BATTLE','SCRIPT_SSANNE2F_RIVAL_EXIT',
 'SCRIPT_SSANNE2F_NOOP'],
 135:['SCRIPT_GAMECORNER_DEFAULT','SCRIPT_GAMECORNER_ROCKET_BATTLE',
 'SCRIPT_GAMECORNER_ROCKET_EXIT']
};
const good=(mapId=96,scriptValue=1)=>({
 verified:true,status:'SCRIPT_BYTE_REPEATED_REFERENCE_ONLY',
 mapId,scriptValue,referenceStateName:labels[mapId][scriptValue]??null,
 readOnly:true,readOnlyRequests:2,readOnlyReadCalls:2,
 snapshotAtomicVerified:false,gameProgressCertified:false,battleWon:null,
 source:'TWO_MATCHING_READ_ONLY_RAM_SAMPLES_FROM_MATCHED_ROM_AND_MAP'
});
const ingest=(s,seq,value=1,mapId=96,opts={})=>s.ingest({
 sample:good(mapId,value),romSha256:RED,mapId,
 targetHost:'127.0.0.1',targetPort:55355,
 publicationGuardVerified:true,pollSequence:seq,
 observedAt:new Date(Date.UTC(2026,9,31,19,0,seq)).toISOString(),...opts
});
test('first valid sample establishes baseline without invented transition',()=>{
 const s=new ScriptedBattleStateSession();
 const r=ingest(s,1,1);
 assert.equal(r.delta.verified,false);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.baselineEstablished,true);
 assert.equal(r.recent.events.length,0);
 assert.equal(r.recent.battleWon,null);
 assert.equal(Object.hasOwn(r.recent,'targetHost'),false);
});
test('two consecutive validated values produce a noncausal RAM transition',()=>{
 const s=new ScriptedBattleStateSession();
 ingest(s,1,1);
 const r=ingest(s,2,2);
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changedBytes,1);
 assert.equal(r.delta.changes[0].fromScriptByte,1);
 assert.equal(r.delta.changes[0].toScriptByte,2);
 assert.equal(r.delta.changes[0].toReferenceState,'SCRIPT_SSANNE2F_RIVAL_AFTER_BATTLE');
 assert.equal(r.delta.changes[0].playerActionConfirmed,false);
 assert.equal(r.delta.changes[0].battleWon,null);
 assert.equal(r.delta.changes[0].controlFlowVerified,false);
 assert.equal(r.recent.events.length,1);
 assert.equal(r.recent.currentScriptByte,2);
});
test('same value does not repeat events',()=>{
 const s=new ScriptedBattleStateSession();
 ingest(s,1,1);ingest(s,2,2);
 const r=ingest(s,3,2);
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changedBytes,0);
 assert.equal(r.recent.events.length,1);
});
test('skipped polls force new baseline instead of fabricated transition',()=>{
 const s=new ScriptedBattleStateSession();ingest(s,1,1);
 const r=ingest(s,3,4);
 assert.equal(r.delta.verified,false);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
 assert.equal(r.recent.currentScriptByte,4);
});
test('ROM, map and UDP target change each reset evidence',()=>{
 for(const changes of [{romSha256:BLUE},{mapId:135,sample:good(135,2)},
  {targetHost:'127.0.0.2'},{targetPort:55356}]){
  const s=new ScriptedBattleStateSession();ingest(s,1,1);
  const r=ingest(s,2,2,96,changes);
  assert.equal(r.delta.verified,false,JSON.stringify(changes));
  assert.equal(r.delta.baselineRequired,true);
  assert.equal(r.recent.events.length,0);
 }
});
test('failed or unproven publication resets all prior transitions',()=>{
 const s=new ScriptedBattleStateSession();
 ingest(s,1,1);ingest(s,2,2);
 const x=ingest(s,3,4,96,{publicationGuardVerified:false});
 assert.equal(x.recent.verified,false);
 assert.equal(x.recent.events.length,0);
 assert.equal(x.recent.currentScriptByte,null);
 const y=ingest(s,4,1);
 assert.equal(y.delta.baselineRequired,true);
});
test('forged victory, wrong source or inferred state name is rejected',()=>{
 for(const mutation of [
  s=>{s.battleWon=true;},
  s=>{s.gameProgressCertified=true;},
  s=>{s.referenceStateName='VICTORY';},
  s=>{s.readOnlyRequests=4;},
  s=>{s.snapshotAtomicVerified=true;}
 ]){
  const session=new ScriptedBattleStateSession(),sample=good();
  mutation(sample);
  const r=ingest(session,1,1,96,{sample});
  assert.equal(r.delta.verified,false);
  assert.equal(r.recent.events.length,0);
 }
});
test('transitions for Game Corner remain reference only, even state exit',()=>{
 const s=new ScriptedBattleStateSession();
 ingest(s,1,1,135);
 const r=ingest(s,2,2,135);
 assert.equal(r.delta.changedBytes,1);
 assert.equal(r.delta.changes[0].toReferenceState,'SCRIPT_GAMECORNER_ROCKET_EXIT');
 assert.equal(r.delta.changes[0].battleWon,null);
 assert.equal(r.delta.changes[0].wasCausedByPlayer,null);
});
test('old/repeated timestamp resets continuity instead of false transition',()=>{
 const s=new ScriptedBattleStateSession();
 ingest(s,1,1);const prev='2026-10-31T19:00:01.000Z';
 const r=ingest(s,2,2,96,{observedAt:prev});
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
});
test('history stays bounded, snapshots are copied and do not leak target address',()=>{
 const s=new ScriptedBattleStateSession();
 ingest(s,1,0);
 let r;
 for(let n=2;n<=50;n++)r=ingest(s,n,n%2);
 assert.equal(r.recent.events.length,40);
 assert.equal(r.recent.events.at(-1).toScriptByte,0);
 r.recent.events[0].toScriptByte=255;
 assert.notEqual(s.status(true).events[0].toScriptByte,255);
 assert.equal(JSON.stringify(r.recent).includes('127.0.0.1'),false);
});
