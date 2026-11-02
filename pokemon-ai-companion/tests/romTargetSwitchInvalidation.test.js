'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const RetroArchClient=require('../retroarchClient');
const {captureTargetScope,matchesTargetScope}=require('../romTargetScopeGuard');
function fake(){
 const c=Object.create(RetroArchClient.prototype);
 c.ip='192.0.2.20';c.port=55355;c._targetGeneration=0;
 c.lastRomStatusReadAt=123456;
 c._currentSessionSha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
 c.activeRomProfile={hash:{sha256:c._currentSessionSha},title:'Old ROM'};
 c.latestState={
  connected:true,lastUpdate:'2026-10-31T21:00:00Z',
  romValidation:'Old profile',romRuntimeIdentity:{matched:true},
  romHeader:{fullRomVerified:true},
  memoryReadStatus:{verified:true},
  romAreaEvidence:{verified:true,trainers:[{kind:'trainer'}]},
  romLiveActorIdentification:{verified:true,identifiedTrainers:1},
  romActorMotionDelta:{verified:true,changedSpriteSlots:1},
  romMap:{mapId:15},romWildEncounters:{grass:{slots:[1]}},
  mapEntities:[{x:8,y:8}],
  worldAdvisor:{verified:true}
 };
 const events=[];c.emit=(type,state)=>events.push({type,state});
 const socket={alive:true};c.socket=socket;c.isPolling=true;c.timer={active:true};
 return {c,events,socket};
}
test('capture preserves generation, host and port',()=>{
 const {c}=fake();assert.deepEqual(captureTargetScope(c),
  {host:'192.0.2.20',port:55355,generation:0});
});
test('different host invalidates a poll scope',()=>{
 const {c}=fake(),scope=captureTargetScope(c);c.ip='192.0.2.21';
 assert.equal(matchesTargetScope(c,scope),false);
});
test('different port invalidates a poll scope',()=>{
 const {c}=fake(),scope=captureTargetScope(c);c.port=55356;
 assert.equal(matchesTargetScope(c,scope),false);
});
test('switch away and back cannot reuse stale in-flight read',()=>{
 const {c}=fake(),scope=captureTargetScope(c);
 c._targetGeneration=2;assert.equal(matchesTargetScope(c,scope),false);
});
test('unchanged target is idempotent and preserves ROM identity',()=>{
 const {c,events}=fake();
 assert.equal(c.setTarget('192.0.2.20',55355),false);
 assert.equal(c.activeRomProfile.title,'Old ROM');
 assert.equal(events.length,0);assert.equal(c._targetGeneration,0);
});
test('new target immediately denies old ROM identity and CRC',()=>{
 const {c}=fake();assert.equal(c.setTarget('192.0.2.21',55355),true);
 assert.equal(c.activeRomProfile,null);
 assert.equal(c._currentSessionSha,null);
 assert.equal(c.latestState.romRuntimeIdentity.matched,false);
 assert.equal(c.latestState.romRuntimeIdentity.reportedCRC32,null);
});
test('new target requires GET_STATUS on very next poll',()=>{
 const {c}=fake();c.setTarget('192.0.2.21',55355);
 assert.equal(c.lastRomStatusReadAt,0);
 assert.equal(c._targetGeneration,1);
});
test('target change clears observed RAM entities and ROM event evidence',()=>{
 const {c}=fake();c.setTarget('192.0.2.21',55355);
 assert.deepEqual(c.latestState.mapEntities,[]);
 assert.equal(c.latestState.romAreaEvidence.verified,false);
 assert.equal(c.latestState.romLiveActorIdentification.verified,false);
 assert.equal(c.latestState.worldAdvisor.verified,false);
 assert.equal(c.latestState.connected,false);
});
test('target change invalidates motion delta and lastUpdate',()=>{
 const {c}=fake();c.setTarget('192.0.2.21',55355);
 assert.equal(c.latestState.romActorMotionDelta.verified,false);
 assert.equal(c.latestState.lastUpdate,null);
});
test('target change emits update without restarting socket or polling',()=>{
 const {c,events,socket}=fake();c.setTarget('192.0.2.21',55355);
 assert.equal(c.socket,socket);assert.equal(c.isPolling,true);
 assert.deepEqual(c.timer,{active:true});
 assert.equal(events.length,1);assert.equal(events[0].type,'update');
});
test('invalid targets fail closed without altering existing identity',()=>{
 for(const [host,port] of [['',55355],['192.0.2.21',0],['192.0.2.21',65536],
  [null,55355],['192.0.2.21',2.1]]){
  const {c}=fake();
  assert.throws(()=>c.setTarget(host,port),RangeError);
  assert.equal(c.ip,'192.0.2.20');
  assert.equal(c.activeRomProfile.title,'Old ROM');
 }
});
test('fetchGameState checks target scope before GET_STATUS and at final publication',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 assert.match(source,/const pollTargetScope=captureTargetScope\(this\)/);
 assert.match(source,/const reply = await this\.sendRaw\('GET_STATUS'\);[\s\S]*?if\(!matchesTargetScope\(this,pollTargetScope\)\)return/);
 assert.match(source,/const targetScopeStable=matchesTargetScope\(this,pollTargetScope\)/);
 assert.match(source,/if\(!targetScopeStable\|\|publicationPositionWindow\.verified!==true/);
 assert.match(source,/TARGET_SWITCH_DURING_POLL_REJECT_PUBLICATION/);
});
