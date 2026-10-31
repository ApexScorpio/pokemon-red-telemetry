'use strict';
// Reconcile deeper ROMX static candidate graphs with a previously certified
// 48 -> 128 expansion; never classify any path as game execution.
const {auditMbc3RomxBoundedGraph}=require('./romMbc3RomxBoundedGraph');
const LEVELS=Object.freeze([128,256,512,1024]);
function invalid(reason){
 return {verified:false,reason,deepestBudget:0,
  candidateInstructionsAtDeepest:0,executedInstructions:0,
  activeBankVerified:false,semantic100PercentCertified:false};
}
function auditMbc3RomxDepthSweep({rom,scenarioAtlas,expansion}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    scenarioAtlas?.verified!==true||
    expansion?.verified!==true||
    expansion.extendedBudget!==128||
    expansion.baselineBudget!==48||
    expansion.executedInstructions!==0||
    expansion.activeBankVerified!==false||
    !Array.isArray(expansion.comparisons)||
    expansion.entriesCompared!==expansion.comparisons.length||
    expansion.extendedInstructions<expansion.baselineInstructions)
  return invalid('Certified 48 to 128 static expansion required');
 const graphs=[];
 for(const level of LEVELS){
  const g=auditMbc3RomxBoundedGraph({
   rom,scenarioAtlas,maxInstructionsPerEntrypoint:level});
  if(!g.verified||g.executedInstructions!==0||
     g.activeBankVerified!==false||
     g.runtimeControlFlowVerified!==false||
     g.entryResults.length!==expansion.entriesCompared)
   return invalid('ROMX graph failed at depth '+level);
  graphs.push(g);
 }
 const first=graphs[0],last=graphs.at(-1);
 if(first.totalDecodedCandidateInstructions!==expansion.extendedInstructions||
    first.entrypointsBudgetExhausted!==expansion.extendedExhaustedEntries||
    first.nonDecodableEntrypoints!==expansion.nonDecodableEntrypoints)
  return invalid('Depth 128 sweep does not match earlier certified expansion');
 const comparisons=[],levels=[];
 for(let i=0;i<first.entryResults.length;i++){
  const initial=first.entryResults[i];
  const older=expansion.comparisons[i];
  if(initial.bank!==older.bank||
     initial.entryCpu!==older.entryCpu||
     initial.fileOffset!==older.physicalFileOffset||
     initial.decodedCandidateInstructions!==older.decoded128||
     initial.budgetExhausted!==older.budget128Exhausted)
   return invalid('Provenance mismatch for depth 128 entry');
  let previous=initial;
  const entries=[initial];
  for(let depth=1;depth<graphs.length;depth++){
   const current=graphs[depth].entryResults[i];
   const errorSum=e=>Object.values(e.decodeFailureCounts)
    .reduce((a,b)=>a+b,0);
   if(current.bank!==initial.bank||
      current.entryCpu!==initial.entryCpu||
      current.fileOffset!==initial.fileOffset||
      current.firstOpcodeDecodable!==initial.firstOpcodeDecodable||
      current.decodedCandidateInstructions<
       previous.decodedCandidateInstructions||
      current.decodedCandidateInstructions>LEVELS[depth]||
      current.budgetExhausted&&!previous.budgetExhausted||
      errorSum(current)<errorSum(previous)||
      current.runtimeExecuted!==false||
      current.activeBankVerified!==false||
      current.codeReachabilityRuntimeVerified!==false)
    return invalid('Nonmonotonic or ungrounded ROMX entry at depth '+LEVELS[depth]);
   entries.push(current);
   previous=current;
  }
  const d=entries.map(x=>x.decodedCandidateInstructions);
  const capped=entries.map(x=>x.budgetExhausted);
  const errors=entries.map(x=>Object.values(x.decodeFailureCounts)
   .reduce((a,b)=>a+b,0));
  comparisons.push({
   bank:initial.bank,entryCpu:initial.entryCpu,
   physicalFileOffset:initial.fileOffset,
   firstOpcodeDecodable:initial.firstOpcodeDecodable,
   decodedByDepth:d,addedBeyond128:d[3]-d[0],
   budgetExhaustedByDepth:capped,decoderFailuresByDepth:errors,
   branchesToRom0NotFollowedAt1024:entries[3].branchesToROM0NotFollowed,
   pendingStaticEdgesAt1024:entries[3].pendingStaticEdges,
   frontierUniquePendingAt1024:entries[3].frontierPendingUniqueCount,
   frontierTargetsAt1024:entries[3].frontierTargets,
   deeperDecodeFailureSamples:entries[3].decodeFailureSamples,
   executed:false,activeBankVerified:false,causalLinkVerified:false
  });
 }
 for(let i=0;i<graphs.length;i++){
  const graph=graphs[i];
  const previous=i?graphs[i-1]:null;
  if(previous&&(
   graph.totalDecodedCandidateInstructions<previous.totalDecodedCandidateInstructions||
   graph.entrypointsBudgetExhausted>previous.entrypointsBudgetExhausted||
   graph.nonDecodableEntrypoints!==first.nonDecodableEntrypoints))
   return invalid('Nonmonotonic aggregate graph');
  levels.push({instructionBudget:LEVELS[i],
   candidateInstructions:graph.totalDecodedCandidateInstructions,
   addedSincePrevious:i?
    graph.totalDecodedCandidateInstructions-previous.totalDecodedCandidateInstructions:0,
   budgetExhaustedEntries:graph.entrypointsBudgetExhausted,
   entriesWithoutBudgetExhaustion:
    graph.uniquePhysicalEntrypoints-graph.entrypointsBudgetExhausted,
   entriesWithDecodeFailures:graph.entrypointsWithDecodeFailures,
   branchesToRom0NotFollowed:graph.totalBranchesToRom0NotFollowed,
   pendingStaticEdges:graph.totalPendingEdges});
 }
 const delta=last.totalDecodedCandidateInstructions-first.totalDecodedCandidateInstructions;
 if(delta!==comparisons.reduce((sum,row)=>sum+row.addedBeyond128,0))
  return invalid('Per-entry ROMX gains do not reconcile');
 return {verified:true,source:'MBC3_ROMX_DEPTH_128_256_512_1024_V1',
  levels,uniquePhysicalEntrypoints:first.uniquePhysicalEntrypoints,
  deepestBudget:1024,
  candidateInstructionsAtDeepest:last.totalDecodedCandidateInstructions,
  additionalCandidatesBeyond128:delta,
  entriesStillBudgetExhausted:last.entrypointsBudgetExhausted,
  entriesUncappedAt1024:
   last.uniquePhysicalEntrypoints-last.entrypointsBudgetExhausted,
  entriesThatExitedBudgetSince128:
   first.entrypointsBudgetExhausted-last.entrypointsBudgetExhausted,
  nonDecodableEntrypoints:last.nonDecodableEntrypoints,
  comparisons,executedInstructions:0,activeBankVerified:false,
  causalLinksVerified:0,semantic100PercentCertified:false,
  warning:'Depth sweep over conditional static ROMX bytes. An uncapped entry, decodeable opcode or branch does not prove runtime reachability or selected bank.'};
}
module.exports={auditMbc3RomxDepthSweep};
