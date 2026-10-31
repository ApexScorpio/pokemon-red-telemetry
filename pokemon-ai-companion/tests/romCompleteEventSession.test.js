'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CompleteEventBitSession,compareCompleteEventBitmaps,inspectBitmap}
 =require('../romCompleteEventSession');
const pinned=require('../data/gen1EventNamesPret.json').eventNamesByBit;
const RED='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const BLUE='2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d';
function bitmap(romSha256=RED,active=[]){
 const bits=Array.from({length:2560},(_,bitIndex)=>({
  bitIndex,flagSet:active.includes(bitIndex),
  referenceName:pinned[bitIndex]||null,candidateMapIds:[],
  semanticMeaningVerified:false,completed:null,availableNow:null
 }));
 const setBits=active.length;
 return {verified:true,romSha256,allBitPositionsIndexed:true,
  gameplaySemanticsCertified:false,gameplayCompletionCertified:false,
  summary:{bitPositionsIndexed:2560,ramBytesCorroborated:320,
   namedReferenceBits:507,unnamedOrReservedBits:2053,
   setBits,clearBits:2560-setBits},
  bits};
}
const ingest=(session,bitmapArg)=>session.ingest({bitmap:bitmapArg,
 publicationGuardVerified:true,observedMapId:15,
 observedAt:'2026-10-31T03:20:00Z'});
test('baseline cannot invent a recent bit transition',()=>{
 const session=new CompleteEventBitSession(),a=bitmap();
 const r=ingest(session,a);
 assert.equal(r.delta.verified,false);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.verified,true);
 assert.equal(r.recent.baselineEstablished,true);
 assert.equal(r.recent.events.length,0);
});
test('named and unnamed flips detected without fabricated event meaning',()=>{
 const session=new CompleteEventBitSession();
 ingest(session,bitmap());
 const next=bitmap(RED,[192,2559]);
 next.bits[192].candidateMapIds=[12,61];
 const r=ingest(session,next);
 assert.equal(r.delta.verified,true);
 assert.deepEqual(r.delta.changes.map(x=>x.bitIndex),[192,2559]);
 assert.equal(r.delta.changes[0].referenceName,'EVENT_GOT_BICYCLE');
 assert.equal(r.delta.changes[1].referenceName,null);
 assert.equal(r.delta.changes[0].observedPlayerMapId,15);
 assert.equal(r.delta.changes[0].observedPlayerMapIsEventOrigin,false);
 assert.equal(r.delta.changes[0].playerActionConfirmed,false);
 assert.equal(r.delta.changes[0].eventCompleted,null);
 assert.equal(r.delta.changedBits,2);
 assert.equal(r.recent.events.length,2);
});
test('cleared bits are tracked, not interpreted as a reset or reward',()=>{
 const s=new CompleteEventBitSession();
 ingest(s,bitmap(RED,[192,2559]));
 const r=ingest(s,bitmap(RED,[192]));
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changes[0].bitIndex,2559);
 assert.equal(r.delta.changes[0].flagSet,false);
 assert.equal(r.delta.changes[0].eventCompleted,null);
});
test('single invalid poll clears history, requires a fresh baseline',()=>{
 const s=new CompleteEventBitSession();
 ingest(s,bitmap());
 ingest(s,bitmap(RED,[192]));
 const bad=s.ingest({bitmap:bitmap(RED,[192,2559]),
  publicationGuardVerified:false,observedMapId:15});
 assert.equal(bad.recent.verified,false);
 assert.equal(bad.recent.events.length,0);
 assert.equal(ingest(s,bitmap(RED,[192,2559])).delta.baselineRequired,true);
});
test('new ROM never compares with the old game snapshot',()=>{
 const s=new CompleteEventBitSession();
 ingest(s,bitmap(RED,[192]));
 const result=ingest(s,bitmap(BLUE,[2559]));
 assert.equal(result.delta.baselineRequired,true);
 assert.equal(result.recent.romSha256,BLUE);
 assert.equal(result.recent.events.length,0);
});
test('save/load-size bit jump clears timeline rather than claiming actions',()=>{
 const s=new CompleteEventBitSession();
 ingest(s,bitmap());
 ingest(s,bitmap(RED,[192]));
 const large=bitmap(RED,Array.from({length:65},(_,i)=>i+700));
 const result=ingest(s,large);
 assert.equal(result.delta.verified,false);
 assert.equal(result.delta.resetSuspected,true);
 assert.equal(result.recent.verified,true);
 assert.equal(result.recent.events.length,0);
 assert.equal(ingest(s,large).delta.changedBits,0);
});
test('malformed bit index or wrong pinned label is rejected',()=>{
 for(const change of [
  x=>{x.bits[0].bitIndex=1;},
  x=>{x.bits[192].referenceName='EVENT_FAKE';},
  x=>{x.bits[5].completed=true;},
  x=>{x.bits[5].availableNow=true;},
  x=>{x.bits[2559].flagSet='yes';},
  x=>{x.bits[2559].candidateMapIds=[248];},
  x=>{x.summary.setBits=5;},
  x=>{x.bits.pop();}
 ]){
  const b=bitmap();change(b);
  assert.equal(inspectBitmap(b),null);
 }
});
test('returned history does not mutate the internal session history',()=>{
 const s=new CompleteEventBitSession();
 ingest(s,bitmap());
 const b=bitmap(RED,[192]);
 b.bits[192].candidateMapIds=[61];
 const r=ingest(s,b);
 r.recent.events[0].candidateMapIds.push(5);
 r.recent.events[0].referenceName='FAKE';
 assert.equal(s.history[0].referenceName,'EVENT_GOT_BICYCLE');
 assert.deepEqual(s.history[0].candidateMapIds,[61]);
});
test('runtime ingestion must occur after the final D35E read',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const client=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const check=client.indexOf('const publicationPositionWindow=verifyMapPositionWindow({');
 const ingestAt=client.indexOf('this._completeEventBitSession.ingest({');
 const persistAt=client.lastIndexOf('this.persistState(this.latestState);');
 assert.ok(check>0&&ingestAt>check&&persistAt>ingestAt);
 assert.match(client.slice(ingestAt,persistAt),/publicationGuardVerified:true/);
 assert.match(client,/this._completeEventBitSession.reset\(reason\)/);
 assert.match(client,/worldRecentCompleteEventChanges/);
});
