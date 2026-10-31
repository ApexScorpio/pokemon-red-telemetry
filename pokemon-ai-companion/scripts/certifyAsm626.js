'use strict';
// Reproducible Windows QA for all three exact Gen I ROMs. The PowerShell
// bridge needs only a tiny launcher; no PS1 download and no files on C:.
// Only generated artifacts in our exclusive D: directory are ever removed.
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
const {buildCampaignWorldTracker}=require('../romCampaignWorldTracker');
const {buildMappingGapLedger}=require('../romMappingGapLedger');
const {traceRom0CallClosure}=require('../rom0CallClosureEvidence');
const {buildStaticWorldFlagDependencies}=require('../romStaticWorldFlagDependencies');
const {compareCrossVariantFlagSemantics}=require('../romCrossVariantFlagSemantics');
const {buildGlobalFlagOperationCatalogue}=require('../romGlobalFlagOperationCatalogue');
const {buildNamedEventEvidenceLedger}=require('../romNamedEventEvidenceLedger');
const {buildWorldwideNamedEventCoverage}=require('../romWorldNamedEventCoverage');
const {buildCompleteEventBitmap}=require('../romCompleteEventBitmap');
const {buildWorldEventAtlas}=require('../romWorldEventAtlas');
const referenceEventNames=require('../data/gen1EventNamesPret.json');
const referenceMapNames=require('../data/gen1MapNamesPret.json');
const {saveVerifiedProfileArchive}=require('../romProfileArchive');

const JOB=/^PSB-\d{8}-\d{4}-POKEGUIDE-[A-Z0-9-]+-\d{3}$/.test(process.env.POKEGUIDE_CERT_JOB_ID||'')?process.env.POKEGUIDE_CERT_JOB_ID:'PSB-20261030-1054-POKEGUIDE-ASM626-004';
const BASE='D:\\Pokeguide';
const ROOT=path.join(BASE,'_qa');
const HISTORY=path.join(BASE,'HISTORICO_BRIDGE_VALIDACOES.md');
const ATLAS=path.join(ROOT,'PSB-20261029-2138-POKEGUIDE-ROMS-001','atlas.json');
const FILENAMES=Object.freeze({
 red:'Pokemon - Red Version (USA, Europe) (SGB Enhanced) (1).zip',
 blue:'Pokemon - Blue Version (USA, Europe) (SGB Enhanced).zip',
 green:'Pokemon Green International v1.2.1.gb'
});
const PROFILES=Object.freeze({
 red:'pokemon_red_rom_profile.json',
 blue:'pokemon_blue_rom_profile.json',
 green:'pokemon_green_international_rom_profile.json'
});
const OUTPUTS=Object.freeze({
 red:'Pokemon Red.gb',blue:'Pokemon Blue.gb',
 green:'Pokemon Green International v1.2.1.gb'
});
const PROTECTED=/(?:^|[\\/])(?:antigravity|TIMI_FIELD_WORKSPACE|maestro|bonchat|codex|\.gemini|userdata|appdata|node_modules|\.git|_qa)(?:[\\/]|$)/i;
let work=null,started=false,finished=false;
function log(message){
 const line=String(message);
 process.stdout.write(line+'\n');
 fs.appendFileSync(HISTORY,line+'\n',{encoding:'utf8',flag:'a'});
}
function assert(ok,msg){if(!ok)throw Error(msg);}
function locate(){
 const home=process.env.USERPROFILE||'';
 const roots=[
 'D:\\Users\\lopes\\Downloads','S:\\Users\\lopes\\Downloads',
 'D:\\Users\\lopes\\Desktop','S:\\Users\\lopes\\Desktop',
 home&&path.join(home,'Downloads'),
 home&&path.join(home,'Desktop'),
 home&&path.join(home,'Documents')
 ].filter(Boolean);
 const wanted=new Map(Object.entries(FILENAMES).map(([k,v])=>[v.toLowerCase(),k]));
 const found={};
 for(const root of [...new Set(roots)]){
  if(!fs.existsSync(root)||PROTECTED.test(root))continue;
  const queue=[{dir:root,depth:0}];let scanned=0;
  while(queue.length&&scanned<650&&Object.keys(found).length<3){
   const current=queue.shift();scanned++;
   if(PROTECTED.test(current.dir))continue;
   let entries;
   try{entries=fs.readdirSync(current.dir,{withFileTypes:true});}catch{continue;}
   if(entries.length>5000)continue;
   for(const e of entries){
    if(e.isSymbolicLink())continue;
    const full=path.join(current.dir,e.name);
    if(e.isDirectory()&&current.depth<5&&!PROTECTED.test(full))
     queue.push({dir:full,depth:current.depth+1});
    if(e.isFile()&&wanted.has(e.name.toLowerCase())){
     const variant=wanted.get(e.name.toLowerCase());
     if(!found[variant])found[variant]=full;
    }
   }
  }
  if(Object.keys(found).length===3)break;
 }
 assert(Object.keys(found).length===3,
  'ROMs originais não localizadas: '+Object.keys(FILENAMES).filter(x=>!found[x]).join(','));
 return found;
}
function parseTap(label,output,status,minTests,expectedSkips){
 const numbers={};
 const failures=[];
 for(const line of String(output).split(/\r?\n/)){
  const m=/^\s*#\s*(tests|pass|fail|skipped|cancelled|todo)\s+(\d+)\s*$/.exec(line);
  if(m)numbers[m[1]]=Number(m[2]);
  if(/^\s*not ok\s+\d+/.test(line)||/^\s*ok\s+\d+.*# SKIP/.test(line))
   failures.push(line.trim());
 }
 for(const key of ['tests','pass','fail','skipped','cancelled','todo'])
  log(label+'_'+key.toUpperCase()+'='+(numbers[key]??'MISSING'));
 for(const line of failures.slice(0,60))log(label+'_CASE='+line);
 if(status!==0||!['tests','pass','fail','skipped','cancelled','todo'].every(k=>Number.isInteger(numbers[k]))||
   numbers.tests<minTests||numbers.fail!==0||numbers.skipped!==expectedSkips||
   numbers.cancelled!==0||
   numbers.tests!==numbers.pass+numbers.skipped+numbers.todo){
  const block=String(output).split(/\r?\n/);
  // TAP failures may occur hundreds of lines before the footer. Include
  // each offending assertion's diagnostics, not just the last 75 lines.
  let remaining=0,shown=0;
  for(const line of block){
   if(/^\s*not ok\s+\d+/.test(line))remaining=50;
   if(remaining>0&&shown<200){
    log(label+'_FAILED_ASSERTION='+line);
    shown++;
    remaining--;
    if(/^\s*\.\.\.\s*$/.test(line))remaining=0;
   }
  }
  if(shown===0)
   for(const line of block.slice(-75))if(line.trim())log(label+'_DETAIL='+line);
  throw Error(label+' FAIL, exit='+status);
 }
 log(label+'_VALIDATED=TRUE');
}
function runTests(label,files,env,minTests,skips){
 const args=['--test','--test-reporter=tap',...files];
 const run=spawnSync(process.execPath,args,{
  cwd:path.join(__dirname,'..'),env,encoding:'utf8',
  maxBuffer:16*1024*1024,windowsHide:true
 });
 assert(!run.error,label+': '+(run.error?.message||'unknown spawn error'));
 parseTap(label,(run.stdout||'')+'\n'+(run.stderr||''),run.status,minTests,skips);
}
function main(){
 assert(process.platform==='win32','Certificação destinada ao Windows');
 assert(fs.existsSync(ROOT)&&fs.statSync(ROOT).isDirectory(),'Diretório D:\\Pokeguide\\_qa inexistente');
 assert(fs.existsSync(ATLAS),'Atlas verificado não encontrado');
 started=true;
 log('===== POKEGUIDE - MANIFESTO - CERTIFICACAO ASM626 =====');
 log('JOB_BEGIN='+JOB);
 work=fs.mkdtempSync(path.join(ROOT,JOB+'-'));
 const env={...process.env};
 for(const k of ['TEMP','TMP','TMPDIR','HOME','XDG_CACHE_HOME','NODE_COMPILE_CACHE'])
  env[k]=work;
 for(const key of Object.keys(env))
  if(key.startsWith('POKEMON_')||key.startsWith('POKEGUIDE_'))delete env[key];
 log('STEP=LOCATE_ORIGINAL_ROMS_READ_ONLY');
 const found=locate();
 for(const name of Object.keys(FILENAMES))log('ROM_'+name.toUpperCase()+'_FOUND=TRUE');
 const atlas=JSON.parse(fs.readFileSync(ATLAS,'utf8'));
 const originals={};
 const crossRomFlagGraphs={};
 log('STEP=VERIFY_SHA_AND_WORLD_ROM');
 for(const variant of ['red','blue','green']){
  const rom=readRom(found[variant]),p=inspectRomBuffer(rom,OUTPUTS[variant]);
  assert(p.hash?.sha256===KNOWN[variant]&&p.unknownLayout===false,'ROM identity: '+variant);
  assert(atlas.variants?.[variant]?.identity?.sha256===KNOWN[variant],
   'Atlas identity: '+variant);
  const a=p.world?.interactionScriptAtlas,i=buildWorldContentsIndex(p);
  const tracker=buildCampaignWorldTracker({index:i,scriptAtlas:a});
  assert(a?.verified===true&&a.summary.referencedInteractions===1126&&
   a.summary.asmTextReferences===626&&a.summary.asmEntrypointsLocated===626&&
   a.summary.asmSemanticallyCertified===0&&
   a.summary.uniqueAsmEntrypoints>0&&a.summary.uniqueAsmEntrypoints<=626&&
   a.summary.uniqueAsmCandidateInstructions>0&&
   a.summary.uniqueAsmFirstPassLimitHits===7&&
   a.summary.uniqueAsmExpandedEntrypoints===7&&
   a.summary.uniqueAsmAdditionalCandidateInstructions>=0&&
   a.summary.uniqueAsmExpandedStillLimited<=7&&
   a.summary.uniqueAsmScanLimitHits<=7&&
   Object.values(a.summary.asmUnresolvedReasonCounts||{}).reduce((n,x)=>n+x,0)===
    a.summary.uniqueAsmUnresolvedTargets&&
   Object.values(a.summary.asmUnfollowedCallClasses||{}).reduce((n,x)=>n+x,0)===
    a.summary.uniqueAsmCallsNotFollowed&&
   i.verified===true&&i.totals.warps===813&&i.totals.hiddenItems===54&&
   tracker.verified===true&&tracker.summary.scriptReferencesBound===1126,
   'Invalid world/ASM mapping: '+variant);
  log('ROM_'+variant.toUpperCase()+'_ROM0_INVARIANTS='+JSON.stringify({
   branchReferences:a.summary.rom0BranchTargetOccurrences,
   branchClasses:a.summary.asmUnresolvedReasonCounts?.ROM0_OUTSIDE_LOCAL_GRAPH,
   fixedCallReferences:a.summary.rom0CallTargetOccurrences,
   fixedCallClasses:a.summary.asmUnfollowedCallClasses?.ROM0_FIXED,
   distinctBranch:a.summary.distinctRom0BranchDestinations,
   distinctCalls:a.summary.distinctRom0CallDestinations,
   distinctUnion:a.summary.distinctRom0PhysicalTargets,
   physicallyMapped:a.summary.physicallyMappedRom0Targets,
   physicalMappingCertified:a.rom0PhysicalAddressMappingCertified,
   semanticallyCertified:a.summary.rom0EffectSemanticsCertified,
   invalidPhysicalExamples:(a.fixedRom0BranchEvidence||[])
    .filter(x=>x.verified!==true||x.physicalRom0Mapped!==true)
    .slice(0,8).map(x=>({cpu:x.targetCpu,reason:x.reason}))
  }));
  // Certify detailed static ROM0 triage against previously validated totals.
  // It is evidence for follow-up disassembly, never execution proof.
  const rom0Details=a.fixedRom0BranchEvidence||[];
  assert(rom0Details.length===a.summary.distinctRom0PhysicalTargets&&
   a.summary.rom0TargetsWithWorldOrigins===rom0Details.length&&
   rom0Details.every(x=>Number.isInteger(x.targetCpu)&&
    x.referencingMapIds?.length>0&&x.referencingAsmOffsets?.length>0&&
    Array.isArray(x.problemDetails)&&
    x.problemDetails.length<=32&&
    Array.isArray(x.remainingQueueSample)&&
    Object.values(x.problemReasonCounts||{}).reduce((n,v)=>n+v,0)===
     x.candidateDecodeProblems&&
    x.effectVerified===false&&x.branchExecuted===false)&&
   rom0Details.filter(x=>x.residualLimitReached).length===
    a.summary.rom0StillBudgetLimited&&
   rom0Details.reduce((n,x)=>n+x.candidateDecodeProblems,0)===
    a.summary.rom0DecodeProblems,
   'ROM0 detailed static diagnostics mismatch: '+variant);
  const cpuHex=pc=>'0x'+pc.toString(16).padStart(4,'0');
  log('ROM_'+variant.toUpperCase()+'_ROM0_WHOLE_BANK_PASS_DETAILS='+
   JSON.stringify(rom0Details.filter(x=>x.thirdPassApplied===true)
    .map(x=>({target:cpuHex(x.targetCpu),
     mapCount:x.referencingMapIds.length,
     mapIdsSample:x.referencingMapIds.slice(0,15),
     handlerCount:x.referencingAsmOffsets.length,
     initial128InstructionCount:x.firstDeepPassLimitReached?128:null,
     frontierAt128:x.frontierAt128.map(cpuHex),
     pendingAt128:x.pendingAt128,
     completedStaticCandidateInstructions:x.opcodeCandidateCount,
     newlyInspectedInstructions:x.thirdPassAdditionalCandidateInstructions,
     newlyObservedUnresolvedTargets:x.thirdPassAdditionalDecodeProblems,
     stillLimited:x.residualLimitReached,
     reasonCounts:x.problemReasonCounts}))));
  log('ROM_'+variant.toUpperCase()+'_ROM0_RESIDUAL_TARGET_DETAILS='+
   JSON.stringify(rom0Details.filter(x=>x.residualLimitReached)
    .map(x=>({target:cpuHex(x.targetCpu),
     opcodeCandidates:x.opcodeCandidateCount,
     remainingQueue:x.remainingQueue,
     frontierCpus:x.remainingQueueSample.map(cpuHex),
     maps:x.referencingMapIds,
     handlerCount:x.referencingAsmOffsets.length,
     handlerOffsets:x.referencingAsmOffsets.slice(0,16),
     lastOpcodes:x.lastCandidateInstructions,
     reasonCounts:x.problemReasonCounts}))));
  log('ROM_'+variant.toUpperCase()+'_ROM0_DECODE_PROBLEM_DETAILS='+
   JSON.stringify(rom0Details.filter(x=>x.candidateDecodeProblems>0)
    .map(x=>({target:cpuHex(x.targetCpu),maps:x.referencingMapIds,
     count:x.candidateDecodeProblems,
     reasonCounts:x.problemReasonCounts,
     problems:x.problemDetails,
     truncated:x.problemDetailsTruncated}))));
  // Distinct CPU instruction forms, independently corroborated by each ROM.
  // None of them makes any event, script effect or runtime target known.
  const indirect=a.distinctRom0IndirectJumpEvidence||[];
  const actualByPc=new Map(indirect.map(x=>[x.jumpPc,x]));
  const expectedJumps=variant==='green'?
   {table:0x1b5e,bc:0x35ca,de:0x3e73,tableCpu:0x1ca8}:
   {table:0x1b77,bc:0x35e3,de:0x3e8c,tableCpu:0x1cc1};
  const jumpTable=actualByPc.get(expectedJumps.table);
  const bcJump=actualByPc.get(expectedJumps.bc);
  const deJump=actualByPc.get(expectedJumps.de);
  assert(indirect.length===3&&
   a.summary.rom0UniqueIndirectJumpInstructions===3&&
   a.summary.rom0LiteralJumpTables===1&&
   a.summary.rom0LiteralJumpTableCandidateTargets===14&&
   a.summary.rom0HlReturnTrampolines===2&&
   a.summary.rom0IndirectRuntimeTargetsVerified===0&&
   jumpTable?.kind==='GUARDED_ROM0_LITERAL_JUMP_TABLE'&&
   jumpTable.indexBoundExclusive===14&&
   jumpTable.tableCpu===expectedJumps.tableCpu&&
   jumpTable.candidateTargetsCpu.length===14&&
   jumpTable.candidateTargetsCpu.every(pc=>Number.isInteger(pc)&&pc<0x4000)&&
   bcJump?.kind==='PUSH_RETURN_AND_JUMP_RUNTIME_HL'&&
   bcJump.stackRegister==='BC'&&bcJump.returnPc===expectedJumps.bc+1&&
   deJump?.kind==='PUSH_RETURN_AND_JUMP_RUNTIME_HL'&&
   deJump.stackRegister==='DE'&&deJump.returnPc===expectedJumps.de+1&&
   indirect.every(x=>x.runtimeTargetKnown===false&&
    x.runtimeExecuted===false&&x.gameEffectVerified===false),
   'Literal JP HL provenance/ROM identity mismatch: '+variant);
  log('ROM_'+variant.toUpperCase()+'_ROM0_INDIRECT_FORMS='+
   JSON.stringify(indirect.map(x=>({
    jumpPc:'0x'+x.jumpPc.toString(16),
    kind:x.kind,tableCpu:x.tableCpu??null,
    candidateTargets:x.candidateTargetsCpu.map(pc=>'0x'+pc.toString(16)),
    stackRegister:x.stackRegister??null,
    returnPc:x.returnPc??null,
    runtimeTargetKnown:x.runtimeTargetKnown,
    gameEffectVerified:x.gameEffectVerified}))));
  const gaps=buildMappingGapLedger({profile:p,index:i,scriptAtlas:a,tracker});
  assert(gaps.verified===true&&
   gaps.summary.mapIds===248&&gaps.summary.normalMapHeaders===226&&
   gaps.summary.idsWithoutNormalHeader===22&&
   gaps.summary.hiddenItemsWithoutNormalHeader===1&&
   gaps.summary.staticallyIndexedActions===1992&&
   gaps.summary.scriptReferences===1126&&
   gaps.summary.asmTextReferences===626&&
   gaps.summary.uniqueAsmEntrypoints===516&&
   gaps.summary.unverifiedScriptEffects===1126&&
   gaps.summary.verifiedRomEventBitBindings===344&&
   gaps.summary.verifiedTrainerScriptEventBitBindings===332&&
   gaps.summary.verifiedStaticEncounterScriptEventBitBindings===12&&
   gaps.summary.verifiedSpecialTrainerScriptEventBitBindings===22&&
   gaps.summary.liveEventBitValuesVerified===0&&
   a.summary.trainerEventFlagBindings===332&&
   a.summary.stationaryEventFlagBindings===12&&
   a.summary.specialTrainerEventFlagBindings===22&&
   a.summary.trainerEventFlagBindingsMissing===2&&
   gaps.summary.trainerScriptEventBitsUnresolved===2&&
   JSON.stringify(gaps.summary.trainerScriptUnresolvedReferences
    .map(x=>[x.mapId,x.ordinal,x.eventBitIndex]))===
    JSON.stringify([[96,2,null],[135,11,null]])&&
   gaps.summary.textPointersPending===0&&
   a.summary.rom0BranchTargetOccurrences===537&&
   a.summary.rom0FirstPassLimitHits===13&&
   a.summary.rom0ExpandedTargets===13&&
   a.summary.rom0AdditionalCandidateInstructions>0&&
   a.summary.rom0ExpandedStillLimited===a.summary.rom0StillBudgetLimited&&
   a.summary.rom0Intermediate128LimitHits===3&&
   a.summary.rom0WholeBankPasses===3&&
   a.summary.rom0WholeBankResidualLimits===0&&
   a.summary.rom0StillBudgetLimited===0&&
   a.summary.rom0StaticCandidateWalkExhausted===59&&
   a.summary.rom0ThirdPassAdditionalCandidateInstructions===127&&
   a.summary.rom0OpcodeCandidateInstructions===1735&&
   a.summary.rom0DecodeProblems===10&&
   a.summary.rom0EffectSemanticsCertified===0&&
   a.summary.physicallyMappedRom0Targets===a.summary.distinctRom0PhysicalTargets&&
   a.summary.rom0CallTargetOccurrences===1016&&
   gaps.summary.mappedRom0CallReferences===1016&&
   a.summary.rom0EffectSemanticsCertified===0&&
   gaps.summary.mappedRom0BranchReferences===537&&
   gaps.summary.rom0StillSemanticallyUnknown===537&&
   gaps.summary.rom0EffectsProven===0&&
   gaps.mapping100PercentCertified===false,
   'Global ROM mapping gap ledger discrepancy: '+variant+': '+gaps.reason);
  // Expand all audited ROM0 roots through ROM0-only CALL/RST targets.
  // This is a structural, read-only candidate graph, not game execution.
  const closure=traceRom0CallClosure({
   rom,roots:rom0Details.map(x=>x.targetCpu)
  });
  assert(closure.verified===true&&closure.uniqueSeedAddresses===59&&
   closure.candidateInstructions>0&&
   closure.unresolvedCandidateCount===
    Object.values(closure.unresolvedReasonCounts).reduce((n,v)=>n+v,0)&&
   closure.runtimeEffectsVerified===false&&
   closure.semantic100PercentCertified===false&&
   closure.executedBranchesVerified===false&&
   closure.activeRomBankKnown===false&&
   closure.allIndirectRuntimeTargetsVerified===false&&
   closure.boundedIndirectTables.some(x=>
    x.jumpPc===(variant==='green'?0x1b5e:0x1b77)&&
    x.indexBoundExclusive===14&&x.caseTargetsCpu.length===14&&
    x.runtimeIndexKnown===false),
   'ROM0 CALL closure structural evidence invalid: '+variant);
  log('ROM_'+variant.toUpperCase()+'_ROM0_CALL_CLOSURE='+
   JSON.stringify({
    seedRoots:closure.uniqueSeedAddresses,
    candidateInstructions:closure.candidateInstructions,
    candidateBytes:closure.candidateInstructionBytes,
    directCallEdges:closure.traversedDirectCallEdges,
    rstEdges:closure.traversedRestartEdges,
    directBranchEdges:closure.traversedBranchEdges,
    uniqueRom0CallTargets:closure.distinctRom0CallTargets,
    romxUnknown:closure.unresolvedRomxTransfers,
    indirectJumpsUnknown:closure.indirectJumpsUnknown,
    literalTables:closure.boundedIndirectTables.map(t=>({
     jumpPc:t.jumpPc,tableCpu:t.tableCpu,
     indexBoundExclusive:t.indexBoundExclusive,
     caseTargetsCpu:t.caseTargetsCpu,
     alternateNonTableBranchCpu:t.alternateNonTableBranchCpu,
     runtimeIndexKnown:t.runtimeIndexKnown
    })),
    literalTableCaseEdges:closure.boundedIndirectCaseEdges,
    literalTableFallbackEdges:closure.boundedIndirectFallbackEdges,
    returnTrampolines:closure.indirectReturnTrampolines,
    allIndirectRuntimeTargetsVerified:closure.allIndirectRuntimeTargetsVerified,
    unresolvedCounts:closure.unresolvedReasonCounts,
    remainingQueue:closure.remainingQueue,
    budgetExhausted:closure.budgetExhausted,
    semantic100PercentCertified:false,
    runtimeEffectsVerified:false,
    problemSamples:closure.problemSamples.slice(0,12)
   }));
  // Exact ROM0-to-ROMX transfer sites, with auditable candidate paths.
  // A physical bank offset and a decodable first byte never prove that
  // a bank was active, the destination is executable, or a script ran.
  assert(closure.romxTransferSites.length===12&&
   closure.romxPhysicalMappingsTotal===12*63&&
   closure.romxActiveBanksVerified===0&&
   closure.indirectSiteDetails.length===closure.indirectJumpsUnknown&&
   closure.indirectSiteDetails.length===4&&
   closure.romxTransferSites.every(x=>
    x.physicallyMappedBanks===63&&x.activeBankKnown===false&&
    x.selectedFileOffset===null&&x.transferExecuted===false&&
    x.gameEffectVerified===false&&
    x.witnessPath.length>0&&
    x.witnessPath[0].pc===x.originRootCpu&&
    x.physicalMappings.length===63&&
    x.physicalMappings.every(p=>
     p.bank>=1&&p.bank<64&&
     p.fileOffset===p.bank*0x4000+x.targetCpu-0x4000&&
     p.selectableIfStandardMbc1===(x.standardMbc1Conditional?p.bank!==32:null))&&
    x.conditionalCandidateCount===(x.standardMbc1Conditional?62:null)&&
    x.excludedIfStandardMbc1.length===(x.standardMbc1Conditional?1:0)&&
    ['MBC1','MBC3','MBC5','UNKNOWN'].includes(x.mapperFamilyFromHeader)&&
    x.declaredMapperRomxCandidateCount===(
     x.mapperFamilyFromHeader==='MBC1'?62:
     x.mapperFamilyFromHeader==='MBC3'?63:
     x.mapperFamilyFromHeader==='MBC5'?64:null)&&
    (x.mbc5BankZeroCandidate===null||
     (x.mapperFamilyFromHeader==='MBC5'&&
      x.mbc5BankZeroCandidate.bank===0&&
      x.mbc5BankZeroCandidate.fileOffset===x.targetCpu-0x4000))&&
    x.physicalMappings.every(p=>
     p.selectableIfDeclaredMapper===(
      x.mapperFamilyFromHeader==='UNKNOWN'?null:
      (x.mapperFamilyFromHeader==='MBC1'?p.bank!==32:true))))&&
   closure.romxHeaderConditionalExcludedMappingsTotal===
    closure.romxStandardMbc1ConditionalSites,
   'ROM0 ROMX cross-bank physical-location integrity mismatch: '+variant);
  const romLabel='ROM_'+variant.toUpperCase();
  log(romLabel+'_ROMX_SITE_COUNT='+closure.romxTransferSites.length);
  log(romLabel+'_JPHL_SITE_COUNT='+closure.indirectSiteDetails.length);
  log(romLabel+'_ROMX_PHYSICAL_MAPPING_COUNT='+closure.romxPhysicalMappingsTotal);
  log(romLabel+'_ROMX_ACTIVE_BANKS_VERIFIED='+closure.romxActiveBanksVerified);
  log(romLabel+'_ROMX_STANDARD_MBC1_CONDITIONAL_SITES='+closure.romxStandardMbc1ConditionalSites);
  log(romLabel+'_ROMX_HEADER_CONDITIONAL_EXCLUDED_MAPPINGS='+closure.romxHeaderConditionalExcludedMappingsTotal);
  log(romLabel+'_CARTRIDGE_TYPE_HEADER_DEC='+rom[0x147]);
  log(romLabel+'_ROM_SIZE_HEADER_DEC='+rom[0x148]);
  log(romLabel+'_RAM_SIZE_HEADER_DEC='+rom[0x149]);
  log(romLabel+'_ROMX_MAPPER_FAMILY_HEADER='+closure.romxTransferSites[0].mapperFamilyFromHeader);
  log(romLabel+'_ROMX_DECLARED_MAPPER_CANDIDATES_PER_SITE='+
   (closure.romxTransferSites[0].declaredMapperRomxCandidateCount??'UNKNOWN'));
  log(romLabel+'_ROMX_MBC5_BANK_ZERO_CANDIDATE_SITES='+closure.romxMbc5BankZeroCandidateSites);
  assert(closure.mbc3DirectWriteSites.every(s=>
   Number.isInteger(s.rom0Pc)&&s.rom0Pc>=0&&s.rom0Pc<0x4000-2&&
   (rom[s.rom0Pc]===0xea||rom[s.rom0Pc]===0x08)&&
   s.witnessPath.length>0&&s.witnessPath[0].pc===s.originRootCpu&&
   s.runtimeValueKnown===false&&s.executed===false&&
   s.literalTargets.every(t=>t.targetCpu>=0&&t.targetCpu<0x8000&&
    t.valueKnown===false&&t.bankSelected===null))&&
   closure.mbc3DirectWriteSiteCount===closure.mbc3DirectWriteSites.length&&
   closure.mbc3LiteralRomBankWriteSites===
    closure.mbc3DirectWriteSites.filter(s=>s.literalTargets.some(
     t=>t.registerKind==='ROM_BANK_NUMBER')).length&&
   closure.mbc3DirectWritesExecuted===0&&
   closure.mbc3BankValuesRuntimeVerified===0&&
   closure.mbc3IndirectWriteCoverageComplete===false,
   'MBC3 literal register write evidence invalid: '+variant);
  log(romLabel+'_MBC3_DIRECT_LITERAL_WRITE_SITES='+closure.mbc3DirectWriteSiteCount);
  log(romLabel+'_MBC3_ROM_BANK_WRITE_SITES='+closure.mbc3LiteralRomBankWriteSites);
  log(romLabel+'_MBC3_DIRECT_WRITES_EXECUTED='+closure.mbc3DirectWritesExecuted);
  log(romLabel+'_MBC3_BANK_VALUES_RUNTIME_VERIFIED='+closure.mbc3BankValuesRuntimeVerified);
  assert(closure.mbc3AdjacentIndirectWriteSites.every(s=>
   Number.isInteger(s.rom0Pc)&&s.rom0Pc>=3&&s.rom0Pc<0x4000&&
   s.previousPc===s.rom0Pc-3&&s.witnessPath.length>1&&
   s.witnessPath[s.witnessPath.length-2].pc===s.previousPc&&
   s.witnessPath[s.witnessPath.length-1].pc===s.rom0Pc&&
   s.witnessPath[s.witnessPath.length-1].via==='fallthrough'&&
   s.targetCpu>=0&&s.targetCpu<0x8000&&
   s.executed===false&&s.activeBankKnown===false)&&
   closure.mbc3AdjacentIndirectWriteSiteCount===
    closure.mbc3AdjacentIndirectWriteSites.length&&
   closure.mbc3AdjacentIndirectRomBankWriteSites===
    closure.mbc3AdjacentIndirectWriteSites.filter(s=>
     s.registerKind==='ROM_BANK_NUMBER').length&&
   closure.mbc3DirectLiteralAProvenanceSites===
    closure.mbc3DirectWriteSites.filter(s=>s.adjacentLiteralAProvenance!==null).length&&
   closure.mbc3DirectWriteSites.every(s=>
    s.adjacentLiteralAProvenance===null||
    (s.opcode===0xea&&
     rom[s.rom0Pc-2]===0x3e&&
     rom[s.rom0Pc-1]===s.adjacentLiteralAProvenance.conditionalImmediateAValue)),
   'MBC3 conditional immediate or indirect write provenance invalid: '+variant);
  assert(closure.mbc3DirectWriteSites.every(s=>
   s.opcode!==0xea||
   (s.aSourceProvenance?.verified===true&&
    s.aSourceProvenance.writePc===s.rom0Pc&&
    s.aSourceProvenance.executed===false&&
    s.aSourceProvenance.runtimeValueKnown===false&&
    s.aSourceProvenance.activeBankKnown===false&&
    (s.aSourceProvenance.sourcePc===null||
     (s.aSourceProvenance.sourcePc>=0&&
      s.aSourceProvenance.sourcePc<s.rom0Pc&&
      rom[s.aSourceProvenance.sourcePc]===s.aSourceProvenance.sourceOpcode))))&&
   closure.mbc3ABoundedImmediateSites+
    closure.mbc3ABoundedRegisterOrMemorySites+
    closure.mbc3AUnresolvedSites<=closure.mbc3DirectWriteSiteCount,
   'MBC3 bounded A source evidence invalid: '+variant);
  assert(closure.mbc3DirectWriteSites.every(s=>
   s.registerInputProvenance===null||
   (s.registerInputProvenance.verified===true&&
    s.registerInputProvenance.sourcePc===s.aSourceProvenance?.sourcePc&&
    s.registerInputProvenance.sourceRegister===s.aSourceProvenance?.sourceRegister&&
    s.registerInputProvenance.executed===false&&
    s.registerInputProvenance.runtimeValueKnown===false&&
    s.registerInputProvenance.activeBankKnown===false&&
    (s.registerInputProvenance.originPc===null||
     (s.registerInputProvenance.originPc<s.registerInputProvenance.sourcePc&&
      rom[s.registerInputProvenance.originPc]===s.registerInputProvenance.originOpcode))))&&
   closure.mbc3RegisterInputTracedSites===
    closure.mbc3DirectWriteSites.filter(s=>s.registerInputProvenance?.verified===true).length&&
   closure.mbc3RegisterInputConditionalByteSites===
    closure.mbc3DirectWriteSites.filter(s=>
     s.registerInputProvenance?.conditionalByte!==null&&
     s.registerInputProvenance?.conditionalByte!==undefined).length,
   'MBC3 register lineage evidence mismatch: '+variant);
  const plan=closure.mbc3SourceObservationPlan;
  assert(plan.verified===true&&plan.siteCount===closure.mbc3LiteralRomBankWriteSites&&
   plan.runtimeBankVerified===false&&plan.runtimeReadCount===0&&
   plan.sites.every(s=>s.executed===false&&s.bankActiveVerified===false&&
    s.readbackPerformed===false)&&
   plan.uniqueRamAddresses.every(a=>
    (a>=0xc000&&a<=0xdfff)||(a>=0xff80&&a<=0xfffe)),
   'MBC3 read-only observation plan mismatch: '+variant);
  log(romLabel+'_MBC3_SOURCE_PLAN_KIND_COUNTS='+JSON.stringify(plan.kinds));
  log(romLabel+'_MBC3_SOURCE_PLAN_RAM_ADDRESSES='+JSON.stringify(plan.uniqueRamAddresses));
  log(romLabel+'_MBC3_SOURCE_PLAN_RAM_ADDRESS_COUNT='+plan.uniqueRamAddressCount);
  log(romLabel+'_MBC3_SOURCE_PLAN_RUNTIME_READS='+plan.runtimeReadCount);
  log(romLabel+'_MBC3_SOURCE_PLAN_SITES='+JSON.stringify(plan.sites));
  log(romLabel+'_MBC3_REGISTER_INPUT_TRACED_SITES='+closure.mbc3RegisterInputTracedSites);
  log(romLabel+'_MBC3_REGISTER_INPUT_CONDITIONAL_BYTE_SITES='+closure.mbc3RegisterInputConditionalByteSites);
  log(romLabel+'_MBC3_REGISTER_INPUT_UNRESOLVED_SITES='+closure.mbc3RegisterInputUnresolvedSites);
  log(romLabel+'_MBC3_REGISTER_INPUT_EVIDENCE='+JSON.stringify(
   closure.mbc3DirectWriteSites.filter(s=>s.registerInputProvenance!==null).map(s=>({
    rom0Pc:s.rom0Pc,sourcePc:s.registerInputProvenance.sourcePc,
    sourceRegister:s.registerInputProvenance.sourceRegister,
    originPc:s.registerInputProvenance.originPc,
    originKind:s.registerInputProvenance.originKind,
    conditionalByte:s.registerInputProvenance.conditionalByte,
    stopReason:s.registerInputProvenance.stopReason,
    scannedInstructions:s.registerInputProvenance.scannedInstructions,
    executed:false,runtimeValueKnown:false
   }))));
  log(romLabel+'_MBC3_A_BOUNDED_IMMEDIATE_SITES='+closure.mbc3ABoundedImmediateSites);
  log(romLabel+'_MBC3_A_BOUNDED_REGISTER_MEMORY_SITES='+closure.mbc3ABoundedRegisterOrMemorySites);
  log(romLabel+'_MBC3_A_UNRESOLVED_SITES='+closure.mbc3AUnresolvedSites);
  log(romLabel+'_MBC3_A_SOURCE_EVIDENCE='+JSON.stringify(
   closure.mbc3DirectWriteSites.filter(s=>s.aSourceProvenance!==null).map(s=>({
    rom0Pc:s.rom0Pc,originRootCpu:s.originRootCpu,
    sourcePc:s.aSourceProvenance.sourcePc,
    sourceKind:s.aSourceProvenance.sourceKind,
    sourceOpcode:s.aSourceProvenance.sourceOpcode,
    conditionalByte:s.aSourceProvenance.conditionalByte,
    sourceAddressCpu:s.aSourceProvenance.sourceAddressCpu,
    sourceRegister:s.aSourceProvenance.sourceRegister,
    scannedInstructions:s.aSourceProvenance.scannedInstructions,
    stopReason:s.aSourceProvenance.stopReason,
    executed:false,runtimeValueKnown:false
   }))));
  log(romLabel+'_MBC3_DIRECT_LITERAL_A_SITES='+closure.mbc3DirectLiteralAProvenanceSites);
  log(romLabel+'_MBC3_ADJACENT_INDIRECT_WRITE_SITES='+closure.mbc3AdjacentIndirectWriteSiteCount);
  log(romLabel+'_MBC3_ADJACENT_INDIRECT_ROM_BANK_WRITE_SITES='+closure.mbc3AdjacentIndirectRomBankWriteSites);
  log(romLabel+'_MBC3_ADJACENT_INDIRECT_WRITE_EVIDENCE='+
   JSON.stringify(closure.mbc3AdjacentIndirectWriteSites));
  log(romLabel+'_MBC3_WRITE_EVIDENCE='+JSON.stringify(closure.mbc3DirectWriteSites));
  log(romLabel+'_ROMX_EVIDENCE_SCHEMA=ROM0_ROMX_WITNESS_V1');
  log('ROM_'+variant.toUpperCase()+'_ROMX_SITE_EVIDENCE='+
   JSON.stringify(closure.romxTransferSites.map(x=>({
    fromRom0Cpu:x.fromRom0Cpu,opcode:x.opcode,
    transferKind:x.transferKind,targetCpu:x.targetCpu,
    originRootCpu:x.originRootCpu,witnessPath:x.witnessPath,
    physicallyMappedBanks:x.physicallyMappedBanks,
    mapperFamilyFromHeader:x.mapperFamilyFromHeader,
    declaredMapperRomxCandidateCount:x.declaredMapperRomxCandidateCount,
    mbc5BankZeroCandidate:x.mbc5BankZeroCandidate,
    standardMbc1Conditional:x.standardMbc1Conditional,
    excludedIfStandardMbc1:x.excludedIfStandardMbc1,
    conditionalCandidateCount:x.conditionalCandidateCount,
    firstOpcodeDecodableBanks:x.firstOpcodeDecodableBanks,
    firstOpcodeDecodableBankIds:x.physicalMappings
     .filter(b=>b.firstOpcodeDecodable).map(b=>b.bank),
    activeBankKnown:false,transferExecuted:false,
    physicalOffsetFormula:'bank*0x4000+targetCpu-0x4000'
   }))));
  log('ROM_'+variant.toUpperCase()+'_JPHL_SITE_EVIDENCE='+
   JSON.stringify(closure.indirectSiteDetails));
  const rows=a.maps.flatMap(m=>m.interactions)
   .filter(x=>x.scriptCommand==='TX_START_ASM');
  assert(rows.length===626&&rows.every(x=>x.asmCandidate?.verified===true&&
   x.asmCandidate.txAsmFileOffset===x.scriptFileOffset&&
   x.asmCandidate.scriptEffectsVerified===false&&x.asmCandidate.executed===false),
   'TX_ASM evidence invalid: '+variant);
  originals[variant]=rom;
  fs.writeFileSync(path.join(work,OUTPUTS[variant]),rom,{flag:'wx'});
  fs.writeFileSync(path.join(work,PROFILES[variant]),JSON.stringify(p),{flag:'wx'});
  log('ROM_'+variant.toUpperCase()+'_MAPS_WITH_NORMAL_HEADER='+gaps.summary.normalMapHeaders);
  log('ROM_'+variant.toUpperCase()+'_MAP_IDS_WITHOUT_NORMAL_HEADER='+gaps.summary.idsWithoutNormalHeader);
  log('ROM_'+variant.toUpperCase()+'_HIDDEN_ITEMS_UNASSIGNED='+gaps.summary.hiddenItemsWithoutNormalHeader);
  log('ROM_'+variant.toUpperCase()+'_STATIC_ACTIONS='+gaps.summary.staticallyIndexedActions);
  log('ROM_'+variant.toUpperCase()+'_SCRIPT_EFFECTS_UNVERIFIED='+gaps.summary.unverifiedScriptEffects);
  log('ROM_'+variant.toUpperCase()+'_SCRIPT_EVENT_BITS_LINKED='+gaps.summary.verifiedRomEventBitBindings);
  log('ROM_'+variant.toUpperCase()+'_TRAINER_SCRIPT_BITS_LINKED='+a.summary.trainerEventFlagBindings);
  log('ROM_'+variant.toUpperCase()+'_STATIC_ENCOUNTER_SCRIPT_BITS_LINKED='+a.summary.stationaryEventFlagBindings);
  log('ROM_'+variant.toUpperCase()+'_SPECIAL_TRAINER_BITS_LINKED='+a.summary.specialTrainerEventFlagBindings);
  log('ROM_'+variant.toUpperCase()+'_TRAINER_SCRIPT_BITS_MISSING='+a.summary.trainerEventFlagBindingsMissing);
  log('ROM_'+variant.toUpperCase()+'_TRAINER_SCRIPT_BITS_UNKNOWN_CONTEXT='+
   JSON.stringify(gaps.summary.trainerScriptUnresolvedReferences));
  log('ROM_'+variant.toUpperCase()+'_RUNTIME_EVENT_BITS_VERIFIED='+gaps.summary.liveEventBitValuesVerified);
  log('ROM_'+variant.toUpperCase()+'_ROM0_BRANCH_PHYSICAL_REFERENCES='+gaps.summary.mappedRom0BranchReferences);
  log('ROM_'+variant.toUpperCase()+'_ROM0_CALL_PHYSICAL_REFERENCES='+gaps.summary.mappedRom0CallReferences);
  log('ROM_'+variant.toUpperCase()+'_ROM0_UNION_DISTINCT_TARGETS='+gaps.summary.distinctRom0PhysicalTargets);
  log('ROM_'+variant.toUpperCase()+'_ROM0_DISTINCT_PHYSICAL_TARGETS='+gaps.summary.distinctRom0PhysicalTargets);
  log('ROM_'+variant.toUpperCase()+'_ROM0_OPCODE_CANDIDATES='+gaps.summary.boundedRom0OpcodeCandidates);
  log('ROM_'+variant.toUpperCase()+'_ROM0_EFFECTS_STILL_UNKNOWN='+gaps.summary.rom0StillSemanticallyUnknown);
  log('ROM_'+variant.toUpperCase()+'_ROM0_DECODE_PROBLEMS='+a.summary.rom0DecodeProblems);
  log('ROM_'+variant.toUpperCase()+'_ROM0_FIRST_PASS_LIMITS='+a.summary.rom0FirstPassLimitHits);
  log('ROM_'+variant.toUpperCase()+'_ROM0_EXPANDED_TARGETS='+a.summary.rom0ExpandedTargets);
  log('ROM_'+variant.toUpperCase()+'_ROM0_ADDITIONAL_CANDIDATE_INSTRUCTIONS='+a.summary.rom0AdditionalCandidateInstructions);
  log('ROM_'+variant.toUpperCase()+'_ROM0_INTERMEDIATE_128_LIMITS='+a.summary.rom0Intermediate128LimitHits);
  log('ROM_'+variant.toUpperCase()+'_ROM0_WHOLE_BANK_PASSES='+a.summary.rom0WholeBankPasses);
  log('ROM_'+variant.toUpperCase()+'_ROM0_WHOLE_BANK_NEW_INSTRUCTIONS='+a.summary.rom0ThirdPassAdditionalCandidateInstructions);
  log('ROM_'+variant.toUpperCase()+'_ROM0_STATIC_CANDIDATE_WALKS_DRAINED='+a.summary.rom0StaticCandidateWalkExhausted);
  log('ROM_'+variant.toUpperCase()+'_ROM0_RESIDUAL_LIMITS='+a.summary.rom0ExpandedStillLimited);
  log('ROM_'+variant.toUpperCase()+'_ROM0_SCAN_LIMITS='+a.summary.rom0StillBudgetLimited);
  log('ROM_'+variant.toUpperCase()+'_SCRIPT_EFFECTS_CERTIFIED=0');
  log('ROM_'+variant.toUpperCase()+'_ASM_ABSOLUTE_MEMORY_OPERANDS='+a.summary.uniqueAsmMemoryOperandInstructions);
  log('ROM_'+variant.toUpperCase()+'_ASM_DIRECT_WRAM_READ_CANDIDATES='+a.summary.uniqueAsmDirectWramReadCandidates);
  log('ROM_'+variant.toUpperCase()+'_ASM_DIRECT_WRAM_WRITE_CANDIDATES='+a.summary.uniqueAsmDirectWramWriteCandidates);
  log('ROM_'+variant.toUpperCase()+'_ASM_WRAM_POINTER_CONSTANTS='+a.summary.uniqueAsmWramPointerLiterals);
  log('ROM_'+variant.toUpperCase()+'_ASM_EVENT_BIT_TEST_CANDIDATES='+a.summary.uniqueAsmFlagBitTestCandidates);
  log('ROM_'+variant.toUpperCase()+'_ASM_EVENT_BIT_SET_CANDIDATES='+a.summary.uniqueAsmFlagBitSetCandidates);
  log('ROM_'+variant.toUpperCase()+'_ASM_EVENT_BIT_RESET_CANDIDATES='+a.summary.uniqueAsmFlagBitResetCandidates);
  log('ROM_'+variant.toUpperCase()+'_FLAG_CONDITIONAL_BRANCH_GATES='+a.summary.uniqueAsmFlagConditionalBranchGates);
  log('ROM_'+variant.toUpperCase()+'_FLAG_BRANCH_INTERVENING_SAFE_LOADS='+a.summary.uniqueAsmFlagInterveningSafeLoads);
  log('ROM_'+variant.toUpperCase()+'_FLAG_DUAL_TX_FAR_ALTERNATIVES='+a.summary.uniqueAsmFlagDualTextAlternatives);
  log('ROM_'+variant.toUpperCase()+'_STATIC_FLAG_POTENTIAL_LINKS='+a.summary.staticFlagCandidateLinks);
  log('ROM_'+variant.toUpperCase()+'_STATIC_FLAG_CROSS_MAP_POTENTIAL_LINKS='+a.summary.staticFlagCandidateCrossMapLinks);
  const candidateGraph=buildStaticWorldFlagDependencies({atlas:a});
  assert(candidateGraph.verified===true&&
   candidateGraph.summary.totalPotentialLinks===8&&
   candidateGraph.summary.crossMapPotentialLinks===5&&
   candidateGraph.summary.conditionalBranchLinksDecoded===8&&
   candidateGraph.summary.dualTextChoiceLinksDecoded===4&&
   candidateGraph.summary.trustedCausalLinks===0&&
   candidateGraph.candidateLinks.every(x=>
    x.referenceNameSource==='pret/pokered'&&
    x.referenceNameIsRomIntrinsic===false&&
    typeof x.referenceEventName==='string'&&
    referenceMapNames.mapNamesById[x.possibleWriterMapId]===
      x.writerReferenceMapName&&
    referenceMapNames.mapNamesById[x.possibleReaderMapId]===
      x.readerReferenceMapName&&
    referenceEventNames.eventNamesByBit[x.bitIndex]===x.referenceEventName),

   'Original ROM map candidate flag links invalid: '+variant);
  assert(referenceEventNames.namedBitCount===507&&
   referenceMapNames.totalMapIds===248&&
   referenceMapNames.mapNamesById.length===248,
   'Pinned disassembly reference labels invalid');
  log('ROM_'+variant.toUpperCase()+'_REFERENCE_NAMED_EVENT_BITS=507');
  log('ROM_'+variant.toUpperCase()+'_REFERENCE_NAMED_MAP_IDS=248');
  crossRomFlagGraphs[variant]=candidateGraph;
  const everyFlag=buildGlobalFlagOperationCatalogue({atlas:a});
  assert(everyFlag.verified===true&&everyFlag.totalHandlerScopedOperations===135&&
   everyFlag.handlerScopedOperationCounts.BIT_TEST===90&&
   everyFlag.handlerScopedOperationCounts.SET_BIT===41&&
   everyFlag.handlerScopedOperationCounts.RESET_BIT===4&&
   everyFlag.handlerScopedBitBranches===88&&
   everyFlag.handlerScopedDualTextChoices===16&&
   everyFlag.handlerScopedWritesIfExecuted===45&&
   everyFlag.conditionalMemoryWritesIfExecuted>=1&&
   everyFlag.executedOperationsCertified===0,
   'All-map static WRAM-bit operation catalogue invalid: '+variant+
   ': '+everyFlag.reason);
  log('ROM_'+variant.toUpperCase()+'_ALL_FLAG_UNIQUE_PHYSICAL_OPERATIONS='+
   everyFlag.totalPhysicallyDecodedOperations);
  log('ROM_'+variant.toUpperCase()+'_ALL_FLAG_HANDLER_SCOPED_OPERATIONS=135');
  log('ROM_'+variant.toUpperCase()+'_ALL_FLAG_ACTOR_REFERENCES='+
   everyFlag.operationReferences);
  log('ROM_'+variant.toUpperCase()+'_ALL_FLAG_MAPS_WITH_OPERATIONS='+
   everyFlag.mapsWithBitOperations);
  log('ROM_'+variant.toUpperCase()+'_ALL_FLAG_REFERENCED_NAMED_EVENTS='+
   everyFlag.eventNamedOperations);
  log('ROM_'+variant.toUpperCase()+'_ALL_FLAG_OPERATIONS_EXECUTED=0');
  log('ROM_'+variant.toUpperCase()+'_ALL_FLAG_CONDITIONAL_WRITES_PER_HANDLER=45');
  log('ROM_'+variant.toUpperCase()+'_ALL_FLAG_CONDITIONAL_PHYSICAL_WRITES='+
   everyFlag.conditionalMemoryWritesIfExecuted);
  const namedCoverage=buildNamedEventEvidenceLedger({atlas:a});
  assert(namedCoverage.verified===true&&namedCoverage.flags.length===507&&
   namedCoverage.summary.namedReferenceEvents===507&&
   namedCoverage.summary.fullyExplainedNamedEvents===0&&
   namedCoverage.summary.eventCompletionsObserved===0&&
   namedCoverage.semanticallyComplete===false,
   'Named event coverage evidence invalid: '+variant+' '+namedCoverage.reason);
  // The RAM bits below are intentionally synthetic zeroes, used ONLY to
  // validate static map associations against each real SHA-audited ROM.
  // Never report these as active emulator progress.
  const syntheticEventAtlas={
   verified:true,romSha256:KNOWN[variant],
   summary:{namedEventBits:507},
   events:Object.entries(referenceEventNames.eventNamesByBit).map(
    ([bit,name])=>({eventBitIndex:Number(bit),name,flagSet:false}))
  };
  const worldwideNamed=buildWorldwideNamedEventCoverage({
   ledger:namedCoverage,worldEventAtlas:syntheticEventAtlas,
   mapReferences:p.world.maps.data
  });
  assert(worldwideNamed.verified===true&&
   worldwideNamed.summary.mapIds===248&&
   worldwideNamed.summary.normalHeaders===226&&
   worldwideNamed.maps[61].mapName==='MT_MOON_B2F'&&
   worldwideNamed.maps[61].mapNameOrigin==='pret/pokered'&&
   worldwideNamed.maps[61].mapNameIntrinsicToRom===false&&
   worldwideNamed.summary.namedBitsWithMapEvidence===400&&
   worldwideNamed.summary.namedBitsWithNoDirectMapEvidence===107&&
   worldwideNamed.summary.namedReferenceEvents===507&&
   worldwideNamed.actionsObserved===false&&
   worldwideNamed.gameplayComplete===false,
   'Worldwide named event ROM map coverage inconsistent: '+variant+' '+
   worldwideNamed.reason);
  log('ROM_'+variant.toUpperCase()+'_WORLD_MAPS_INDEXED=248');
  log('ROM_'+variant.toUpperCase()+'_WORLD_NORMAL_HEADERS=226');
  log('ROM_'+variant.toUpperCase()+'_WORLD_MAP_NAMES_REFERENCE_VERIFIED=248');
  log('ROM_'+variant.toUpperCase()+'_WORLD_MAP_NAMES_FROM_ROM_BYTES=FALSE');
  log('ROM_'+variant.toUpperCase()+'_WORLD_NAMED_BITS_WITH_MAP_EVIDENCE='+
   worldwideNamed.summary.namedBitsWithMapEvidence);
  log('ROM_'+variant.toUpperCase()+'_WORLD_NAMED_BITS_WITHOUT_MAP_EVIDENCE='+
   worldwideNamed.summary.namedBitsWithNoDirectMapEvidence);
  log('ROM_'+variant.toUpperCase()+'_WORLD_MAPS_WITH_NAMED_EVENTS='+
   worldwideNamed.summary.mapIdsWithCandidates);
  log('ROM_'+variant.toUpperCase()+'_WORLD_CANDIDATE_ASSOCIATIONS='+
   worldwideNamed.summary.worldCandidateAssociations);
  log('ROM_'+variant.toUpperCase()+'_WORLD_MULTI_MAP_REFERENCED_BITS='+
   worldwideNamed.summary.multiMapReferencedBits);
  log('ROM_'+variant.toUpperCase()+'_WORLD_UNMAPPED_NAMES_FIRST_20='+
   JSON.stringify(worldwideNamed.unmappedEvents.slice(0,20).map(
    x=>({eventBitIndex:x.eventBitIndex,name:x.name}))));
  log('ROM_'+variant.toUpperCase()+'_WORLD_TOP_10_REFERENCE_MAPS='+
   JSON.stringify(worldwideNamed.maps.filter(x=>x.namedCandidateBits>0)
    .sort((a,b)=>b.namedCandidateBits-a.namedCandidateBits||a.mapId-b.mapId)
    .slice(0,10).map(x=>({mapId:x.mapId,mapName:x.mapName,
     candidates:x.namedCandidateBits}))));
  log('ROM_'+variant.toUpperCase()+'_WORLD_MAP_BITS_SYNTHETIC_ONLY=TRUE');
  // Verify ALL 2560 physical D747 bit positions against this ROM's
  // exact actors and opcodes; zeroed bits are test fixtures, NOT live RAM.
  const zeroWorldHex=Array(320).fill('00');
  const worldReference=buildWorldEventAtlas({
   romSha256:KNOWN[variant],romIdentityMatched:true,
   mapWindowVerified:true,eventFlagsHex:zeroWorldHex,
   toggleFlagsHex:Array(32).fill('00')
  });
  const bitInventory=buildCompleteEventBitmap({
   romSha256:KNOWN[variant],romIdentityMatched:true,
   mapPositionVerified:true,interactionAtlas:a,
   namedAtlas:worldReference,eventFlagsHex:zeroWorldHex,
   globalFlagReadback:{
    verified:true,worldEventBytesMatched:320,allFlagBytesMatched:368,
    romAndMapCorroborated:true,snapshotAtomicVerified:false
   }
  });
  assert(bitInventory.verified===true&&
   bitInventory.summary.bitPositionsIndexed===2560&&
   bitInventory.summary.namedReferenceBits===507&&
   bitInventory.summary.unnamedOrReservedBits===2053&&
   bitInventory.summary.bitPositionsWithDirectRomEvidence===
    400+bitInventory.summary.unnamedBitPositionsWithDirectRomEvidence&&
   bitInventory.bits.length===2560&&
   bitInventory.gameplayCompletionCertified===false,
   'Full 2560-bit static fixture inventory invalid: '+variant+' '+
    bitInventory.reason);
  log('ROM_'+variant.toUpperCase()+'_EVENT_BITS_PHYSICAL_POSITIONS=2560');
  log('ROM_'+variant.toUpperCase()+'_EVENT_BITS_NAMED_REFERENCE=507');
  log('ROM_'+variant.toUpperCase()+'_EVENT_BITS_UNNAMED_OR_RESERVED=2053');
  log('ROM_'+variant.toUpperCase()+'_EVENT_BITS_UNNAMED_WITH_DIRECT_ROM_EVIDENCE='+
   bitInventory.summary.unnamedBitPositionsWithDirectRomEvidence);
  log('ROM_'+variant.toUpperCase()+'_EVENT_BITS_SYNTHETIC_RAM_ONLY=TRUE');
  log('ROM_'+variant.toUpperCase()+'_EVENT_LABELS_TOTAL=507');
  log('ROM_'+variant.toUpperCase()+'_EVENT_BITS_WITH_OPCODE_EVIDENCE='+
   namedCoverage.summary.namedBitsWithRomOpcode);
  log('ROM_'+variant.toUpperCase()+'_EVENT_BITS_WITH_HEADER_BINDINGS='+
   namedCoverage.summary.namedBitsWithActorHeaderBinding);
  log('ROM_'+variant.toUpperCase()+'_EVENT_BITS_WITHOUT_DIRECT_EVIDENCE='+
   namedCoverage.summary.namedBitsWithoutAnyDirectEvidence);
  log('ROM_'+variant.toUpperCase()+'_EVENT_EVIDENCE_CATEGORIES='+
   JSON.stringify(namedCoverage.summary.categories));
  const gapIndex=namedCoverage.unresolvedNamedFlagEvidence;
  assert(gapIndex?.gameplayCompletionEvidence===false&&
   gapIndex.noDirectEvidenceCount===
    namedCoverage.summary.categories.NO_DIRECT_EVIDENCE&&
   gapIndex.headerOnlyCount===
    namedCoverage.summary.categories.HEADER_BINDING_ONLY,
   'Named event gap index inconsistent: '+variant);
  log('ROM_'+variant.toUpperCase()+'_EVENT_NO_DIRECT_EVIDENCE_FIRST_20='+
   JSON.stringify(gapIndex.noDirectEvidenceFlags.slice(0,20)));
  log('ROM_'+variant.toUpperCase()+'_EVENT_HEADER_ONLY_FIRST_20='+
   JSON.stringify(gapIndex.headerOnlyFlags.slice(0,20)));
  log('ROM_'+variant.toUpperCase()+'_EVENTS_FULLY_EXPLAINED=0');
  log('ROM_'+variant.toUpperCase()+'_ALL_FLAG_OPERATIONS_COUNTS='+
   JSON.stringify(everyFlag.handlerScopedOperationCounts));
  log('ROM_'+variant.toUpperCase()+'_ALL_FLAG_MAP_COUNTS='+
   JSON.stringify(everyFlag.perMap.filter(x=>x.operationReferences>0)));
  log('ROM_'+variant.toUpperCase()+'_STATIC_FLAG_CAUSAL_LINKS_VERIFIED=0');
  log('ROM_'+variant.toUpperCase()+'_STATIC_FLAG_CANDIDATE_DETAILS='+JSON.stringify(
   candidateGraph.candidateLinks.map(link=>({
    domain:link.domain,bitIndex:link.bitIndex,
    writerMapId:link.possibleWriterMapId,
    writerKind:link.possibleWriterKind,
    writerOrdinal:link.possibleWriterOrdinal,
    writerAsmOffset:link.writerRomHandlerOffset,
    writerExternalMapLabel:link.writerReferenceMapName,
    externalEventLabel:link.referenceEventName,
    externalLabelsSource:link.referenceNameSource,
    labelsNotFromRomBytes:true,
    writeOpcode:link.possibleWriteOpcode,
    readerMapId:link.possibleReaderMapId,
    readerKind:link.possibleReaderKind,
    readerOrdinal:link.possibleReaderOrdinal,
    readerAsmOffset:link.readerRomHandlerOffset,
    readerExternalMapLabel:link.readerReferenceMapName,
    crossMap:!link.sameMap,
    readerBranchCondition:link.readerBranchCondition?.condition||null,
    readerBranchCpu:link.readerBranchCondition?.branchCpu??null,
    readerBranchTargetCpu:link.readerBranchCondition?.takenTargetCpu??null,
    readerJumpTakenIfBitSet:link.readerBranchCondition?.jumpTakenIfBitSet??null,
    readerInterveningFlagPreservingLoad:
     link.readerBranchCondition?.interveningFlagsPreservingInstruction?.opcode??null,
    twoRomTxFarTextOptionsVerified:link.readerTwoAlternativeTextScriptsVerified,
    textOnBitClearCpu:link.readerDualTextChoice?.textOnBitClearPointerCpu??null,
    textOnBitSetCpu:link.readerDualTextChoice?.textOnBitSetPointerCpu??null,
    sharedTextCallCpu:link.readerDualTextChoice?.sharedCallCpu??null,
    causalEffectCertified:false
   }))
  ));
  log('ROM_'+variant.toUpperCase()+'_ASM_MEMORY_WRITES_EXECUTED=0');
  log('ROM_'+variant.toUpperCase()+'_TEXT_DISPATCH_CLASS_COUNTS='+JSON.stringify(a.summary.dispatchClassCounts));
  log('ROM_'+variant.toUpperCase()+'_TEXT_DISPATCH_COMMAND_COUNTS='+JSON.stringify(a.summary.commandCounts));

  log('ROM_'+variant.toUpperCase()+'_RUNTIME_ACTIONS_UNPROVEN='+gaps.summary.runtimeActionsUnproven);
  log('ROM_'+variant.toUpperCase()+'_GAP_HOTSPOTS='+JSON.stringify(gaps.priorities));
  log('ROM_'+variant.toUpperCase()+'_ASM_REFERENCES=626');
  log('ROM_'+variant.toUpperCase()+'_UNIQUE_ENTRYPOINTS='+a.summary.uniqueAsmEntrypoints);
  log('ROM_'+variant.toUpperCase()+'_CANDIDATE_INSTRUCTIONS='+a.summary.uniqueAsmCandidateInstructions);
  log('ROM_'+variant.toUpperCase()+'_UNFOLLOWED_CALLS='+a.summary.uniqueAsmCallsNotFollowed);
  log('ROM_'+variant.toUpperCase()+'_UNRESOLVED_TARGETS='+a.summary.uniqueAsmUnresolvedTargets);
  log('ROM_'+variant.toUpperCase()+'_FIRST_PASS_LIMIT_HITS='+a.summary.uniqueAsmFirstPassLimitHits);
  log('ROM_'+variant.toUpperCase()+'_EXPANDED_ENTRYPOINTS='+a.summary.uniqueAsmExpandedEntrypoints);
  log('ROM_'+variant.toUpperCase()+'_ADDITIONAL_CANDIDATE_INSTRUCTIONS='+a.summary.uniqueAsmAdditionalCandidateInstructions);
  log('ROM_'+variant.toUpperCase()+'_EXPANDED_STILL_LIMITED='+a.summary.uniqueAsmExpandedStillLimited);
  log('ROM_'+variant.toUpperCase()+'_UNRESOLVED_REASON_COUNTS='+JSON.stringify(a.summary.asmUnresolvedReasonCounts));
  log('ROM_'+variant.toUpperCase()+'_UNFOLLOWED_CALL_CLASSES='+JSON.stringify(a.summary.asmUnfollowedCallClasses));
  log('ROM_'+variant.toUpperCase()+'_SCAN_LIMIT_HITS='+a.summary.uniqueAsmScanLimitHits);
 }
 log('STEP=CROSS_ROM_FLAG_CONDITION_COMPARISON');
 const comparison=compareCrossVariantFlagSemantics({graphs:crossRomFlagGraphs});
 assert(comparison.verified===true&&
  comparison.linkedFlagCandidatesPerRom===8&&
  comparison.crossMapCandidatesPerRom===5&&
  comparison.totalPermittedCallRelocations===4&&
  comparison.sameCausalOutcomeVerified===false,
  'Cross-version static flag evidence inconsistent: '+comparison.reason);
 log('CROSS_ROM_FLAG_SEMANTICS_COMPARED=TRUE');
 log('CROSS_ROM_EXPECTED_CALL_RELOCATIONS=4');
 log('CROSS_ROM_DIFFERENCES='+JSON.stringify(comparison.differences));
 log('CROSS_ROM_SAME_GAMEPLAY_OUTCOME_CERTIFIED=FALSE');
 env.POKEMON_RED_ROM=path.join(work,OUTPUTS.red);
 env.POKEMON_BLUE_ROM=path.join(work,OUTPUTS.blue);
 env.POKEMON_GREEN_ROM=path.join(work,OUTPUTS.green);
 env.POKEMON_ROM_PATH=env.POKEMON_RED_ROM;
 env.POKEMON_ROM_DIR=work;
 env.POKEMON_ROM_PROFILE_DIR=work;
 env.POKEGUIDE_ATLAS_JSON=ATLAS;
 env.POKEGUIDE_INVENTORY_JSON=ATLAS;
 log('STEP=TARGETED_ASM_AND_UI_TESTS');
 runTests('ASM_TARGETED',[
  'tests/romTxAsmHandlerAtlas.test.js',
  'tests/romAsmAbsoluteMemoryEvidence.test.js',
  'tests/romAsmEventBitEvidence.test.js',
  'tests/romAsmFlagBranchAnalysis.test.js',
  'tests/romReferenceSemantics.test.js',
  'tests/romCrossVariantFlagSemantics.test.js',
  'tests/romGlobalFlagOperationCatalogue.test.js',
  'tests/romBitOpcodeSemantics.test.js',
  'tests/romNamedEventEvidenceLedger.test.js',
  'tests/romWorldNamedEventCoverage.test.js',
  'tests/romCompleteEventBitmap.test.js',
  'tests/romCompleteEventSession.test.js',
  'tests/romPollingFailureInvalidation.test.js',
  'tests/romSafeLauncherAutoUpdate.test.js',
  'tests/romLocalPreviewServer.test.js',
  'tests/romLiveServerSafetyPolicy.test.js',
  'tests/romMapEventActorApproach.test.js',
  'tests/romStaticWorldFlagDependencies.test.js',
  'tests/romTextDispatchClassification.test.js',
  'tests/romMappingGapLedger.test.js',
  'tests/romFixedBankReferenceEvidence.test.js',
  'tests/rom0IndirectJumpEvidence.test.js',
  'tests/romRomxBankAccess.test.js',
  'tests/romMbc3RegisterEvidence.test.js',
  'tests/romMbc3AProvenance.test.js',
  'tests/romMbc3RegisterInput.test.js',
  'tests/romMbc3BankSourcePlan.test.js',
  'tests/romMbc3RamSourceReadback.test.js',
  'tests/rom0CallClosureEvidence.test.js',
  'tests/romWorldScriptReferences.test.js',
  'tests/romGlobalFlagReadback.test.js',
  'tests/romLiveStateAudit.test.js',
  'tests/romReadOnlyRetroArchProbe.test.js',
  'tests/romCampaignUi.test.js',
  'tests/worldAdvisorPanel.test.js'
 ],env,40,0);
 log('GLOBAL_FLAG_READBACK_368_BYTES_TESTED_SYNTHETICALLY=TRUE');
 log('ALL_2560_EVENT_BIT_TRANSITION_SESSION_TESTED_SYNTHETICALLY=TRUE');
 log('UNEXPECTED_POLL_FAILURE_INVALIDATION_TESTED_SYNTHETICALLY=TRUE');
 log('LAUNCHER_AUTOUPDATE_DEFAULT_OFF_AND_MAIN_ONLY_TESTED_STATICALLY=TRUE');
 log('READONLY_LOCAL_DASHBOARD_PREVIEW_TESTED_SYNTHETICALLY=TRUE');
 log('LIVE_SERVER_SAFETY_DEFAULTS_TESTED_STATICALLY=TRUE');
 log('LIVE_BIT_TRANSITIONS_OBSERVED_DURING_CERTIFICATION=FALSE');
 log('GLOBAL_FLAG_RUNTIME_READBACK_OBSERVED=FALSE');
 log('LIVE_COMPANION_HTTP_PROBE_DURING_CERTIFICATION=NOT_RUN');
 log('LIVE_2560_BIT_READONLY_HTTP_AUDIT_TESTED_SYNTHETICALLY=TRUE');
 log('RETROARCH_REMOTE_UDP_READ_ONLY_PROBE_DURING_CERTIFICATION=NOT_RUN');
 log('RETROARCH_REMOTE_UDP_PROBE_TESTS_SYNTHETIC_ONLY=TRUE');
 log('LIVE_COMPANION_AUDIT_TESTS_SYNTHETIC_ONLY=TRUE');
 log('STEP=THREE_PROFILE_ARCHIVE');
 const zip=path.join(work,'pokemon_gen1_red_blue_green_profiles_v4.zip');
 const result=saveVerifiedProfileArchive(zip,originals);
 assert(result.verified===true&&result.entryCount===3,'ZIP profiles not verified');
 env.POKEMON_ROM_PROFILE_ZIP=zip;
 env.POKEMON_PROFILE_ZIP_TEST_FILE=zip;
 log('PROFILE_ZIP_VALIDATED=TRUE');
 log('STEP=FULL_TEST_SUITE');
 runTests('FULL_SUITE',[],env,655,1);
 log('RUN_VALIDATED=TRUE');
}
try{main();finished=true;}catch(e){
 process.exitCode=1;
 try{log('ERROR='+e.stack);}catch{process.stderr.write(String(e)+'\n');}
}finally{
 if(work){
  try{fs.rmSync(work,{recursive:true,force:true,maxRetries:2});
   log('EXCLUSIVE_TEMP_CLEANED=TRUE');}
  catch(e){process.exitCode=1;try{log('EXCLUSIVE_TEMP_CLEANED=FALSE '+e.message);}catch{}}
 }
 if(started){
  try{log('JOB_END='+JOB);log('RESULT='+(!process.exitCode&&finished?'PASSED':'FAILED'));}
  catch{process.exitCode=1;}
 }
}
