'use strict';
// Two unresolved world trainer events: physical TX_START_ASM handler provenance.
// This is static ROM evidence, never confirmation of a game action, event-bit
// mutation, current bank or trainer victory.
const crypto=require('node:crypto');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {auditUnboundTrainerScripts}=require('./romUnboundTrainerScripts');
const {inspectTxAsmHandlerAdaptive}=require('./romTxAsmHandlerAtlas');
const ROM_BYTES=1048576,BANK_SIZE=0x4000;
function failure(reason){
 return {verified:false,reason,handlers:[],
  eventBitsRecovered:0,handlerEffectsVerified:false,
  victoriesObserved:0};
}
function readPhysicalHandlerWindow({rom,fileOffset,length=32}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_BYTES||
  !Number.isInteger(fileOffset)||fileOffset<0||fileOffset>=ROM_BYTES||
  !Number.isInteger(length)||length<1||length>64)
  return {verified:false,reason:'Invalid ROM, offset or window'};
 const bank=Math.floor(fileOffset/BANK_SIZE);
 const bankEnd=(bank+1)*BANK_SIZE;
 if(rom[fileOffset]!==0x08||fileOffset+1>=bankEnd)
  return {verified:false,reason:'Missing TX_START_ASM opcode or bank overflow'};
 const data=rom.subarray(fileOffset,Math.min(fileOffset+length,bankEnd));
 const cpu=bank===0?fileOffset:0x4000+fileOffset-bank*BANK_SIZE;
 return {verified:true,bank,cpu,txAsmFileOffset:fileOffset,
  handlerStartFileOffset:fileOffset+1,
  handlerStartCpu:cpu+1,
  txAsmByte:rom[fileOffset],
  firstHandlerByte:rom[fileOffset+1],
  bytesSampled:data.length,
  sampledBytesHex:data.toString('hex'),
  sampledWithinBank:true};
}
function auditUnboundTrainerHandlerContext({rom,scriptAtlas}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_BYTES||
  scriptAtlas?.verified!==true)
  return failure('A verified ROM and script atlas are required');
 const sha=crypto.createHash('sha256').update(rom).digest('hex');
 if(!isKnownAuditedRomSha(sha)||scriptAtlas.romSha256!==sha)
  return failure('Physical ROM does not match pinned script atlas identity');
 const unbound=auditUnboundTrainerScripts({scriptAtlas});
 if(unbound.verified!==true||unbound.unresolvedCount!==2||
    unbound.eventBitsRecovered!==0)
  return failure('Two physical trainer scripts must be confirmed: '+unbound.reason);
 const handlers=[];
 for(const entry of unbound.entries){
  const window=readPhysicalHandlerWindow({rom,fileOffset:entry.scriptFileOffset});
  if(window.verified!==true||window.cpu!==entry.textPointerCpu||
     entry.scriptCommand!=='TX_START_ASM'||
     entry.scriptDispatchClass!=='ASM_HANDLER'||
     entry.handlerCandidateAvailable!==true||
     entry.dispatchOpcodePhysicallyVerified!==true)
   return failure('TX_ASM opcode and ROM pointer conflict at map '+entry.mapId);
  const handler=inspectTxAsmHandlerAdaptive({
   rom,fileOffset:entry.scriptFileOffset});
  if(handler.verified!==true||
     handler.txAsmFileOffset!==entry.scriptFileOffset||
     handler.bank!==window.bank||
     handler.cpu!==window.handlerStartCpu||
     handler.handlerStartOffset!==window.handlerStartFileOffset||
     handler.initialOpcode!==window.firstHandlerByte||
     handler.opcodeCandidateCount!==entry.handlerCandidateInstructionCount||
     handler.executed!==false||handler.scriptEffectsVerified!==false||
     handler.conditionsVerified!==false||
     !Array.isArray(handler.absoluteMemoryOperands)||
     !Array.isArray(handler.adjacentRomFlagBitPatterns))
   return failure('Independent handler graph does not match script atlas');
  const flagRegionOperands=handler.absoluteMemoryOperands.filter(x=>
   x.operandAddress>=0xd747&&x.operandAddress<=0xd886);
  const observedByteAccesses=flagRegionOperands.map(x=>({
   instructionFileOffset:x.sourceFileOffset,
   opcode:x.opcode,address:x.operandAddress,
   operationKind:x.kind,
   directMemoryAccess:x.directMemoryAccess,
   directWramReadCandidate:x.directWramReadCandidate,
   directWramWriteCandidate:x.directWramWriteCandidate,
   pointerConstantOnly:x.pointerConstantOnly,
   instructionExecuted:false,memoryEffectVerified:false
  }));
  if(flagRegionOperands.some(x=>
    x.instructionExecuted!==false||
    x.actualMemoryEffectVerified!==false||
    x.operandAddress<0xd747||x.operandAddress>0xd886))
   return failure('Fabricated event-flag operand execution');
  handlers.push({
   mapId:entry.mapId,referenceMapName:entry.referenceMapName,
   ordinal:entry.ordinal,x:entry.x,y:entry.y,
   trainerClassId:entry.trainerClassId,
   trainerNumber:entry.trainerNumber,
   ...window,
   opcodeCandidateCount:handler.opcodeCandidateCount,
   firstPassCandidateInstructions:handler.firstPassCandidateInstructions,
   candidateExpansionApplied:handler.candidateExpansionApplied,
   initialBudget:handler.initialBudget,
   maxInstructionsBudget:handler.maxInstructionsBudget,
   residualLimitReached:handler.residualLimitReached,
   candidateBranches:handler.branchCount,
   candidateCallsNotFollowed:handler.callsNotFollowed,
   candidateRom0CallTargets:handler.rom0CallTargetCpus,
   candidateRom0BranchTargets:handler.rom0BranchTargetCpus,
   unresolvedReasonCounts:handler.unresolvedReasonCounts,
   unresolvedBranchTargets:handler.unresolvedBranchTargets,
   absoluteMemoryOperandCount:handler.absoluteMemoryOperandCount,
   directWramReadCandidates:handler.directWramReadCandidateCount,
   directWramWriteCandidates:handler.directWramWriteCandidateCount,
   flagRegionOperandCandidates:observedByteAccesses,
   adjacentRomFlagBitPatterns:handler.adjacentRomFlagBitPatterns,
   adjacentRomFlagBitTestCandidates:handler.adjacentRomFlagBitTests,
   adjacentRomFlagSetCandidates:handler.adjacentRomFlagBitSetCandidates,
   adjacentRomFlagResetCandidates:handler.adjacentRomFlagBitResetCandidates,
   handlerRuntimeExecuted:false,
   eventFlagBitIndex:null,eventBitRecovered:false,
   handlerEffectsVerified:false,trainerVictoryObserved:null,
   warning:'Instructions and memory operands are static candidates, and calls are not followed.'
  });
 }
 if(handlers.length!==2||
    handlers.some(x=>x.eventBitRecovered||x.handlerRuntimeExecuted))
  return failure('Unbound physical handler cardinality or provenance invalid');
 return {verified:true,romSha256:sha,
  source:'PHYSICAL_SHA_VERIFIED_UNBOUND_TX_ASM_HANDLERS_V1',
  handlers,handlerCount:handlers.length,
  candidateInstructionsTotal:handlers.reduce((sum,x)=>
   sum+x.opcodeCandidateCount,0),
  callsNotFollowedTotal:handlers.reduce((sum,x)=>
   sum+x.candidateCallsNotFollowed,0),
  eventRegionOperandCandidatesTotal:handlers.reduce((sum,x)=>
   sum+x.flagRegionOperandCandidates.length,0),
  adjacentBitPatternCandidatesTotal:handlers.reduce((sum,x)=>
   sum+x.adjacentRomFlagBitPatterns.length,0),
  eventBitsRecovered:0,handlerEffectsVerified:false,
  victoriesObserved:0,activeBanksRuntimeVerified:false,
  gameComplete:false,
  warning:'ROM physical handler bytecode only. Event bit, ASM execution and trainer victory remain unverified.'};
}
module.exports={readPhysicalHandlerWindow,auditUnboundTrainerHandlerContext};
