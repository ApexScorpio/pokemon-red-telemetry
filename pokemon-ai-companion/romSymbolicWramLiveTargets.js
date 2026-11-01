'use strict';

const {isKnownAuditedRomSha}=
 require('./romKnownSha256');

const SOURCE=
 'ROM_SYMBOLIC_WRAM_TARGET_BY_EXISTING_D369_SAMPLE_V1';

const invalid=reason=>({
 verified:false,
 reason,
 source:SOURCE,
 candidateTargets:[],
 sourceReadObserved:false,
 publicationPositionVerified:false,
 atomicSnapshotVerified:false,
 memoryWriteObserved:false,
 gameplayExecutionObserved:false,
 gameEventCompleted:false
});

function selectSymbolicWramTargets({
 evidence,
 romSha256,
 mapId,
 playerBlock,
 eligible=false
}={}){
 if(!eligible)
  return invalid('LIVE_PUBLICATION_GATES_NOT_VERIFIED');

 if(
  !isKnownAuditedRomSha(romSha256)||
  evidence?.verified!==true||
  evidence.romSha256!==romSha256||
  evidence.mapId!==mapId||
  !Number.isInteger(mapId)||
  mapId<0||mapId>=248||
  !Array.isArray(
   evidence.runtimeSymbolicWriteRequirements
  )||
  !Array.isArray(playerBlock)||
  playerBlock.length!==530
 )return invalid('ROM_MAP_OR_RAM_BLOCK_INVALID');

 const text=playerBlock[0xd369-0xd158];

 if(
  typeof text!=='string'||
  !/^[0-9a-f]{2}$/i.test(text)
 )return invalid('D369_SAMPLE_INVALID');

 const byte=parseInt(text,16);
 const candidates=[];

 for(const r of evidence.runtimeSymbolicWriteRequirements){
  if(candidates.length>=8)break;

  if(
   r?.reason!==
    'LIVE_RAM_REQUIRED_FOR_SYMBOLIC_WRAM_WRITE_TARGET'||
   r.sourceAddress!==0xd369||
   r.sourceAddend!==6||
   r.baseCpuAddress!==0xc6e8||
   !Number.isInteger(r.instructionOffset)||
   !Number.isInteger(r.loopIterations)||
   r.loopIterations<0||r.loopIterations>255||
   !Number.isInteger(r.symbolicMultiplier)||
   r.symbolicMultiplier!==3+r.loopIterations||
   r.fixedAddend!==3||
   !Number.isInteger(r.finalBC)||
   r.finalBC<0||r.finalBC>255||
   r.candidateCount!==256||
   !Number.isInteger(r.candidateMin)||
   !Number.isInteger(r.candidateMax)||
   r.candidateMin<0xc000||
   r.candidateMax>=0xe000||
   r.candidateMin>r.candidateMax||
   r.memoryRegion!=='WRAM'||
   !(r.targetValue===null||
     Number.isInteger(r.targetValue))||
   r.runtimeRamReadObserved!==false||
   r.targetAddressObserved!==false||
   r.memoryWriteObserved!==false||
   r.gameplayExecutionObserved!==false||
   r.gameEventCompleted!==false
  )continue;

  const sourceAdjusted=
   (byte+r.sourceAddend)&255;

  const address=(
   r.baseCpuAddress+
   r.symbolicMultiplier*sourceAdjusted+
   r.fixedAddend+r.finalBC
  )&65535;

  if(
   address<0xc000||address>=0xe000||
   address<r.candidateMin||
   address>r.candidateMax
  )continue;

  candidates.push({
   sourceAddress:0xd369,
   sourceByte:byte,
   instructionOffset:r.instructionOffset,
   loopIterations:r.loopIterations,
   multiplier:r.symbolicMultiplier,
   finalBC:r.finalBC,
   candidateAddress:address,
   candidateMin:r.candidateMin,
   candidateMax:r.candidateMax,
   conditionalPathRequirements:
    r.conditionalPathRequirements,
   sourceReadObserved:true,
   candidateFormulaVerified:true,
   targetAddressObserved:false,
   memoryWriteObserved:false,
   gameplayExecutionObserved:false,
   gameEventCompleted:false
  });
 }

 if(!candidates.length)
  return invalid('NO_VALID_SYMBOLIC_WRAM_TARGET');

 return {
  verified:true,
  source:SOURCE,
  romSha256,
  mapId,
  sourceAddress:0xd369,
  sourceReadBlock:'PLAYER_D158',
  sourceByte:byte,
  candidateTargets:candidates,
  additionalUdpRequests:0,
  sourceReadObserved:true,
  publicationPositionVerified:false,
  atomicSnapshotVerified:false,
  targetAddressObserved:false,
  memoryWriteObserved:false,
  gameplayExecutionObserved:false,
  gameEventCompleted:false
 };
}

module.exports={selectSymbolicWramTargets};