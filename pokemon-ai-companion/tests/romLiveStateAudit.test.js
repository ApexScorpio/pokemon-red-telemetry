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
 memoryReadStatus:{verified:true,mapSnapshot:{verified:true},
  positionWindow:{verified:true,mapId:5,x:8,y:9},
  latePositionWindow:{verified:true,mapId:5,x:8,y:9},
  publicationPositionWindow:{verified:true,mapId:5,x:8,y:9},
  globalFlagReadback:{
  verified:true,romAndMapCorroborated:true,
  readbackBytesMatched:336,toggleBytesMatched:32,
  allFlagBytesMatched:368,toggleReadbackVerified:true,
  snapshotAtomicVerified:false,playerActionConfirmed:false
 }},
 globalCampaignLedger:{verified:true,romSha256:RED,mapCount:226,
  mapProgress:Array.from({length:226},(_,mapId)=>({mapId}))},
 romWorldEventAtlas:{verified:true,romSha256:RED,
  summary:{namedEventBits:507,referenceToggleBits:228},
  events:Array.from({length:507},()=>({flagSet:false})),
  toggleFlags:Array.from({length:228},()=>({removedFlagSet:false}))},
 worldAdvisor:{verified:true,mapId:5,romSha256:RED,
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
 assert.equal(r.mapPositionVerified,true);
 assert.equal(r.publicationPositionVerified,true);
 assert.equal(r.namedEventsFlagBits,507);
 assert.equal(r.removableObjectFlags,228);
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
test('no live location certification from absent or mismatched map and coordinates',()=>{
 for(const mutate of [
  s=>{s.memoryReadStatus.verified=false;},
  s=>{s.memoryReadStatus.mapSnapshot.verified=false;},
  s=>{s.memoryReadStatus.positionWindow.verified=false;},
  s=>{s.memoryReadStatus.latePositionWindow.verified=false;},
  s=>{delete s.memoryReadStatus.latePositionWindow;},
  s=>{s.memoryReadStatus.publicationPositionWindow.verified=false;},
  s=>{delete s.memoryReadStatus.publicationPositionWindow;},
  s=>{s.memoryReadStatus.publicationPositionWindow.mapId=6;},
  s=>{s.memoryReadStatus.publicationPositionWindow.x=10;},
  s=>{s.memoryReadStatus.publicationPositionWindow.y=10;},
  s=>{s.memoryReadStatus.latePositionWindow.x=10;},
  s=>{s.memoryReadStatus.latePositionWindow.y=10;},
  s=>{s.memoryReadStatus.latePositionWindow.mapId=6;},
  s=>{s.memoryReadStatus.positionWindow.x=10;},
  s=>{s.mapId=248;},
  s=>{s.mapId=-1;},
  s=>{delete s.mapId;}
 ]){
  const sample=state();mutate(sample);
  const result=classifyLiveWorldState(sample);
  assert.equal(result.status,'LIVE_MAP_POSITION_NOT_CORROBORATED');
  assert.equal(result.liveGameCertified,false);
 }
 const staleAdvisor=state();staleAdvisor.worldAdvisor.mapId=4;
 assert.equal(classifyLiveWorldState(staleAdvisor).status,
  'WORLD_ADVISOR_NOT_CORROBORATED');
});
test('a named-event atlas for another ROM or missing toggles cannot certify live state',()=>{
 for(const mutate of [
  s=>{s.romWorldEventAtlas.verified=false;},
  s=>{s.romWorldEventAtlas.romSha256='0'.repeat(64);},
  s=>{s.romWorldEventAtlas.summary.namedEventBits=506;},
  s=>{s.romWorldEventAtlas.summary.referenceToggleBits=227;},
  s=>{s.romWorldEventAtlas.events=[];},
  s=>{s.romWorldEventAtlas.toggleFlags=[];}
 ]){
  const sample=state();mutate(sample);
  assert.equal(classifyLiveWorldState(sample).status,
   'WORLD_EVENT_ATLAS_NOT_CORROBORATED');
 }
 const guard=state();guard.memoryReadStatus.globalFlagReadback.romAndMapCorroborated=false;
 assert.equal(classifyLiveWorldState(guard).status,
  'READBACK_GUARD_CONTRACT_MISMATCH');
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
