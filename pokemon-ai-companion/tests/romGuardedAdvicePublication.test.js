'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const RetroArchClient=require('../retroarchClient');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
function fake(){
 const c=Object.create(RetroArchClient.prototype);
 c.ip='192.0.2.20';c.port=55355;c._targetGeneration=0;
 c._videoEvidenceEpoch=3;
 c.activeRomProfile={hash:{sha256:AUDITED_ROM_SHA256.RED}};
 c.latestState={
  connected:true,isSimulation:false,inBattle:false,
  romRuntimeIdentity:{matched:true,
   profileSha256:AUDITED_ROM_SHA256.RED,reportedCRC32:'9F7FDD53'},
  memoryReadStatus:{verified:true,
   publicationPositionWindow:{verified:true}},
  mapId:15,mapName:'Route 4',coords:{x:8,y:9},trainerName:'RED',
  party:[{name:'PIKACHU',level:20,hp:50,maxHp:50,
   moves:[{id:1,name:'Tackle',pp:20}]}],
  inventory:[],badges:[],money:400,
  lastUpdate:new Date().toISOString(),
  aiAdvice:'A sincronizar com a memória do Game Boy...'
 };
 const events=[];c.emit=(name)=>events.push(name);
 return {c,events};
}
function deferred(){
 let resolve;
 const promise=new Promise(r=>{resolve=r;});
 return {promise,resolve};
}
test('current verified AI reply publishes once',async()=>{
 const {c,events}=fake(),d=deferred();
 const p=c.requestGuardedExplorationAdvice(()=>d.promise);
 d.resolve('Route 4');
 assert.equal(await p,true);
 assert.equal(c.latestState.aiAdvice,'Route 4');
 assert.deepEqual(events,['update']);
});
test('RAM invalidation rejects a reply even after same-map reconnect',async()=>{
 const {c,events}=fake(),d=deferred();
 const p=c.requestGuardedExplorationAdvice(()=>d.promise);
 c.invalidateWorldEvidence('RAM_LOST');
 c.latestState.connected=true;
 c.latestState.romRuntimeIdentity.matched=true;
 c.latestState.memoryReadStatus={verified:true,
  publicationPositionWindow:{verified:true}};
 d.resolve('old advice');
 assert.equal(await p,false);
 assert.match(c.latestState.aiAdvice,/A sincronizar/);
 assert.deepEqual(events,[]);
});
test('host switch rejects pending advice',async()=>{
 const {c}=fake(),d=deferred(),p=c.requestGuardedExplorationAdvice(()=>d.promise);
 c.ip='192.0.2.21';c._targetGeneration++;
 d.resolve('old');assert.equal(await p,false);
});
test('same host and port with new target generation refuses old reply',async()=>{
 const {c}=fake(),d=deferred(),p=c.requestGuardedExplorationAdvice(()=>d.promise);
 c._targetGeneration+=2;d.resolve('old');
 assert.equal(await p,false);
});
test('map change and movement reject previous recommendations',async()=>{
 for(const update of [
  c=>{c.latestState.mapId=16;},
  c=>{c.latestState.coords.x=10;}
 ]){
  const {c}=fake(),d=deferred(),p=c.requestGuardedExplorationAdvice(()=>d.promise);
  update(c);d.resolve('old');assert.equal(await p,false);
 }
});
test('team HP and inventory change invalidate pending advice',async()=>{
 for(const update of [
  c=>{c.latestState.party[0].hp=10;},
  c=>{c.latestState.inventory.push({id:1,name:'Potion',qty:1});}
 ]){
  const {c}=fake(),d=deferred(),p=c.requestGuardedExplorationAdvice(()=>d.promise);
  update(c);d.resolve('old');assert.equal(await p,false);
 }
});
test('entering battle invalidates old exploration recommendation',async()=>{
 const {c}=fake(),d=deferred(),p=c.requestGuardedExplorationAdvice(()=>d.promise);
 c.latestState.inBattle=true;d.resolve('exploration');
 assert.equal(await p,false);
});
test('provider rejection does not raise unhandled error or stale update',async()=>{
 const {c,events}=fake();
 assert.equal(await c.requestGuardedExplorationAdvice(
  ()=>Promise.reject(new Error('secret provider error'))),false);
 assert.deepEqual(events,[]);
});
test('missing final map proof prevents AI request altogether',async()=>{
 const {c}=fake();c.latestState.memoryReadStatus.publicationPositionWindow.verified=false;
 let requests=0;
 assert.equal(await c.requestGuardedExplorationAdvice(()=>{
  requests++;return 'unsafe';
 }),false);
 assert.equal(requests,0);
});
test('invalidation erases old battle, dialogue and advice live evidence',()=>{
 const {c}=fake();
 Object.assign(c.latestState,{inBattle:true,battleType:'Trainer',
  battle:{enemy:{name:'Mewtwo'}},battleReadStatus:{verified:true},
  battleFlagVerified:true,currentDialog:'OLD',
  currentTextSource:'tilemap',aiAdvice:'OLD'});
 c.invalidateWorldEvidence('RAM_LOST');
 assert.equal(c.latestState.battle,null);
 assert.equal(c.latestState.inBattle,false);
 assert.equal(c.latestState.battleReadStatus.verified,false);
 assert.equal(c.latestState.currentDialog,null);
 assert.match(c.latestState.aiAdvice,/A sincronizar/);
});
test('transient battle and AI fields are excluded from both saved caches',()=>{
 const {c}=fake(),writes=[],old=fs.writeFileSync;
 Object.assign(c.latestState,{battle:{enemy:{name:'Mewtwo'}},
  battleReadStatus:{verified:true},battleFlagVerified:true,
  battleType:'Trainer',inBattle:true,currentDialog:'A',
  currentTextSource:'tilemap',areaInfo:{name:'Route 4'},
  actionHistory:[{text:'log'}]});
 fs.writeFileSync=(_p,json)=>{writes.push(JSON.parse(json));};
 try{c.persistState(c.latestState);}finally{fs.writeFileSync=old;}
 assert.equal(writes.length,2);
 for(const saved of writes){
  for(const key of ['battle','battleReadStatus','battleFlagVerified',
   'battleType','inBattle','aiAdvice','currentDialog','currentTextSource'])
   assert.equal(Object.hasOwn(saved,key),false,key);
  assert.equal(saved.party[0].hp,50);
  assert.equal(saved.actionHistory[0].text,'log');
 }
});
test('AI request is after final position gate in real client',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const gate=src.indexOf('const targetScopeStable=matchesTargetScope(this,pollTargetScope)');
 const advice=src.indexOf('void this.requestGuardedExplorationAdvice();');
 const campaign=src.indexOf('const campaignSession=this._worldCampaignSession.ingestPublished({');
 assert.ok(gate>0&&advice>gate&&campaign>advice);
 assert.equal(src.includes('getLiveAdvice(this.latestState).then('),false);
});
