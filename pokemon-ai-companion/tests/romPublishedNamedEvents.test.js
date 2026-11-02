'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {WorldReferenceFlagSession}=require('../romWorldReferenceSession');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const RED=AUDITED_ROM_SHA256.RED,BLUE=AUDITED_ROM_SHA256.BLUE;
const atlas=(sha=RED)=>({
 verified:true,romSha256:sha,
 summary:{namedEventBits:507,referenceToggleBits:228},
 events:Array.from({length:507},(_,i)=>({
  name:'EVENT_'+i,eventBitIndex:i,flagSet:false
 })),
 toggleFlags:Array.from({length:228},(_,i)=>({
  name:'TOGGLE_'+i,mapId:i%200,toggleIndex:i,removedFlagSet:false
 }))
});
const clone=v=>JSON.parse(JSON.stringify(v));
const publish=(session,a,seq,opts={})=>
 session.ingestPublished({
  atlas:a,observedAt:'2026-10-31T22:00:00Z',
  romIdentityMatched:true,positionVerified:true,
  publicationGuardVerified:true,targetHost:'192.0.2.20',
  targetPort:55355,targetGeneration:0,pollSequence:seq,...opts
 });
test('first published sample is baseline, not event transition',()=>{
 const s=new WorldReferenceFlagSession(),r=publish(s,atlas(),1);
 assert.equal(r.delta.verified,false);assert.equal(r.recent.baselineEstablished,true);
 assert.equal(r.recent.events.length,0);
});
test('two consecutive published samples expose named bit delta without claiming action',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const b=clone(a);b.events[36].flagSet=true;
 const r=publish(s,b,2);assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changes.length,1);
 assert.equal(r.delta.changes[0].eventBitIndex,36);
 assert.equal(r.delta.changes[0].playerActionConfirmed,false);
});
test('toggle bit change remains distinct from item collection',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const b=clone(a);b.toggleFlags[20].removedFlagSet=true;
 const r=publish(s,b,2);assert.equal(r.delta.changes[0].kind,'OBJECT_TOGGLE_BIT_CHANGED');
 assert.equal(r.delta.changes[0].itemCollectedConfirmed,false);
});
test('missing publication guard invalidates history and baseline',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const b=clone(a);b.events[50].flagSet=true;
 const bad=publish(s,b,2,{publicationGuardVerified:false});
 assert.equal(bad.delta.verified,false);assert.equal(bad.recent.verified,false);
 assert.equal(publish(s,b,3).delta.verified,false);
});
test('failed player position proof blocks any named event comparison',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const b=clone(a);b.events[10].flagSet=true;
 assert.equal(publish(s,b,2,{positionVerified:false}).delta.verified,false);
});
test('missing current ROM identity rejects even valid named event rows',()=>{
 const s=new WorldReferenceFlagSession();
 assert.equal(publish(s,atlas(),1,{romIdentityMatched:false}).recent.verified,false);
});
test('nonconsecutive polling starts baseline instead of fabricating event',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const b=clone(a);b.events[25].flagSet=true;
 const r=publish(s,b,3);assert.equal(r.delta.verified,false);
 assert.equal(r.recent.events.length,0);
 assert.equal(r.recent.baselineEstablished,true);
});
test('ROM change does not borrow previous named flag history',()=>{
 const s=new WorldReferenceFlagSession();publish(s,atlas(),1);
 const b=atlas(BLUE);b.events[17].flagSet=true;
 assert.equal(publish(s,b,2).delta.verified,false);
});
test('host or port change prevents cross-emulator attribution',()=>{
 for(const opts of [{targetHost:'192.0.2.21'},{targetPort:55356}]){
  const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
  const b=clone(a);b.events[3].flagSet=true;
  assert.equal(publish(s,b,2,opts).delta.verified,false);
 }
});
test('target generation change blocks switch-away-and-back stale baseline',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const b=clone(a);b.events[3].flagSet=true;
 const r=publish(s,b,2,{targetGeneration:2});
 assert.equal(r.delta.verified,false);assert.equal(r.recent.events.length,0);
});
test('invalid atlas or poll sequence resets rather than reporting changes',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();publish(s,a,1);
 const b=clone(a);b.events[3].flagSet=true;
 const bad=publish(s,b,0);
 assert.equal(bad.recent.verified,false);
 assert.equal(publish(s,b,2).delta.verified,false);
});
test('live named-event ingest occurs after final publication refusal gate',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const guard=src.indexOf('const targetScopeStable=matchesTargetScope(this,pollTargetScope)');
 const named=src.indexOf('const namedChanges=this._worldReferenceSession.ingestPublished({');
 const persistence=src.lastIndexOf('this.persistState(this.latestState);');
 assert.ok(guard>0&&named>guard&&persistence>named);
 assert.equal(src.includes('this._worldReferenceSession.ingest({'),false);
 const slice=src.slice(guard,named);
 assert.match(slice,/TARGET_SWITCH_DURING_POLL_REJECT_PUBLICATION/);
 assert.match(slice,/this\.invalidateWorldEvidence\(why\)/);
 assert.match(slice,/\n      return;/);
 assert.match(src.slice(named,named+850),/publicationGuardVerified:matchesTargetScope/);
 assert.match(src.slice(named,named+850),/pollSequence:this\._scriptedBattlePollSequence/);
});
