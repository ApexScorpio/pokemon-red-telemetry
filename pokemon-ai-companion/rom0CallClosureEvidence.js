'use strict';
// ROM0 interprocedural candidates from exact physical bytes.
// This is a static CALL/RST/JR/JP reachability inventory, not executed code,
// a verified effect, bank-state evidence, or proof of ROM mapping completion.
const {decodeOpcode}=require('./romMapCodeAtlas');
const {inspectRom0IndirectJump}=require('./rom0IndirectJumpEvidence');
const {classifyRomxHeaderBankCandidates}=require('./romRomxBankAccess');
const {classifyMbc3Rom0LiteralWrites,classifyMbc3AdjacentImmediateA,
 classifyMbc3AdjacentIndirectWrite}=require('./romMbc3RegisterEvidence');
const {traceMbc3AProvenance}=require('./romMbc3AProvenance');
const {traceMbc3RegisterInput}=require('./romMbc3RegisterInput');
const {planMbc3BankInputs}=require('./romMbc3BankSourcePlan');
const {classifyMbc3ConditionalBanks}=require('./romMbc3ConditionalBanks');
const {buildMbc3RomxPhysicalScenarios}=require('./romMbc3RomxPhysicalScenarios');
const {auditMbc3RomxEntryOpcodes}=require('./romMbc3RomxOpcodeAudit');
const {auditMbc3RomxBoundedGraph}=require('./romMbc3RomxBoundedGraph');
const {auditMbc3RomxGraphExpansion}=require('./romMbc3RomxGraphExpansion');
const {auditMbc3RomxDepthSweep}=require('./romMbc3RomxDepthSweep');
const {auditMbc3RomxFrontiers}=require('./romMbc3RomxFrontiers');
const ROM_SIZE=1048576,ROM0_END=0x4000;
const MAX_ROOTS=512;
const invalid=reason=>({verified:false,reason,source:'ROM0_CALL_CLOSURE_V1',
 semantic100PercentCertified:false,runtimeEffectsVerified:false});
function traceRom0CallClosure({rom,roots,maxInstructions=ROM0_END}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_SIZE)
  return invalid('ROM must contain exactly 1 MiB');
 if(!Array.isArray(roots)||roots.length===0||roots.length>MAX_ROOTS||
    !Number.isInteger(maxInstructions)||maxInstructions<1||
    maxInstructions>ROM0_END)
  return invalid('Unbounded or invalid roots / instruction budget');
 const sourceRoots=roots.map(x=>typeof x==='number'?x:x?.targetCpu);
 if(sourceRoots.some(x=>!Number.isInteger(x)||x<0||x>=ROM0_END))
  return invalid('Root is not a physical ROM0 CPU address');
 const uniqueRoots=[...new Set(sourceRoots)].sort((a,b)=>a-b);
 const queue=uniqueRoots.slice(),scheduled=new Set(queue),visited=new Set();
 const witnesses=new Map(uniqueRoots.map(pc=>[pc,{rootPc:pc,parentPc:null,edgeKind:'ROOT'}]));
 const enqueue=(to,from,edgeKind)=>{
  if(scheduled.has(to))return;
  scheduled.add(to);queue.push(to);
  const source=witnesses.get(from);
  witnesses.set(to,{rootPc:source?.rootPc??from,parentPc:from,edgeKind});
 };
 const witnessPath=pc=>{
  const chain=[];let at=pc;
  for(let depth=0;depth<=ROM0_END;depth++){
   const item=witnesses.get(at);
   if(!item)break;
   chain.push({pc:at,via:item.edgeKind});
   if(item.parentPc===null)break;
   at=item.parentPc;
  }
  return chain.reverse();
 };
 const owners=new Int32Array(ROM0_END),instructions=[];
 const problems=[],callTargets=new Set(),byReason=Object.create(null);
 const boundedTables=[],indirectTrampolines=[],indirectSiteDetails=[];
 const romxTransferSites=[],mbc3DirectWriteSites=[],
  mbc3AdjacentIndirectWriteSites=[];
 let boundedIndirectCaseEdges=0,boundedIndirectFallbackEdges=0;
 let consumed=0,callEdges=0,restartEdges=0,branchEdges=0;
 let romxUnknown=0,indirectUnknown=0,valid=0;
 const problem=(pc,reason,targetCpu=null)=>{
  byReason[reason]=(byReason[reason]||0)+1;
  if(problems.length<128)problems.push({pc,reason,targetCpu});
 };
 for(let cursor=0;cursor<queue.length&&valid<maxInstructions;cursor++){
  consumed=cursor+1;
  const pc=queue[cursor];
  if(visited.has(pc))continue;
  visited.add(pc);
  const d=decodeOpcode(rom,0,pc);
  if(!d.ok){problem(pc,'DECODE_'+String(d.reason||'UNKNOWN'));continue;}
  if(Array.from({length:d.size},(_,i)=>pc+i)
    .some(x=>x>=ROM0_END||(owners[x]!==0&&owners[x]!==pc+1))){
   problem(pc,'OVERLAPPING_OPCODE_CANDIDATES');
   continue;
  }
  for(let i=0;i<d.size;i++)owners[pc+i]=pc+1;
  valid++;
  instructions.push({pc,opcode:d.opcode,size:d.size,kind:d.kind});
  const candidatePath=witnessPath(pc);
  const previousEntry=candidatePath.length>1&&
   candidatePath[candidatePath.length-1].via==='fallthrough'?
   candidatePath[candidatePath.length-2]:null;
  const previousPc=previousEntry?.pc??null;
  if(d.size===3&&(d.opcode===0xea||d.opcode===0x08)){
   const write=classifyMbc3Rom0LiteralWrites({rom,pc});
   if(write.verified&&write.candidates.length>0){
    const immediate=classifyMbc3AdjacentImmediateA({rom,previousPc,pc});
    mbc3DirectWriteSites.push({rom0Pc:pc,opcode:d.opcode,
     originRootCpu:witnesses.get(pc)?.rootPc??null,
     witnessPath:candidatePath,
     literalTargets:write.candidates,
     adjacentLiteralAProvenance:immediate.verified?{
      previousPc,conditionalImmediateAValue:immediate.conditionalImmediateAValue,
      executed:false}:null,
     aSourceProvenance:d.opcode===0xea?
      traceMbc3AProvenance({rom,witnessPath:candidatePath,writePc:pc}):null,
     registerInputProvenance:null,
     runtimeValueKnown:false,executed:false,activeBankKnown:false});
    const site=mbc3DirectWriteSites[mbc3DirectWriteSites.length-1];
    const a=site.aSourceProvenance;
    if(a?.sourceKind==='REGISTER_OR_HL_READ'&&
       ['B','C','D','E','H','L'].includes(a.sourceRegister)){
     const sourceIndex=candidatePath.findIndex(x=>x.pc===a.sourcePc);
     const inputPath=sourceIndex>=0?candidatePath.slice(0,sourceIndex+1):[];
     site.registerInputProvenance=traceMbc3RegisterInput({
      rom,witnessPath:inputPath,sourcePc:a.sourcePc,
      sourceRegister:a.sourceRegister});
    }
   }
  }
  if([0x77,0x22,0x32,0x36,0x02,0x12].includes(d.opcode)){
   const indirect=classifyMbc3AdjacentIndirectWrite({rom,previousPc,pc});
   if(indirect.verified&&indirect.size===d.size)
    mbc3AdjacentIndirectWriteSites.push({
     ...indirect,rom0Pc:pc,
     originRootCpu:witnesses.get(pc)?.rootPc??null,
     witnessPath:candidatePath});
  }
  if(d.kind==='indirect'){
   indirectUnknown++;
   const detail=inspectRom0IndirectJump({rom,jumpPc:pc});
   indirectSiteDetails.push({jumpPc:pc,kind:detail.kind,
    rootPc:witnesses.get(pc)?.rootPc??null,
    witnessPath:witnessPath(pc),
    indexBoundExclusive:detail.indexBoundExclusive??null,
    runtimeTargetKnown:false});
   if(detail.verified===true&&
      detail.kind==='GUARDED_ROM0_LITERAL_JUMP_TABLE'&&
      detail.allEntriesPhysicallyInsideRom0===true&&
      Number.isInteger(detail.nonTableBranchCpu)&&
      detail.nonTableBranchCpu>=0&&detail.nonTableBranchCpu<ROM0_END&&
      detail.candidateTargetsCpu.length===detail.indexBoundExclusive){
    const tableTargets=[...new Set(detail.candidateTargetsCpu)];
    boundedTables.push({
     jumpPc:pc,tableCpu:detail.tableCpu,
     indexBoundExclusive:detail.indexBoundExclusive,
     caseTargetsCpu:[...detail.candidateTargetsCpu],
     alternateNonTableBranchCpu:detail.nonTableBranchCpu,
     runtimeIndexKnown:false,runtimeBranchExecuted:false
    });
    boundedIndirectCaseEdges+=detail.candidateTargetsCpu.length;
    boundedIndirectFallbackEdges++;
    problem(pc,'JP_HL_BOUNDED_TABLE_RUNTIME_INDEX_UNKNOWN');
    // An index-limited ROM0 table gives physical *candidate* destinations.
    // Include also the direct conditional escape before JP HL. No claim
    // that any one branch runs, or that a byte sequence is executable.
    for(const to of tableTargets)enqueue(to,pc,'LITERAL_JP_HL_CASE');
    enqueue(detail.nonTableBranchCpu,pc,'LITERAL_JP_HL_ESCAPE');
   }else if(detail.verified===true&&
      detail.kind==='PUSH_RETURN_AND_JUMP_RUNTIME_HL'){
    indirectTrampolines.push({
     jumpPc:pc,stackRegister:detail.stackRegister,
     returnPc:detail.returnPc,hlDestinationKnown:false
    });
    problem(pc,'JP_HL_REGISTER_DESTINATION_UNKNOWN');
   }else{
    problem(pc,'JP_HL_RUNTIME_TARGET_UNKNOWN');
   }
  }
  for(const edge of d.targets){
   const to=edge.pc;
   if(edge.kind==='call'||edge.kind==='restart'){
    if(edge.kind==='restart')restartEdges++;else callEdges++;
    if(to>=0&&to<ROM0_END)callTargets.add(to);
   }else if(edge.kind!=='fallthrough')branchEdges++;
   if(!Number.isInteger(to)||to<0||to>=ROM0_END){
    if(to>=ROM0_END&&to<0x8000){
     romxUnknown++;
     const headerEvidence=classifyRomxHeaderBankCandidates({rom,targetCpu:to});
     const physicalMappings=headerEvidence.physicalMappings.map(x=>{
      const decoded=decodeOpcode(rom,x.bank,to);
      return {...x,firstOpcodeDecodable:decoded.ok===true};
     });
     romxTransferSites.push({fromRom0Cpu:pc,opcode:d.opcode,
      transferKind:edge.kind,targetCpu:to,
      originRootCpu:witnesses.get(pc)?.rootPc??null,
      witnessPath:witnessPath(pc),
      physicalMappings,
      cartridgeType:headerEvidence.cartridgeType,
      romSizeCode:headerEvidence.romSizeCode,
      ramSizeCode:headerEvidence.ramSizeCode,
      mapperFamilyFromHeader:headerEvidence.mapperFamilyFromHeader,
      headerSizeMatchesFile:headerEvidence.headerSizeMatchesFile,
      declaredMapperRomxCandidateCount:headerEvidence.declaredMapperRomxCandidateCount,
      mbc5BankZeroCandidate:headerEvidence.mbc5BankZeroCandidate,
      standardMbc1Conditional:headerEvidence.standardMbc1Conditional,
      excludedIfStandardMbc1:headerEvidence.excludedIfStandardMbc1,
      conditionalCandidateCount:headerEvidence.conditionalCandidateCount,
      physicallyMappedBanks:physicalMappings.length,
      firstOpcodeDecodableBanks:physicalMappings.filter(x=>x.firstOpcodeDecodable).length,
      activeBankKnown:false,selectedFileOffset:null,
      transferExecuted:false,gameEffectVerified:false,
      note:'Every bank address is physical evidence only, not a verified active MBC bank or executable entrypoint'});
     problem(pc,'ROMX_ACTIVE_BANK_UNKNOWN',to);
    }else problem(pc,'OUTSIDE_FIXED_ROM0',to);
    continue;
   }
   enqueue(to,pc,edge.kind);
  }
 }
 // No branch/call is reported as executed. An exhausted queue only proves
 // that this bounded static decoder has no additional queued candidates.
 const remainingQueue=queue.length-consumed;
 const sourceObservationPlan=planMbc3BankInputs({directWriteSites:
  mbc3DirectWriteSites.filter(s=>s.opcode===0xea&&
   s.literalTargets.some(t=>t.registerKind==='ROM_BANK_NUMBER'))});
 const conditionalRomBankCandidates=classifyMbc3ConditionalBanks({
  plan:sourceObservationPlan});
 const staticRomxScenarios=buildMbc3RomxPhysicalScenarios({
  rom,transferSites:romxTransferSites,conditionalBanks:conditionalRomBankCandidates});
 const romxOpcodeAudit=auditMbc3RomxEntryOpcodes({rom,scenarioAtlas:staticRomxScenarios});
 const romxBoundedGraph=auditMbc3RomxBoundedGraph({
  rom,scenarioAtlas:staticRomxScenarios,maxInstructionsPerEntrypoint:48});
 const romxExpandedGraph=auditMbc3RomxGraphExpansion({
  rom,scenarioAtlas:staticRomxScenarios,baselineGraph:romxBoundedGraph});
 const romxDepthSweep=auditMbc3RomxDepthSweep({
  rom,scenarioAtlas:staticRomxScenarios,expansion:romxExpandedGraph});
 const romxFrontiers=auditMbc3RomxFrontiers({rom,depthSweep:romxDepthSweep});
 return {verified:true,source:'ROM0_CALL_CLOSURE_V1',
  uniqueSeedAddresses:uniqueRoots.length,seedAddresses:uniqueRoots,
  candidateInstructions:valid,candidateInstructionBytes:owners.reduce(
   (n,x)=>n+(x!==0?1:0),0),
  traversedDirectCallEdges:callEdges,traversedRestartEdges:restartEdges,
  traversedBranchEdges:branchEdges,
  distinctRom0CallTargets:callTargets.size,
  rom0CallTargets:[...callTargets].sort((a,b)=>a-b),
  unresolvedRomxTransfers:romxUnknown,indirectJumpsUnknown:indirectUnknown,
  boundedIndirectTables:boundedTables,
  boundedIndirectCaseEdges,boundedIndirectFallbackEdges,
  boundedIndirectCandidateEdges:boundedIndirectCaseEdges+boundedIndirectFallbackEdges,
  indirectReturnTrampolines:indirectTrampolines,
  indirectSiteDetails,
  romxTransferSites,
  mbc3DirectWriteSites,
  mbc3SourceObservationPlan:sourceObservationPlan,
  mbc3ConditionalRomBankCandidates:conditionalRomBankCandidates,
  mbc3RomxPhysicalScenarios:staticRomxScenarios,
  mbc3RomxOpcodeAudit:romxOpcodeAudit,
  mbc3RomxBoundedGraph:romxBoundedGraph,
  mbc3RomxGraphExpansion:romxExpandedGraph,
  mbc3RomxDepthSweep:romxDepthSweep,
  mbc3RomxFrontiers:romxFrontiers,
  mbc3DirectWriteSiteCount:mbc3DirectWriteSites.length,
  mbc3DirectLiteralAProvenanceSites:mbc3DirectWriteSites.filter(
   s=>s.adjacentLiteralAProvenance!==null).length,
  mbc3ABoundedImmediateSites:mbc3DirectWriteSites.filter(s=>
   s.aSourceProvenance?.conditionalByte!==null&&
   s.aSourceProvenance?.conditionalByte!==undefined).length,
  mbc3ABoundedRegisterOrMemorySites:mbc3DirectWriteSites.filter(s=>
   ['REGISTER_OR_HL_READ','MEMORY_READ','STACK_POP_AF']
    .includes(s.aSourceProvenance?.sourceKind)).length,
  mbc3AUnresolvedSites:mbc3DirectWriteSites.filter(s=>
   s.aSourceProvenance?.sourceKind==='UNRESOLVED').length,
  mbc3RegisterInputTracedSites:mbc3DirectWriteSites.filter(s=>
   s.registerInputProvenance?.verified===true).length,
  mbc3RegisterInputConditionalByteSites:mbc3DirectWriteSites.filter(s=>
   s.registerInputProvenance?.conditionalByte!==null&&
   s.registerInputProvenance?.conditionalByte!==undefined).length,
  mbc3RegisterInputUnresolvedSites:mbc3DirectWriteSites.filter(s=>
   s.registerInputProvenance?.originKind==='UNRESOLVED').length,
  mbc3AdjacentIndirectWriteSites,
  mbc3AdjacentIndirectWriteSiteCount:mbc3AdjacentIndirectWriteSites.length,
  mbc3AdjacentIndirectRomBankWriteSites:mbc3AdjacentIndirectWriteSites.filter(
   s=>s.registerKind==='ROM_BANK_NUMBER').length,
  mbc3LiteralRomBankWriteSites:mbc3DirectWriteSites.filter(
   s=>s.literalTargets.some(t=>t.registerKind==='ROM_BANK_NUMBER')).length,
  mbc3DirectWritesExecuted:0,
  mbc3BankValuesRuntimeVerified:0,
  mbc3IndirectWriteCoverageComplete:false,
  romxPhysicalMappingsTotal:romxTransferSites.reduce((n,x)=>n+x.physicallyMappedBanks,0),
  romxStandardMbc1ConditionalSites:romxTransferSites.filter(x=>x.standardMbc1Conditional).length,
  romxHeaderConditionalExcludedMappingsTotal:romxTransferSites.reduce(
   (n,x)=>n+x.excludedIfStandardMbc1.length,0),
  romxMapperFamilySiteCounts:Object.fromEntries(
   ['MBC1','MBC3','MBC5','UNKNOWN'].map(k=>[
    k,romxTransferSites.filter(x=>x.mapperFamilyFromHeader===k).length
   ])),
  romxMbc5BankZeroCandidateSites:romxTransferSites.filter(
   x=>x.mbc5BankZeroCandidate!==null).length,
  romxActiveBanksVerified:0,
  allIndirectRuntimeTargetsVerified:false,
  unresolvedCandidateCount:Object.values(byReason).reduce((n,x)=>n+x,0),
  unresolvedReasonCounts:{...byReason},problemSamples:problems,
  problemSamplesTruncated:Object.values(byReason).reduce((n,x)=>n+x,0)>problems.length,
  remainingQueue,budgetExhausted:remainingQueue>0,
  staticCandidateQueueExhausted:remainingQueue===0,
  runtimeEffectsVerified:false,semantic100PercentCertified:false,
  activeRomBankKnown:false,executedBranchesVerified:false,
  warning:'ROM0 CALL/RST and bounded literal jump-table cases are only statically reachable candidates. Table index, ROMX bank, dynamic HL destinations, event effects and actual execution remain unknown.'};
}
module.exports={traceRom0CallClosure};
