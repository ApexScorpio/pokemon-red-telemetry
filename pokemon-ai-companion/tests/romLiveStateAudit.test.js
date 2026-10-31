'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {classifyLiveWorldState,readRunningCompanion}
 =require('../romLiveStateAudit');
const RED='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const state=()=>({
 connected:true,isSimulation:false,mapId:5,
 lastUpdate:new Date().toISOString(),
 romRuntimeIdentity:{matched:true,profileSha256:RED},
 memoryReadStatus:{globalFlagReadback:{
  verified:true,readbackBytesMatched:336,toggleBytesMatched:32,
  allFlagBytesMatched:368,toggleReadbackVerified:true,
  snapshotAtomicVerified:false,playerActionConfirmed:false
 }},
 globalCampaignLedger:{verified:true,romSha256:RED,mapCount:226,
  mapProgress:Array.from({length:226},(_,mapId)=>({mapId}))},
 romWorldEventAtlas:{verified:true},
 worldAdvisor:{verified:true,romSha256:RED,
  globalFlagReadbackVerified:true,globalFlagReadbackMatchedBytes:336,
  globalFlagSnapshotAtomicVerified:false}
});
test('live state requires same-ROM readback across 336 bytes but never proves actions',()=>{
 const r=classifyLiveWorldState(state());
 assert.equal(r.status,'LIVE_WORLD_FLAGS_REPEAT_CORROBORATED');
 assert.equal(r.matchedFlagBytes,336);
 assert.equal(r.matchedToggleBytes,32);
 assert.equal(r.matchedTotalFlagBytes,368);
 assert.equal(r.normalMapHeaders,226);
 assert.equal(r.liveGameCertified,false);
 assert.equal(r.atomicMemorySnapshotCertified,false);
 assert.equal(r.playerActionConfirmed,false);
 assert.equal(r.activeMapId,5);
});
test('stale or missing lastUpdate is never represented as a live ROM observation',()=>{
 const old=state();old.lastUpdate='2001-01-01T00:00:00Z';
 assert.equal(classifyLiveWorldState(old).status,'STATE_TIMESTAMP_NOT_CURRENT');
 const missing=state();delete missing.lastUpdate;
 assert.equal(classifyLiveWorldState(missing).status,'STATE_TIMESTAMP_NOT_CURRENT');
 const future=state();future.lastUpdate='2999-01-01T00:00:00Z';
 assert.equal(classifyLiveWorldState(future).status,'STATE_TIMESTAMP_NOT_CURRENT');
});
test('old server, no connection, simulation and wrong ROM remain unverified',()=>{
 assert.equal(classifyLiveWorldState(null).status,'STATE_INVALID');
 for(const [changes,expect] of [
  [{isSimulation:true},'SIMULATION_REJECTED'],
  [{connected:false},'BACKEND_NOT_CONNECTED_TO_GAME'],
  [{romRuntimeIdentity:{matched:false,profileSha256:RED}},'ACTIVE_ROM_IDENTITY_NOT_PROVEN'],
  [{romRuntimeIdentity:{matched:true,profileSha256:'f'.repeat(64)}},'ACTIVE_ROM_IDENTITY_NOT_PROVEN'],
  [{memoryReadStatus:{}},'RUNNING_VERSION_HAS_NO_READBACK_GUARD']
 ]){
  assert.equal(classifyLiveWorldState({...state(),...changes}).status,expect);
 }
});
test('missing readback or stale flags never count as observed world progress',()=>{
 const s=state();
 s.memoryReadStatus.globalFlagReadback={verified:false,domain:'WORLD_EVENTS'};
 s.globalCampaignLedger.verified=false;s.romWorldEventAtlas.verified=false;
 const rejected=classifyLiveWorldState(s);
 assert.equal(rejected.status,'RAM_READBACK_REJECTED');
 assert.equal(rejected.rejectionDomain,'WORLD_EVENTS');
 s.globalCampaignLedger.verified=true;
 assert.equal(classifyLiveWorldState(s).status,'INCONSISTENT_GUARD_BYPASS');
 s.memoryReadStatus.globalFlagReadback={verified:true,readbackBytesMatched:335,
  snapshotAtomicVerified:false,playerActionConfirmed:false};
 assert.equal(classifyLiveWorldState(s).status,'READBACK_GUARD_CONTRACT_MISMATCH');
});
test('incorrect ledger and mismatched advisor do not produce false positives',()=>{
 const a=state();a.globalCampaignLedger.romSha256='f'.repeat(64);
 assert.equal(classifyLiveWorldState(a).status,'WORLD_LEDGER_NOT_CORROBORATED');
 const b=state();b.worldAdvisor.globalFlagReadbackVerified=false;
 assert.equal(classifyLiveWorldState(b).status,'WORLD_ADVISOR_NOT_CORROBORATED');
 const absent=state();delete absent.memoryReadStatus.globalFlagReadback.toggleBytesMatched;
 assert.equal(classifyLiveWorldState(absent).status,'READBACK_GUARD_CONTRACT_MISMATCH');
 const falseToggle=state();falseToggle.memoryReadStatus.globalFlagReadback.toggleReadbackVerified=false;
 assert.equal(classifyLiveWorldState(falseToggle).status,'READBACK_GUARD_CONTRACT_MISMATCH');
 const c=state();c.memoryReadStatus.globalFlagReadback.snapshotAtomicVerified=true;
 assert.equal(classifyLiveWorldState(c).status,'READBACK_GUARD_CONTRACT_MISMATCH');
});
test('read-only localhost probe only performs GET /api/state, no mutation',async()=>{
 let verbs=[];
 const server=http.createServer((req,res)=>{
  verbs.push([req.method,req.url]);
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify(state()));
 });
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',resolve);
 });
 try{
  const r=await readRunningCompanion({port:server.address().port,timeoutMs:1000});
  assert.equal(r.status,'LIVE_WORLD_FLAGS_REPEAT_CORROBORATED');
  assert.deepEqual(verbs,[['GET','/api/state']]);
 }finally{
  await new Promise(resolve=>server.close(resolve));
 }
});
test('invalid probe settings do not send network traffic',async()=>{
 for(const opts of [{port:0},{port:65536},{timeoutMs:99},{maxBytes:100}]){
  const r=await readRunningCompanion(opts);
  assert.equal(r.status,'PROBE_OPTIONS_INVALID');
 }
});
