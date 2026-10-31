'use strict';
// Audit an already running companion's read-only state endpoint.
// No emulator commands, no game inputs, no process launches, no save writes.
// A validated RAM readback is not proof of atomicity or of actions executed.
const http=require('node:http');
const KNOWN=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
]);
const result=(status,extra={})=>({
 status,liveGameCertified:false,playerActionConfirmed:false,
 atomicMemorySnapshotCertified:false,...extra
});
function classifyLiveWorldState(state,{nowMs=Date.now(),maxAgeMs=30000}={}){
 if(!state||typeof state!=='object'||Array.isArray(state))
  return result('STATE_INVALID');
 if(state.isSimulation===true)return result('SIMULATION_REJECTED');
 if(state.connected!==true)return result('BACKEND_NOT_CONNECTED_TO_GAME');
 // 'connected' may be left over from a previous poll. Never label
 // stale cached telemetry as a current live game observation.
 const timestamp=Date.parse(state.lastUpdate||'');
 if(!Number.isFinite(timestamp)||!Number.isFinite(nowMs)||
    !Number.isInteger(maxAgeMs)||maxAgeMs<1000||
    timestamp>nowMs+2000||nowMs-timestamp>maxAgeMs)
  return result('STATE_TIMESTAMP_NOT_CURRENT');
 const identity=state.romRuntimeIdentity||{};
 const sha=String(identity.profileSha256||'').toLowerCase();
 if(identity.matched!==true||!KNOWN.has(sha))
  return result('ACTIVE_ROM_IDENTITY_NOT_PROVEN');
 const guard=state.memoryReadStatus?.globalFlagReadback;
 if(!guard||typeof guard.verified!=='boolean')
  return result('RUNNING_VERSION_HAS_NO_READBACK_GUARD',
   {romProfileMatched:true});
 const ledger=state.globalCampaignLedger;
 const advisor=state.worldAdvisor;
 if(guard.verified!==true){
  if(ledger?.verified===true||state.romWorldEventAtlas?.verified===true)
   return result('INCONSISTENT_GUARD_BYPASS',
    {romProfileMatched:true,readbackVerified:false});
  return result('RAM_READBACK_REJECTED',
   {romProfileMatched:true,readbackVerified:false,
    rejectionDomain:['MAP','RAM','HIDDEN_ITEMS','HIDDEN_COINS','WORLD_EVENTS','OBJECT_TOGGLES']
     .includes(guard.domain)?guard.domain:'OTHER'});
 }
 if(guard.readbackBytesMatched!==336||
    guard.toggleBytesMatched!==32||guard.allFlagBytesMatched!==368||
    guard.toggleReadbackVerified!==true||guard.romAndMapCorroborated!==true||
    guard.snapshotAtomicVerified!==false||
    guard.playerActionConfirmed!==false)
  return result('READBACK_GUARD_CONTRACT_MISMATCH',
   {romProfileMatched:true,readbackVerified:false});
 // A repeated flag window is not enough to trust a position-specific
 // recommendation when the map or coordinates went stale mid-poll.
 if(state.memoryReadStatus?.verified!==true||
    state.memoryReadStatus?.mapSnapshot?.verified!==true||
    state.memoryReadStatus?.positionWindow?.verified!==true||
    !Number.isInteger(state.mapId)||state.mapId<0||state.mapId>=248)
  return result('LIVE_MAP_POSITION_NOT_CORROBORATED',
   {romProfileMatched:true,readbackVerified:true});
 const named=state.romWorldEventAtlas;
 if(named?.verified!==true||named.romSha256!==sha||
    named.summary?.namedEventBits!==507||
    named.summary?.referenceToggleBits!==228||
    !Array.isArray(named.events)||named.events.length!==507||
    !Array.isArray(named.toggleFlags)||named.toggleFlags.length!==228)
  return result('WORLD_EVENT_ATLAS_NOT_CORROBORATED',
   {romProfileMatched:true,readbackVerified:true,mapPositionVerified:true});
 if(ledger?.verified!==true||ledger.romSha256!==sha||
    ledger.mapCount!==226||!Array.isArray(ledger.mapProgress)||
    ledger.mapProgress.length!==226)
  return result('WORLD_LEDGER_NOT_CORROBORATED',
   {romProfileMatched:true,readbackVerified:true});
 if(advisor?.verified!==true||advisor.romSha256!==sha||
    advisor.mapId!==state.mapId||
    advisor.globalFlagReadbackVerified!==true||
    advisor.globalFlagReadbackMatchedBytes!==336||
    advisor.globalFlagSnapshotAtomicVerified!==false)
  return result('WORLD_ADVISOR_NOT_CORROBORATED',
   {romProfileMatched:true,readbackVerified:true,
    ledgerVerified:true});
 return result('LIVE_WORLD_FLAGS_REPEAT_CORROBORATED',{
  romProfileMatched:true,readbackVerified:true,
  ledgerVerified:true,worldAdvisorVerified:true,
  mapPositionVerified:true,namedEventsFlagBits:507,removableObjectFlags:228,
  matchedFlagBytes:336,matchedToggleBytes:32,matchedTotalFlagBytes:368,
  normalMapHeaders:226,
  activeMapId:Number.isInteger(state.mapId)?state.mapId:null,
  observedAt:typeof state.lastUpdate==='string'?
   state.lastUpdate:null,
  warning:'Read-only companion status; game effects, live causality and atomic snapshots still unproven'
 });
}
function readRunningCompanion({port=3001,timeoutMs=1500,maxBytes=8*1024*1024}={}){
 if(!Number.isInteger(port)||port<1||port>65535||
    !Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>10000||
    !Number.isInteger(maxBytes)||maxBytes<1024||maxBytes>8*1024*1024)
  return Promise.resolve(result('PROBE_OPTIONS_INVALID'));
 return new Promise(resolve=>{
  let settled=false;
  const finish=value=>{
   if(settled)return;settled=true;resolve(value);
  };
  const req=http.get({
   hostname:'127.0.0.1',port,path:'/api/state',
   timeout:timeoutMs,
   headers:{Accept:'application/json'},
   agent:false
  },response=>{
   if(response.statusCode!==200){
    response.resume();
    finish(result('HTTP_STATE_NOT_AVAILABLE',
     {httpStatus:response.statusCode}));
    return;
   }
   const chunks=[];let size=0;
   response.on('data',chunk=>{
    size+=chunk.length;
    if(size>maxBytes){
     finish(result('STATE_RESPONSE_TOO_LARGE'));
     req.destroy();return;
    }
    chunks.push(chunk);
   });
   response.on('end',()=>{
    if(settled)return;
    try{finish(classifyLiveWorldState(JSON.parse(
     Buffer.concat(chunks).toString('utf8'))));}
    catch{finish(result('STATE_RESPONSE_INVALID_JSON'));}
   });
   response.on('error',()=>finish(result('HTTP_READ_FAILED')));
  });
  req.on('timeout',()=>req.destroy(new Error('PROBE_TIMEOUT')));
  req.on('error',err=>finish(result(err.message==='PROBE_TIMEOUT'?
   'COMPANION_NOT_RESPONDING':'COMPANION_NOT_LISTENING')));
 });
}
module.exports={classifyLiveWorldState,readRunningCompanion};
