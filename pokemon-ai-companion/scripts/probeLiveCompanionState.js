'use strict';
// This probe sends exactly one HTTP GET to the local already-running companion.
// It never starts/stops an emulator, writes saves or issues RetroArch commands.
const {readRunningCompanion}=require('../romLiveStateAudit');
const PORT=3001; // verified in existing pokemon-ai-companion/server.js
readRunningCompanion({port:PORT}).then(r=>{
 console.log('POKEGUIDE_LOCAL_LIVE_PROBE_STATUS='+r.status);
 console.log('POKEGUIDE_LOCAL_LIVE_RAM_CORROBORATED='+
  (r.status==='LIVE_WORLD_FLAGS_REPEAT_CORROBORATED'?'TRUE':'FALSE'));
 console.log('POKEGUIDE_LOCAL_WORLD_FLAG_BYTES='+
  (r.matchedFlagBytes??0));
 console.log('POKEGUIDE_LOCAL_ACTIVE_MAP_ID='+
  (r.activeMapId??'UNKNOWN'));
 console.log('POKEGUIDE_LOCAL_OBSERVED_AT='+
  (r.observedAt??'UNVERIFIED'));
 console.log('POKEGUIDE_GAMEPLAY_100_CERTIFIED=FALSE');
 console.log('POKEGUIDE_NO_ROM_OR_SAVE_WRITE=TRUE');
}).catch(()=>{console.log('POKEGUIDE_LOCAL_LIVE_PROBE_STATUS=READ_ERROR');
 console.log('POKEGUIDE_LOCAL_LIVE_RAM_CORROBORATED=FALSE');
 process.exitCode=1;
});
