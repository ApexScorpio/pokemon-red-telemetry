'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {RomActorMotionSession}=require('../romActorMotionSession');
const {buildRomAreaEvidence}=require('../romAreaEvidence');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const SHA=AUDITED_ROM_SHA256.RED;
const BLUE=AUDITED_ROM_SHA256.BLUE;
const obj=(kind='trainer',movement=0xfe)=>({
 kind,x:7,y:8,spriteId:23,movement,
 trainerClassOrItemId:kind==='trainer'?212:null,
 trainerNumberOrLevel:1
});
const ram=(x=8,y=8)=>({spriteIndex:1,pictureId:23,x,y,
 isItem:false,isTrainer:false,type:'npc'});
const prepare=(seq,x=8,options={})=>{
 const entries=options.entities||[ram(x)];
 const mapId=options.mapId??15;
 const map={valid:true,mapId,objects:{objects:[obj(
  options.kind||'trainer',
  options.movement===undefined?0xfe:options.movement
 )]}};
 const area=buildRomAreaEvidence(map,entries,{},{
  romIdentityMatched:options.romIdentityMatched!==false,
  spritesVerified:options.spritesVerified!==false
 });
 return {
  romSha256:options.sha||SHA,mapId,
  targetHost:options.host||'192.0.2.1',targetPort:options.port||55355,
  pollSequence:seq,
  romIdentityMatched:options.romIdentityMatched!==false,
  spritesVerified:options.spritesVerified!==false,
  positionVerified:options.positionVerified!==false,
  publicationGuardVerified:options.publicationGuardVerified!==false,
  isSimulation:options.isSimulation===true,
  romAreaEvidence:area,entities:entries
 };
};
test('first coherent sample establishes baseline but does not invent movement',()=>{
 const s=new RomActorMotionSession(),r=s.ingest(prepare(1,8));
 assert.equal(r.verified,true);assert.equal(r.baselineEstablished,true);
 assert.equal(r.changedSpriteSlots,0);assert.equal(r.atomicSnapshotVerified,false);
});
test('two consecutive published WALK slot observations record exact position difference',()=>{
 const s=new RomActorMotionSession();s.ingest(prepare(1,8));
 const r=s.ingest(prepare(2,9));assert.equal(r.verified,true);
 assert.equal(r.changedSpriteSlots,1);assert.equal(r.observedPositionChanges[0].previousRam.x,8);
 assert.equal(r.observedPositionChanges[0].currentRam.x,9);
 assert.equal(r.observedPositionChanges[0].actorIdentityVerified,false);
 assert.equal(r.movementCauseCertified,false);
});
test('unchanged RAM tile has no position delta',()=>{
 const s=new RomActorMotionSession();s.ingest(prepare(1,8));
 assert.equal(s.ingest(prepare(2,8)).changedSpriteSlots,0);
});
test('NPC WALK position delta is tracked without trainer promotion',()=>{
 const s=new RomActorMotionSession();s.ingest(prepare(1,8,{kind:'npc'}));
 const r=s.ingest(prepare(2,9,{kind:'npc'}));
 assert.equal(r.changedSpriteSlots,1);
 assert.equal(r.observedPositionChanges[0].romObjectKind,'npc');
 assert.equal(r.observedPositionChanges[0].defeated,null);
});
test('STAY objects do not produce position deltas',()=>{
 const s=new RomActorMotionSession();s.ingest(prepare(1,8,{movement:0xff}));
 assert.equal(s.ingest(prepare(2,9,{movement:0xff})).changedSpriteSlots,0);
});
test('missing intermediate poll does not compare stale sample',()=>{
 const s=new RomActorMotionSession();s.ingest(prepare(1,8));
 const r=s.ingest(prepare(3,9));assert.equal(r.changedSpriteSlots,0);
 assert.equal(r.reason,'NEW_BASELINE_AFTER_SCOPE_OR_POLL_GAP');
});
test('map transition starts new baseline',()=>{
 const s=new RomActorMotionSession();s.ingest(prepare(1,8));
 assert.equal(s.ingest(prepare(2,9,{mapId:16})).changedSpriteSlots,0);
});
test('ROM variant transition starts new baseline',()=>{
 const s=new RomActorMotionSession();s.ingest(prepare(1,8));
 assert.equal(s.ingest(prepare(2,9,{sha:BLUE})).changedSpriteSlots,0);
});
test('emulator target transition starts new baseline',()=>{
 const s=new RomActorMotionSession();s.ingest(prepare(1,8));
 assert.equal(s.ingest(prepare(2,9,{port:55356})).changedSpriteSlots,0);
});
test('publication guard failure invalidates baseline and cannot leak old delta',()=>{
 const s=new RomActorMotionSession();s.ingest(prepare(1,8));
 const bad=s.ingest(prepare(2,9,{publicationGuardVerified:false}));
 assert.equal(bad.verified,false);
 assert.equal(s.ingest(prepare(3,9)).changedSpriteSlots,0);
});
test('duplicated RAM slot invalidates sample and continuity',()=>{
 const s=new RomActorMotionSession();s.ingest(prepare(1,8));
 const dup=ram(9);const bad=s.ingest(prepare(2,9,{entities:[dup,{...dup}]}));
 assert.equal(bad.verified,false);
 assert.equal(s.ingest(prepare(3,10)).changedSpriteSlots,0);
});
test('simulation, invalid RAM and missing position proof refuse movement',()=>{
 for(const opts of [
  {isSimulation:true},{spritesVerified:false},{positionVerified:false},
  {romIdentityMatched:false}
 ]){
  const s=new RomActorMotionSession();s.ingest(prepare(1,8));
  const r=s.ingest(prepare(2,9,opts));
  assert.equal(r.verified,false);
  assert.equal(r.changedSpriteSlots,0);
  assert.equal(r.sameActorAcrossFramesCertified,false);
 }
});
