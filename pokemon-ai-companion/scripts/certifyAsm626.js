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
   gaps.summary.textPointersPending===0&&
   a.summary.rom0BranchTargetOccurrences===537&&
   a.summary.physicallyMappedRom0Targets===a.summary.distinctRom0BranchDestinations&&
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
  log('ROM_'+variant.toUpperCase()+'_ROM0_BRANCH_PHYSICAL_REFERENCES='+gaps.summary.mappedRom0BranchReferences);
  log('ROM_'+variant.toUpperCase()+'_ROM0_DISTINCT_PHYSICAL_TARGETS='+gaps.summary.distinctRom0PhysicalTargets);
  log('ROM_'+variant.toUpperCase()+'_ROM0_OPCODE_CANDIDATES='+gaps.summary.boundedRom0OpcodeCandidates);
  log('ROM_'+variant.toUpperCase()+'_ROM0_EFFECTS_STILL_UNKNOWN='+gaps.summary.rom0StillSemanticallyUnknown);
  log('ROM_'+variant.toUpperCase()+'_ROM0_DECODE_PROBLEMS='+a.summary.rom0DecodeProblems);
  log('ROM_'+variant.toUpperCase()+'_ROM0_SCAN_LIMITS='+a.summary.rom0StillBudgetLimited);

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
  'tests/romMappingGapLedger.test.js',
  'tests/romFixedBankReferenceEvidence.test.js',
  'tests/romWorldScriptReferences.test.js',
  'tests/romCampaignUi.test.js',
  'tests/worldAdvisorPanel.test.js'
 ],env,40,0);
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
