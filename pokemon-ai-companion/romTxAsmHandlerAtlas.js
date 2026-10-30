'use strict';
// Per-TX_ASM entry: bounded, bank-local LR35902 candidate instruction graph.
// This never infers game effects. Calls, bank switching, RAM computed jumps,
// flags, branches and completed player actions remain UNKNOWN.
const {decodeOpcode}=require('./romMapCodeAtlas');
const BANK=0x4000,ROM_BYTES=1048576;
function fail(reason){return {verified:false,reason,source:'ROM_TX_ASM_LOCAL_CODE_CANDIDATES',
 scriptEffectsVerified:false,conditionsVerified:false,executed:false};}
function inspectTxAsmHandler({rom,fileOffset,maxInstructions=64}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_BYTES||
  !Number.isInteger(fileOffset)||fileOffset<0||fileOffset>=ROM_BYTES||
  !Number.isInteger(maxInstructions)||maxInstructions<1||maxInstructions>256)
  return fail('Parametros ou ROM de 1MiB invalidos');
 const bank=Math.floor(fileOffset/BANK),limit=(bank+1)*BANK;
 if(rom[fileOffset]!==0x08)return fail('Destino nao comeca com TX_ASM');
 if(fileOffset+1>=limit)return fail('TX_ASM no limite de banco sem primeiro opcode');
 const startOffset=fileOffset+1;
 const rootCpu=bank===0?startOffset:0x4000+(startOffset-bank*BANK);
 const queue=[rootCpu],queued=new Set([rootCpu]),visited=new Set();
 const record=[],unresolved=[],callTargets=[],edges=[];
 let branchCount=0,conditionalReturnCount=0,returnsObserved=0,
  invalidOpcodes=0,indirectTransfers=0;
 const toOffset=pc=>{
  if(!Number.isInteger(pc)||pc<0||pc>=0x8000)return null;
  if(bank===0)return pc<BANK?pc:null;
  if(pc>=BANK)return bank*BANK+pc-BANK;
  // Fixed ROM0 is real ROM data, but not part of this local handler graph.
  return null;
 };
 while(queue.length&&record.length<maxInstructions){
  const pc=queue.shift();const at=toOffset(pc);
  if(at===null||at<bank*BANK||at>=limit||visited.has(at))continue;
  visited.add(at);
  const d=decodeOpcode(rom,bank,pc);
  if(!d.ok){
   invalidOpcodes++;
   unresolved.push({from:at,target:null,reason:d.reason});
   continue;
  }
  record.push({offset:at,cpu:pc,opcode:d.opcode,size:d.size,kind:d.kind});
  if(d.kind==='branch')branchCount++;
  if(d.kind==='conditional-return')conditionalReturnCount++;
  if(d.kind==='return')returnsObserved++;
  if(d.kind==='indirect'){
   indirectTransfers++;
   unresolved.push({from:at,target:null,reason:'INDIRECT_JP_HL'});
  }
  for(const edge of d.targets){
   const target=toOffset(edge.pc);
   if(edge.kind==='call'||edge.kind==='restart'){
    callTargets.push({from:at,cpu:edge.pc,
     mapping:edge.pc<BANK?'ROM0_FIXED':'ROM_BANK_NOT_STATEMENT_VERIFIED'});
    // Never follow the call: the handler can change the active MBC bank.
    continue;
   }
   if(target===null||target<bank*BANK||target>=limit){
    unresolved.push({from:at,targetCpu:edge.pc,reason:
     edge.pc<BANK&&bank>0?'ROM0_OUTSIDE_LOCAL_GRAPH':
     'CROSS_BANK_OR_UNMAPPED_BRANCH'});
    continue;
   }
   edges.push({from:at,to:target,kind:edge.kind});
   if(!visited.has(target)&&!queued.has(edge.pc)){
    queued.add(edge.pc);
    queue.push(edge.pc);
   }
  }
 }
 const limitReached=queue.length>0;
 const reasons={};
 for(const u of unresolved)reasons[u.reason]=(reasons[u.reason]||0)+1;
 const callClasses={};
 for(const c of callTargets)callClasses[c.mapping]=(callClasses[c.mapping]||0)+1;
 const rom0BranchTargetCpus=[...new Set(unresolved.filter(u=>
  u.reason==='ROM0_OUTSIDE_LOCAL_GRAPH'&&
  Number.isInteger(u.targetCpu)&&u.targetCpu>=0&&u.targetCpu<0x4000)
  .map(u=>u.targetCpu))].sort((a,b)=>a-b);
 const rom0BranchTargetOccurrences=unresolved.filter(u=>
  u.reason==='ROM0_OUTSIDE_LOCAL_GRAPH').length;
 const instructionBytes=record.reduce((n,r)=>n+r.size,0);
 return {verified:true,bank,txAsmFileOffset:fileOffset,
  handlerStartOffset:startOffset,cpu:rootCpu,
  initialOpcode:rom[startOffset],opcodeCandidateCount:record.length,
  instructionCandidateBytes:instructionBytes,
  localEdgeCount:edges.length,branchCount,conditionalReturnCount,
  returnsObserved,invalidOpcodes,indirectTransfers,
  callsNotFollowed:callTargets.length,
  unresolvedBranchTargets:unresolved.length,
  unresolvedReasonCounts:reasons,callClassCounts:callClasses,
  rom0BranchTargetCpus,rom0BranchTargetOccurrences,
  rom0PhysicalAddressOnly:true,
  limitReached,queueRemaining:queue.length,
  sampledOpcodes:record.slice(0,6),
  callTargets:callTargets.slice(0,12),
  unresolved:unresolved.slice(0,12),
  source:'ROM_TX_ASM_LOCAL_CODE_CANDIDATES',
  scriptEffectsVerified:false,conditionsVerified:false,executed:false,
  semantic100PercentCertified:false,
  warning:'Opcode candidates and local edges only; no call/branch execution, RAM conditions or effects proven'};
}
// Escalate only handlers where the original 64-instruction scan actually
// exhausts its budget. A larger *candidate scan* is not a proof of execution.
// Never follow CALL/RST, infer an active MBC bank or mark effects as known.
function inspectTxAsmHandlerAdaptive({
 rom,fileOffset,initialBudget=64,deepBudget=256
}={}){
 if(!Number.isInteger(initialBudget)||!Number.isInteger(deepBudget)||
    initialBudget<1||deepBudget<=initialBudget||deepBudget>256)
  return fail('Orcamentos de analise invalidados');
 const baseline=inspectTxAsmHandler({rom,fileOffset,maxInstructions:initialBudget});
 if(baseline.verified!==true)return baseline;
 const escalate=baseline.limitReached===true;
 const advanced=escalate?
  inspectTxAsmHandler({rom,fileOffset,maxInstructions:deepBudget}):baseline;
 if(advanced.verified!==true)return advanced;
 // Deepening a candidate graph must never silently discard earlier evidence.
 if(advanced.opcodeCandidateCount<baseline.opcodeCandidateCount||
    advanced.callsNotFollowed<baseline.callsNotFollowed||
    advanced.unresolvedBranchTargets<baseline.unresolvedBranchTargets)
  return fail('Analise alargada contradiz o primeiro limite');
 return {...advanced,initialBudget,maxInstructionsBudget:
   escalate?deepBudget:initialBudget,
  candidateExpansionApplied:escalate,
  firstPassLimitReached:baseline.limitReached,
  firstPassCandidateInstructions:baseline.opcodeCandidateCount,
  additionalCandidateInstructions:
   advanced.opcodeCandidateCount-baseline.opcodeCandidateCount,
  residualLimitReached:advanced.limitReached,
  effectInterpretationStillRequired:true,
  source:'ROM_TX_ASM_ADAPTIVE_BANK_LOCAL_CANDIDATES',
  scriptEffectsVerified:false,conditionsVerified:false,executed:false,
  semantic100PercentCertified:false};
}
module.exports={inspectTxAsmHandler,inspectTxAsmHandlerAdaptive};
