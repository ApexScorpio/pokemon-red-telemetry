'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const RetroArchClient=require('../retroarchClient');
const {captureTargetScope}=require('../romTargetScopeGuard');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const hex=n=>Array(n).fill('00');
function fake(){
 const c=Object.create(RetroArchClient.prototype);
 c.ip='192.0.2.20';c.port=55355;c._targetGeneration=0;
 c._videoEvidenceEpoch=7;
 c.activeRomProfile={hash:{sha256:AUDITED_ROM_SHA256.RED}};
 c.latestState={connected:true,mapId:15,coords:{x:8,y:9},
  romRuntimeIdentity:{matched:true},videoMemory:null};
 const events=[];c.emit=(name)=>events.push(name);
 c.readMemoryBlock=async (_addr,len)=>hex(len);
 return {c,events};
}
function proof(c){
 return {targetScope:captureTargetScope(c),mapId:15,x:8,y:9,
  romSha256:AUDITED_ROM_SHA256.RED,
  evidenceEpoch:c._videoEvidenceEpoch};
}
function delayed(c){
 const pending=[];
 c.readMemoryBlock=(_address,len)=>new Promise(resolve=>{
  pending.push(()=>resolve(hex(len)));
 });
 return pending;
}
test('new epoch allows a corroborated background image',async()=>{
 const {c,events}=fake();
 assert.equal(await c.captureGuardedVideoMemory(proof(c)),true);
 assert.equal(events.length,1);
});
test('old epoch rejects immediately even on same host and position',async()=>{
 const {c,events}=fake(),p=proof(c);
 c._videoEvidenceEpoch++;
 assert.equal(await c.captureGuardedVideoMemory(p),false);
 assert.equal(events.length,0);
});
test('missing epoch cannot claim a publication-guarded VRAM sample',async()=>{
 const {c,events}=fake(),p=proof(c);delete p.evidenceEpoch;
 assert.equal(await c.captureGuardedVideoMemory(p),false);
 assert.equal(events.length,0);
});
test('negative and fractional epochs are invalid',async()=>{
 for(const evidenceEpoch of [-1,1.5,NaN]){
  const {c}=fake();
  assert.equal(await c.captureGuardedVideoMemory({
   ...proof(c),evidenceEpoch
  }),false);
 }
});
test('invalidateWorldEvidence advances video generation and clears frame',()=>{
 const {c}=fake(),before=c._videoEvidenceEpoch;
 c.latestState.videoMemory={stale:true};
 c.invalidateWorldEvidence('DISCONNECTED');
 assert.equal(c._videoEvidenceEpoch,before+1);
 assert.equal(c.latestState.videoMemory,null);
});
test('consecutive invalidations cannot reuse an old video evidence generation',()=>{
 const {c}=fake();c.invalidateWorldEvidence('FIRST');
 const first=c._videoEvidenceEpoch;
 c.invalidateWorldEvidence('SECOND');
 assert.equal(c._videoEvidenceEpoch,first+1);
});
test('pre-invalidation VRAM arriving after same-map reconnect is rejected',async()=>{
 const {c,events}=fake(),p=proof(c),releases=delayed(c);
 const request=c.captureGuardedVideoMemory(p);
 assert.equal(releases.length,4);
 c.invalidateWorldEvidence('RECONNECT');
 c.latestState.connected=true;
 c.latestState.mapId=15;c.latestState.coords={x:8,y:9};
 c.latestState.romRuntimeIdentity.matched=true;
 for(const complete of releases)complete();
 assert.equal(await request,false);
 assert.equal(c.latestState.videoMemory,null);
 assert.equal(events.length,0);
});
test('new video capture can publish after same-map reconnect',async()=>{
 const {c,events}=fake();
 c.invalidateWorldEvidence('RECONNECT');
 c.latestState.connected=true;
 assert.equal(await c.captureGuardedVideoMemory(proof(c)),true);
 assert.equal(events.length,1);
});
test('interrupted video read does not publish old image after repeated reset',async()=>{
 const {c,events}=fake(),p=proof(c),releases=delayed(c);
 const pending=c.captureGuardedVideoMemory(p);
 c.invalidateWorldEvidence('FIRST');
 c.invalidateWorldEvidence('SECOND');
 c.latestState.connected=true;
 for(const complete of releases)complete();
 assert.equal(await pending,false);
 assert.equal(events.length,0);
});
test('a video frame cannot be published after invalidation with matching ROM',async()=>{
 const {c}=fake(),p=proof(c),releases=delayed(c);
 const pending=c.captureGuardedVideoMemory(p);
 c.invalidateWorldEvidence('POLL_EXCEPTION');
 c.latestState.connected=true;
 for(const complete of releases)complete();
 assert.equal(await pending,false);
});
test('epoch check does not mutate target host, port or ROM identity',async()=>{
 const {c}=fake(),p=proof(c);
 await c.captureGuardedVideoMemory({...p,evidenceEpoch:p.evidenceEpoch-1});
 assert.equal(c.ip,'192.0.2.20');
 assert.equal(c.port,55355);
 assert.equal(c._targetGeneration,0);
 assert.equal(c.activeRomProfile.hash.sha256,AUDITED_ROM_SHA256.RED);
});
test('video launcher occurs after the final position refusal branch',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const start=src.indexOf('const targetScopeStable=matchesTargetScope(this,pollTargetScope)');
 const refusal=src.indexOf('TARGET_SWITCH_DURING_POLL_REJECT_PUBLICATION',start);
 const launcher=src.indexOf('const videoProof={');
 const campaign=src.indexOf('const campaignSession=this._worldCampaignSession.ingestPublished({');
 const persist=src.lastIndexOf('this.persistState(this.latestState);');
 assert.ok(start>0&&refusal>start&&launcher>refusal&&
  campaign>launcher&&persist>campaign);
 assert.match(src.slice(launcher,campaign),/evidenceEpoch:this\._videoEvidenceEpoch/);
 assert.match(src,/this\._videoEvidenceEpoch\+1:1/);
});
