'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const RetroArchClient=require('../retroarchClient');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const {captureTargetScope}=require('../romTargetScopeGuard');
const sha=AUDITED_ROM_SHA256.RED;
const validHex=(n,val='0A')=>Array(n).fill(val);
function fake(){
 const c=Object.create(RetroArchClient.prototype);
 c.ip='192.0.2.20';c.port=55355;c._targetGeneration=0;
 c.activeRomProfile={hash:{sha256:sha}};
 c.latestState={connected:true,mapId:15,coords:{x:8,y:5},
  romRuntimeIdentity:{matched:true},videoMemory:null};
 const published=[];c.emit=(kind,value)=>published.push({kind,value});
 c.readMemoryBlock=async (address,length)=>validHex(length);
 return {c,published};
}
const proof=c=>({targetScope:captureTargetScope(c),mapId:c.latestState.mapId,
 x:c.latestState.coords.x,y:c.latestState.coords.y,
 romSha256:c.activeRomProfile.hash.sha256});
test('valid video frame emits one update only for corroborated scope',async()=>{
 const {c,published}=fake();
 assert.equal(await c.captureGuardedVideoMemory(proof(c)),true);
 assert.equal(published.length,1);
 assert.equal(c.latestState.videoMemory.tilePatterns.length,6144);
 assert.equal(c.latestState.videoMemory.bgTileMap.length,1024);
 assert.equal(c.latestState.videoMemory.oam.length,160);
});
test('host switch while the VRAM read is pending rejects the old frame',async()=>{
 const {c,published}=fake(),p=proof(c);
 let release; c.readMemoryBlock=()=>new Promise(r=>{release=r;});
 const read=c.captureGuardedVideoMemory(p);
 c.ip='192.0.2.21';c._targetGeneration=1;
 release(validHex(160)); // remaining promises use the same delayed source
 assert.equal(await read,false);
 assert.equal(published.length,0);assert.equal(c.latestState.videoMemory,null);
});
test('target generation bump rejects old VRAM even when host port are same',async()=>{
 const {c,published}=fake(),p=proof(c);
 c._targetGeneration=2;
 assert.equal(await c.captureGuardedVideoMemory(p),false);
 assert.equal(published.length,0);
});
test('map change before read starts refuses VRAM',async()=>{
 const {c,published}=fake(),p=proof(c);
 c.latestState.mapId=16;
 assert.equal(await c.captureGuardedVideoMemory(p),false);
 assert.equal(published.length,0);
});
test('map change while VRAM waits refuses stale image publication',async()=>{
 const {c,published}=fake(),p=proof(c);
 let release;
 c.readMemoryBlock=(a,n)=>new Promise(r=>{release=()=>r(validHex(n));});
 const waiting=c.captureGuardedVideoMemory(p);
 c.latestState.mapId=16;
 release();
 assert.equal(await waiting,false);
 assert.equal(published.length,0);
});
test('player coordinate change refuses old-tile VRAM frame',async()=>{
 const {c}=fake(),p=proof(c); c.latestState.coords.x=9;
 assert.equal(await c.captureGuardedVideoMemory(p),false);
 assert.equal(c.latestState.videoMemory,null);
});
test('ROM profile change refuses video of old loaded content',async()=>{
 const {c}=fake(),p=proof(c);
 c.activeRomProfile.hash.sha256=AUDITED_ROM_SHA256.BLUE;
 assert.equal(await c.captureGuardedVideoMemory(p),false);
});
test('lost runtime CRC identity refuses frame even with matching ROM file',async()=>{
 const {c}=fake(),p=proof(c);
 c.latestState.romRuntimeIdentity.matched=false;
 assert.equal(await c.captureGuardedVideoMemory(p),false);
});
test('disconnected state refuses frame',async()=>{
 const {c}=fake(),p=proof(c);c.latestState.connected=false;
 assert.equal(await c.captureGuardedVideoMemory(p),false);
});
test('truncated or malformed tile patterns do not publish video',async()=>{
 for(const invalid of ['SHORT','INVALID']){
  const {c,published}=fake();
  c.readMemoryBlock=async (addr,len)=>addr==='8000'?
   (invalid==='SHORT'?validHex(len-1):validHex(len,'GG')):validHex(len);
  assert.equal(await c.captureGuardedVideoMemory(proof(c)),false);
  assert.equal(published.length,0);
 }
});
test('missing OAM still publishes background without claiming sprite proof',async()=>{
 const {c,published}=fake();
 c.readMemoryBlock=async(addr,len)=>addr==='FE00'?null:validHex(len);
 assert.equal(await c.captureGuardedVideoMemory(proof(c)),true);
 assert.equal(c.latestState.videoMemory.oam.length,0);
 assert.equal(published.length,1);
});
test('world invalidation clears obsolete frame and app calls guarded helper',()=>{
 const {c}=fake();c.latestState.videoMemory={old:true};
 c.invalidateWorldEvidence('TARGET_SWITCH');
 assert.equal(c.latestState.videoMemory,null);
 const source=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 assert.match(source,/await this\.captureGuardedVideoMemory\(videoProof\)/);
 assert.match(source,/const videoProof=\{/);
 assert.match(source,/targetScope:captureTargetScope\(this\)/);
 assert.match(source,/this\.latestState\.videoMemory=null/);
});
