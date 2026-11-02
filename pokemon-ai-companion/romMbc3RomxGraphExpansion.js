'use strict';
// Escalate previously certified static ROMX entry graphs from 48 to 128
// instructions without assuming the selected MBC3 bank or runtime execution.
const {auditMbc3RomxBoundedGraph}=require('./romMbc3RomxBoundedGraph');
const reject=reason=>({verified:false,reason,
 entriesCompared:0,addedCandidateInstructions:0,
 activeBankVerified:false,executedInstructions:0});
function auditMbc3RomxGraphExpansion({rom,scenarioAtlas,baselineGraph}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    !baselineGraph||baselineGraph.verified!==true||
    baselineGraph.maxInstructionsPerEntrypoint!==48||
    baselineGraph.activeBankVerified!==false||
    baselineGraph.executedInstructions!==0||
    !Array.isArray(baselineGraph.entryResults)||
    baselineGraph.entryResults.length!==baselineGraph.uniquePhysicalEntrypoints||
    scenarioAtlas?.verified!==true||
    baselineGraph.inputScenarioCount!==scenarioAtlas.scenarioCount)
  return reject('Certified 48-instruction graph and identical static ROM required');
 // Recompute the baseline from ROM data to prevent arbitrary "gains" against
 // a fabricated or different baseline supplied by a caller.
 const confirmed=auditMbc3RomxBoundedGraph({
  rom,scenarioAtlas,maxInstructionsPerEntrypoint:48});
 const extended=auditMbc3RomxBoundedGraph({
  rom,scenarioAtlas,maxInstructionsPerEntrypoint:128});
 if(!confirmed.verified||!extended.verified||
    confirmed.uniquePhysicalEntrypoints!==extended.uniquePhysicalEntrypoints||
    confirmed.uniquePhysicalEntrypoints!==baselineGraph.uniquePhysicalEntrypoints||
    confirmed.totalDecodedCandidateInstructions!==
      baselineGraph.totalDecodedCandidateInstructions||
    confirmed.entrypointsBudgetExhausted!==baselineGraph.entrypointsBudgetExhausted)
  return reject('Static baseline does not match ROM or extension failed');
 const comparisons=[];
 let gain=0,resolved=0,remaining=0,newFailures=0;
 for(let i=0;i<confirmed.entryResults.length;i++){
  const before=confirmed.entryResults[i];
  const declared=baselineGraph.entryResults[i];
  const after=extended.entryResults[i];
  if(before.bank!==after.bank||before.entryCpu!==after.entryCpu||
     before.fileOffset!==after.fileOffset||
     before.bank!==declared.bank||before.entryCpu!==declared.entryCpu||
     before.decodedCandidateInstructions!==declared.decodedCandidateInstructions||
     before.budgetExhausted!==declared.budgetExhausted||
     before.firstOpcodeDecodable!==declared.firstOpcodeDecodable||
     after.decodedCandidateInstructions<before.decodedCandidateInstructions||
     after.firstOpcodeDecodable!==before.firstOpcodeDecodable||
     after.runtimeExecuted!==false||after.activeBankVerified!==false)
   return reject('Graph entry mismatch or regressing conditional coverage');
  const added=after.decodedCandidateInstructions-before.decodedCandidateInstructions;
  const beforeErrors=Object.values(before.decodeFailureCounts).reduce((a,b)=>a+b,0);
  const afterErrors=Object.values(after.decodeFailureCounts).reduce((a,b)=>a+b,0);
  if(afterErrors<beforeErrors)return reject('Decoder errors unexpectedly disappear');
  gain+=added;
  if(before.budgetExhausted&&!after.budgetExhausted)resolved++;
  if(after.budgetExhausted)remaining++;
  if(beforeErrors===0&&afterErrors>0)newFailures++;
  comparisons.push({
   bank:before.bank,entryCpu:before.entryCpu,
   physicalFileOffset:before.fileOffset,
   firstOpcodeDecodable:before.firstOpcodeDecodable,
   decoded48:before.decodedCandidateInstructions,
   decoded128:after.decodedCandidateInstructions,
   addedCandidateInstructions:added,
   budget48Exhausted:before.budgetExhausted,
   budget128Exhausted:after.budgetExhausted,
   decoderFailures48:beforeErrors,decoderFailures128:afterErrors,
   branchesToRom0NotFollowed48:before.branchesToROM0NotFollowed,
   branchesToRom0NotFollowed128:after.branchesToROM0NotFollowed,
   unresolvedStaticEdges128:after.pendingStaticEdges,
   runtimeExecuted:false,activeBankVerified:false,causalLinkVerified:false
  });
 }
 if(gain!==extended.totalDecodedCandidateInstructions-
   confirmed.totalDecodedCandidateInstructions||
   remaining>confirmed.entrypointsBudgetExhausted)
  return reject('Expansion summary mismatch');
 return {verified:true,source:'MBC3_ROMX_GRAPH_48_TO_128_STATIC_AUDIT_V1',
  entriesCompared:comparisons.length,
  baselineBudget:48,extendedBudget:128,
  baselineInstructions:confirmed.totalDecodedCandidateInstructions,
  extendedInstructions:extended.totalDecodedCandidateInstructions,
  addedCandidateInstructions:gain,
  baselineExhaustedEntries:confirmed.entrypointsBudgetExhausted,
  extendedExhaustedEntries:extended.entrypointsBudgetExhausted,
  previouslyExhaustedNowTerminated:resolved,
  newDecodeFailureEntries:newFailures,
  extendedEntriesWithDecoderFailures:extended.entrypointsWithDecodeFailures,
  extendedBranchesToRom0NotFollowed:extended.totalBranchesToRom0NotFollowed,
  nonDecodableEntrypoints:extended.nonDecodableEntrypoints,
  comparisons,executedInstructions:0,activeBankVerified:false,
  causalLinksVerified:0,gameplayCoverageComplete:false,
  warning:'Static candidate budget increase; decoded instructions, completed budgets and same-bank edges do not prove actual runtime paths or bank changes.'};
}
module.exports={auditMbc3RomxGraphExpansion};
