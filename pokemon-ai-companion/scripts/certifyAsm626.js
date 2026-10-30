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
  'tests/romTextDispatchClassification.test.js',
  'tests/romMappingGapLedger.test.js',
  'tests/romFixedBankReferenceEvidence.test.js',
  'tests/rom0IndirectJumpEvidence.test.js',
  'tests/romWorldScriptReferences.test.js',
  'tests/romGlobalFlagReadback.test.js',
  'tests/romLiveStateAudit.test.js',
  'tests/romReadOnlyRetroArchProbe.test.js',
  'tests/romCampaignUi.test.js',
  'tests/worldAdvisorPanel.test.js'
 ],env,40,0);
 log('GLOBAL_FLAG_READBACK_336_BYTES_TESTED_SYNTHETICALLY=TRUE');
 log('GLOBAL_FLAG_RUNTIME_READBACK_OBSERVED=FALSE');
 log('LIVE_COMPANION_HTTP_PROBE_DURING_CERTIFICATION=NOT_RUN');
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
