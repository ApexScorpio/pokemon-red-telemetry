'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {WorldReferenceFlagSession,MAX_PUBLISHED_CHANGES}=require('../romWorldReferenceSession');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const sha=AUDITED_ROM_SHA256.RED;
const atlas=()=>({
 verified:true,romSha256:sha,
 summary:{namedEventBits:507,referenceToggleBits:228},
 events:Array.from({length:507},(_,i)=>({
  name:'TEST_EVENT_'+i,eventBitIndex:i,flagSet:false
 })),
 toggleFlags:Array.from({length:228},(_,i)=>({
  name:'TEST_TOGGLE_'+i,mapId:i%200,toggleIndex:i,removedFlagSet:false
 }))
});
const copy=x=>JSON.parse(JSON.stringify(x));
const publish=(session,a,pollSequence,extra={})=>
 session.ingestPublished({
  atlas:a,observedAt:'2026-10-31T22:11:00Z',
  romIdentityMatched:true,positionVerified:true,
  publicationGuardVerified:true,targetHost:'192.0.2.20',
  targetPort:55355,targetGeneration:0,pollSequence,...extra
 });
function changed(a,named,toggles){
 const b=copy(a);
 for(let i=0;i<named;i++)b.events[i].flagSet=!b.events[i].flagSet;
 for(let i=0;i<toggles;i++)
  b.toggleFlags[i].removedFlagSet=!b.toggleFlags[i].removedFlagSet;
 return b;
}
test('threshold matches existing whole-bitmap conservative limit',()=>{
 assert.equal(MAX_PUBLISHED_CHANGES,64);
});
test('65 named event transitions are suppressed as possible save load',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const r=publish(s,changed(a,65,0),2);
 assert.equal(r.delta.verified,false);
 assert.equal(r.delta.changedBits,65);
 assert.equal(r.delta.resetSuspected,true);
 assert.equal(r.delta.comparisonSuppressed,true);
 assert.deepEqual(r.delta.changes,[]);
 assert.equal(r.recent.events.length,0);
 assert.equal(r.recent.baselineEstablished,true);
});
test('65 object toggle transitions do not claim 65 pickups',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const r=publish(s,changed(a,0,65),2);
 assert.equal(r.delta.resetSuspected,true);
 assert.equal(r.recent.events.length,0);
 assert.equal(r.delta.playerActionConfirmed,false);
});
test('mixed 33 named and 32 object toggles are counted together',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const r=publish(s,changed(a,33,32),2);
 assert.equal(r.delta.changedBits,65);
 assert.equal(r.delta.comparisonSuppressed,true);
});
test('exactly 64 named bits remain visible as non-causal RAM deltas',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const r=publish(s,changed(a,64,0),2);
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changedBits,64);
 assert.equal(r.recent.events.length,64);
 assert.equal(r.delta.actionConfirmed,false);
});
test('exactly 64 toggle bits remain non-causal, never items collected',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const r=publish(s,changed(a,0,64),2);
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changedBits,64);
 assert.equal(r.delta.changes[0].itemCollectedConfirmed,false);
});
test('mixed 32 plus 32 at boundary is retained without completion claims',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const r=publish(s,changed(a,32,32),2);
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changedBits,64);
 assert.equal(r.delta.scriptEffectsComplete,false);
});
test('large jump clears previously recorded small changes',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const b=changed(a,1,0);publish(s,b,2);
 assert.equal(s.events.length,1);
 const r=publish(s,changed(b,65,0),3);
 assert.equal(r.delta.resetSuspected,true);
 assert.equal(s.events.length,0);
 assert.equal(r.recent.events.length,0);
});
test('next consecutive small delta after large jump uses fresh baseline',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const big=changed(a,65,0);publish(s,big,2);
 const next=copy(big);next.events[100].flagSet=true;
 const r=publish(s,next,3);
 assert.equal(r.delta.verified,true);
 assert.deepEqual(r.delta.changes.map(e=>e.eventBitIndex),[100]);
 assert.equal(r.recent.events.length,1);
});
test('same bulk baseline in next poll does not repeat suspected change',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const big=changed(a,65,0);publish(s,big,2);
 const r=publish(s,copy(big),3);
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changedBits,0);
 assert.equal(r.recent.events.length,0);
});
test('failed publication guard still resets instead of treating data as bulk',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const r=publish(s,changed(a,65,0),2,{publicationGuardVerified:false});
 assert.equal(r.delta.verified,false);
 assert.equal(r.delta.resetSuspected,undefined);
 assert.equal(r.recent.verified,false);
});
test('legacy ingest API is unchanged; new suppression only guards live publication',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();
 s.ingest({atlas:a});
 const r=s.ingest({atlas:changed(a,65,0)});
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changedBits,65);
 assert.equal(r.delta.playerActionConfirmed,undefined);
 assert.equal(r.delta.actionConfirmed,false);
});
