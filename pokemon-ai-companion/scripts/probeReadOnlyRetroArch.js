'use strict';
// Safe one-shot diagnostic: does not start RetroArch, write save states,
// perform input actions or change any application configurations.
// Default address/port copied from this repository's existing server.js.
const {probeReadOnlyRetroArch}=require('../romReadOnlyRetroArchProbe');
const hostFromEnvironment=process.env.POKEGUIDE_PROBE_HOST;
const host=hostFromEnvironment||'192.168.1.145';
const targetOrigin=hostFromEnvironment?'POKEGUIDE_PROBE_HOST_ENV':
 'LEGACY_IPHONE_IP_FROM_SERVER_JS_NOT_CURRENTLY_VERIFIED';
const rawPort=process.env.POKEGUIDE_PROBE_PORT;
const port=rawPort===undefined?55355:
 /^\d{1,5}$/.test(rawPort)?Number(rawPort):0;
const sourceReadback=process.env.POKEGUIDE_MBC3_SOURCE_READBACK==='1';
probeReadOnlyRetroArch({host,port,mbc3SourceReadback:sourceReadback}).then(result=>{
 console.log('POKEGUIDE_RETROARCH_TARGET_HOST='+host);
 console.log('POKEGUIDE_RETROARCH_TARGET_PORT='+port);
 console.log('POKEGUIDE_RETROARCH_TARGET_ORIGIN='+targetOrigin);
 console.log('POKEGUIDE_RETROARCH_TARGET_RUNTIME_CONFIRMED=FALSE');
 console.log('POKEGUIDE_RETROARCH_UDP_REQUESTS_ATTEMPTED='+
  (result.readOnlyRequestsAttempted??0));
 console.log('POKEGUIDE_RETROARCH_STATUS_REQUESTS_ATTEMPTED='+
  (result.statusRequestsAttempted??0));
 console.log('POKEGUIDE_RETROARCH_MEMORY_REQUESTS_ATTEMPTED='+
  (result.memoryReadRequestsAttempted??0));
 console.log('POKEGUIDE_RETROARCH_LAST_ATTEMPTED_COMMAND='+
  (result.lastAttemptedCommand??'NONE'));
 console.log('POKEGUIDE_MBC3_SOURCE_READBACK_REQUESTED='+
  (sourceReadback?'TRUE':'FALSE'));
 console.log('POKEGUIDE_MBC3_SOURCE_READBACK_VERIFIED='+
  (result.mbc3SourceReadbackVerified===true?'TRUE':'FALSE'));
 console.log('POKEGUIDE_MBC3_SOURCE_STABLE_BYTES='+
  (result.mbc3SourceStableBytes??0));
 console.log('POKEGUIDE_MBC3_ACTIVE_BANK_VERIFIED=FALSE');
 console.log('POKEGUIDE_MBC3_SOURCE_SAMPLE_EVIDENCE='+JSON.stringify(
  result.mbc3SourceSamples??[]));
 console.log('POKEGUIDE_RETROARCH_PROBE_STATUS='+result.status);
 console.log('POKEGUIDE_RETROARCH_REPEAT_READBACK_VERIFIED='+
  (result.verified===true?'TRUE':'FALSE'));
 console.log('POKEGUIDE_RETROARCH_VARIANT='+(result.variant||'UNKNOWN'));
 console.log('POKEGUIDE_RETROARCH_MAP_ID='+
  (result.verified===true?result.mapId:'UNKNOWN'));
 console.log('POKEGUIDE_RETROARCH_MATCHED_FLAG_BYTES='+
  (result.matchedFlagBytes??0));
 console.log('POKEGUIDE_RETROARCH_MATCHED_TOGGLE_BYTES='+
  (result.matchedToggleBytes??0));
 console.log('POKEGUIDE_RETROARCH_MATCHED_TOTAL_FLAG_BYTES='+
  (result.matchedTotalFlagBytes??0));
 console.log('POKEGUIDE_RETROARCH_MAP_REPEATED='+
  (result.mapRepeated===true?'TRUE':'FALSE'));
 console.log('POKEGUIDE_RETROARCH_POSITION_REPEATED='+
  (result.positionRepeated===true?'TRUE':'FALSE'));
 console.log('POKEGUIDE_RETROARCH_READONLY_REQUESTS='+
  (result.readOnlyRequests??0));
 console.log('POKEGUIDE_RETROARCH_REJECTION_DOMAIN='+
  (result.rejectedDomain??'NONE'));
 console.log('POKEGUIDE_RETROARCH_ACTIONS_CERTIFIED=FALSE');
 console.log('POKEGUIDE_RETROARCH_ATOMIC_SNAPSHOT_CERTIFIED=FALSE');
 console.log('POKEGUIDE_RETROARCH_NO_SAVE_OR_ROM_WRITES=TRUE');
}).catch(()=>{
 console.log('POKEGUIDE_RETROARCH_PROBE_STATUS=PROBE_INTERNAL_ERROR');
 console.log('POKEGUIDE_RETROARCH_REPEAT_READBACK_VERIFIED=FALSE');
 process.exitCode=1;
});
