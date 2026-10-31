'use strict';
// Standalone non-mutating local observation: GET http://127.0.0.1:3001/api/state
// Never starts a server, reads emulator UDP, or prints raw session data.
const {readRunningCompanion}=require('../romLiveStateAudit');
const STR='UNKNOWN';
const safe=value=>
 typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(value)?
 value:STR;
const bool=value=>value===true?'TRUE':'FALSE';
const integer=value=>Number.isInteger(value)&&value>=0?String(value):'UNKNOWN';
readRunningCompanion({port:3001,timeoutMs:2000,maxBytes:8*1024*1024})
 .then(result=>{
  const lines=[
   'LOCAL_COMPANION_PROBE_MODE=HTTP_GET_LOOPBACK_READ_ONLY',
   'LOCAL_COMPANION_PORT=3001',
   'LIVE_PROBE_STATUS='+safe(result.status),
   'LIVE_ROM_PROFILE_MATCHED='+bool(result.romProfileMatched),
   'LIVE_FLAG_READBACK_VERIFIED='+bool(result.readbackVerified),
   'LIVE_PUBLICATION_POSITION_VERIFIED='+bool(result.publicationPositionVerified),
   'FULL_2560_BIT_RAM_STATUS='+safe(result.completeEventBitsStatus),
   'FULL_2560_BIT_RAM_VERIFIED='+bool(result.completeEventBitsVerified),
   'FULL_2560_BIT_POSITIONS='+integer(result.totalEventBitPositions),
   'FULL_2560_BIT_NAMED='+integer(result.namedReferenceBits),
   'FULL_2560_BIT_UNNAMED='+integer(result.unnamedOrReservedBits),
   'FULL_2560_BIT_ACTIVE='+integer(result.activeEventBits),
   'FULL_2560_BIT_ACTIVE_UNNAMED='+integer(result.activeUnnamedBits),
   'TRANSITION_SESSION_VERIFIED='+bool(result.verifiedBitTransitionsObserved),
   'TRANSITION_RECENT_COUNT='+integer(result.recentBitTransitions),
   'SNAPSHOT_ATOMIC_CERTIFIED=FALSE',
   'PLAYER_ACTION_CAUSALITY_CERTIFIED=FALSE',
   'LIVE_GAME_FULL_CERTIFIED=FALSE',
   'ROM_COMPLETION_100_PERCENT_CERTIFIED=FALSE'
  ];
  for(const line of lines)process.stdout.write(line+'\n');
 }).catch(()=>process.stdout.write(
  'LIVE_PROBE_STATUS=READONLY_PROBE_FAILED\n'+
  'FULL_2560_BIT_RAM_VERIFIED=FALSE\n'+
  'PLAYER_ACTION_CAUSALITY_CERTIFIED=FALSE\n'));
