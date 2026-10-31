'use strict';
// Explore bounded Game Boy ROMX instruction candidates from physical ROM bytes.
// A legal opcode, static edge or bounded graph is NOT runtime execution evidence.
const {decodeOpcode}=require('./romMapCodeAtlas');
const BYTES=1048576,BANK_BYTES=0x4000;
const bad=reason=>({verified:false,reason,uniquePhysicalEntrypoints:0,
 entryResults:[],totalDecodedCandidateInstructions:0,
 executedInstructions:0,activeBankVerified:false});
function auditMbc3RomxBoundedGraph({
 rom,scenarioAtlas,maxInstructionsPerEntrypoint=48
}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==BYTES||
    ![0x0f,0x10,0x11,0x12,0x13].includes(rom[0x147])||
    rom[0x148]!==5||scenarioAtlas?.verified!==true||
    !Array.isArray(scenarioAtlas.scenarios)||
    scenarioAtlas.scenarioCount!==scenarioAtlas.scenarios.length||
    scenarioAtlas.scenarios.length>4096||
    scenarioAtlas.activeBanksVerified!==0||
    scenarioAtlas.executedTransfers!==0||
    !Number.isInteger(maxInstructionsPerEntrypoint)||
    maxInstructionsPerEntrypoint<1||maxInstructionsPerEntrypoint>1024)
  return bad('Bounded ROMX static scenario inventory required');
 const unique=new Map(),result=[];
 for(const site of scenarioAtlas.scenarios){
  const b=site?.candidateBankIfExecuted,pc=site?.romxTargetCpu;
  if(!Number.isInteger(b)||b<1||b>=64||
     !Number.isInteger(pc)||pc<0x4000||pc>=0x8000||
     site.physicalFileOffset!==b*BANK_BYTES+pc-0x4000||
     site.physicalFirstOpcodeByte!==rom[site.physicalFileOffset]||
     site.executed===true||site.bankWriteExecuted!==false||
     site.transferExecuted!==false||site.activeBankVerified!==false||
     site.causalLinkVerified!==false)
   return bad('Ungrounded scenario or invented executed transfer');
  const id=b+':'+pc;
  if(!unique.has(id))unique.set(id,{bank:b,entryCpu:pc,
   fileOffset:site.physicalFileOffset});
 }
 for(const entry of unique.values()){
  const pending=[entry.entryCpu],seen=new Set(),issues=[];
  let cursor=0,decoded=0,branchWithinBank=0,branchToROM0=0;
  let otherTargets=0,bytesOfCandidateCode=0,cyclesPrevented=0;
  const kindCounts=Object.create(null),decodeFailures=Object.create(null);
  while(cursor<pending.length&&decoded<maxInstructionsPerEntrypoint){
   const pc=pending[cursor++];
   if(seen.has(pc)){cyclesPrevented++;continue;}
   seen.add(pc);
   if(pc<0x4000||pc>=0x8000){
    return bad('Unexpected pending CPU address outside ROMX');
   }
   const d=decodeOpcode(rom,entry.bank,pc);
   if(d.ok!==true){
    const reason=d.reason||'UNKNOWN';
    decodeFailures[reason]=(decodeFailures[reason]||0)+1;
    issues.push({cpuPc:pc,reason,opcode:d.opcode??null,
     fileOffset:d.at??(entry.bank*BANK_BYTES+pc-0x4000)});
    continue;
   }
   decoded++;bytesOfCandidateCode+=d.size;
   kindCounts[d.kind]=(kindCounts[d.kind]||0)+1;
   for(const edge of d.targets){
    const dest=edge.pc;
    if(!Number.isInteger(dest)||dest<0||dest>=0x10000){
     otherTargets++;continue;
    }
    if(dest<0x4000){branchToROM0++;continue;}
    if(dest>=0x8000){otherTargets++;continue;}
    branchWithinBank++;
    // The bank is conditionally held constant; any intervening bank switch
    // is unknown. Never infer a causal active ROMX-bank guarantee.
    if(!seen.has(dest))pending.push(dest);
   }
  }
  const first=decodeOpcode(rom,entry.bank,entry.entryCpu);
  const pendingUnseen=[...new Set(pending.slice(cursor).filter(pc=>!seen.has(pc)))];
  const budgetExhausted=decoded>=maxInstructionsPerEntrypoint&&
   pendingUnseen.length>0;
  const frontierTargets=budgetExhausted?pendingUnseen.map(cpuPc=>{
   const fileOffset=entry.bank*BANK_BYTES+cpuPc-0x4000;
   const window=rom.subarray(fileOffset,
    Math.min(fileOffset+16,(entry.bank+1)*BANK_BYTES));
   const bytes=Array.from(window);
   const firstNonNOP=bytes.findIndex(byte=>byte!==0);
   const decodedFirst=decodeOpcode(rom,entry.bank,cpuPc);
   const bankEnd=(entry.bank+1)*BANK_BYTES;
   let firstNonzeroOffset=fileOffset;
   while(firstNonzeroOffset<bankEnd&&rom[firstNonzeroOffset]===0)
    firstNonzeroOffset++;
   const zeroRunLength=firstNonzeroOffset-fileOffset;
   return {cpuPc,fileOffset,firstByte:rom[fileOffset],
    rawWindowHex:bytes.map(byte=>byte.toString(16).padStart(2,'0')).join(''),
    leadingNopBytesInWindow:firstNonNOP<0?bytes.length:firstNonNOP,
    zeroRunLengthToNonzeroOrBankEnd:zeroRunLength,
    zeroRunEndCpuExclusive:cpuPc+zeroRunLength,
    zeroRunReachesBankEnd:zeroRunLength>0&&firstNonzeroOffset===bankEnd,
    firstNonzeroByteAfterRun:firstNonzeroOffset<bankEnd?
     rom[firstNonzeroOffset]:null,
    firstOpcodeDecodable:decodedFirst.ok===true,
    firstDecodeReason:decodedFirst.ok?null:decodedFirst.reason};
  }):[];
  result.push({...entry,
   firstOpcodeDecodable:first.ok===true,
   firstOpcode:rom[entry.fileOffset],
   firstDecodeReason:first.ok?null:first.reason,
   decodedCandidateInstructions:decoded,
   candidateInstructionBytes:bytesOfCandidateCode,
   distinctCpuInstructionStarts:seen.size,
   pendingStaticEdges:pending.length-cursor,
   frontierPendingUniqueCount:budgetExhausted?pendingUnseen.length:0,
   frontierTargets,budgetExhausted,cyclesPrevented,
   branchWithinSameBankCandidates:branchWithinBank,
   branchesToROM0NotFollowed:branchToROM0,
   otherTargetsNotFollowed:otherTargets,
   instructionKindCounts:{...kindCounts},
   decodeFailureCounts:{...decodeFailures},
   decodeFailureSamples:issues.slice(0,8),
   runtimeExecuted:false,activeBankVerified:false,
   codeReachabilityRuntimeVerified:false});
 }
 const total=result.reduce((n,x)=>n+x.decodedCandidateInstructions,0);
 return {verified:true,source:'ROMX_BOUNDED_STATIC_BANK_GRAPH_V1',
  inputScenarioCount:scenarioAtlas.scenarioCount,
  uniquePhysicalEntrypoints:result.length,
  entryResults:result,
  maxInstructionsPerEntrypoint,
  totalDecodedCandidateInstructions:total,
  nonDecodableEntrypoints:result.filter(x=>!x.firstOpcodeDecodable).length,
  entrypointsWithDecodeFailures:result.filter(x=>
   Object.keys(x.decodeFailureCounts).length>0).length,
  entrypointsBudgetExhausted:result.filter(x=>x.budgetExhausted).length,
  totalBranchesToRom0NotFollowed:result.reduce((n,x)=>
   n+x.branchesToROM0NotFollowed,0),
  totalPendingEdges:result.reduce((n,x)=>n+x.pendingStaticEdges,0),
  executedInstructions:0,activeBankVerified:false,
  runtimeControlFlowVerified:false,semantic100PercentCertified:false,
  warning:'Bounded static candidate graph only. Every physical bank scenario remains conditional; no ROMX execution or state mutation is inferred.'};
}
module.exports={auditMbc3RomxBoundedGraph};
