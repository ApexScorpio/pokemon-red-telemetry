'use strict';
// All 248 ROM map IDs: separate static catalogue completeness from
// unverified gameplay semantics. A report is not a save-state completion %.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const IDS=248,HEADERS=226,REFERENCES=1126,ASM=626,ACTIONS=1992;
function fail(reason){return {verified:false,reason,maps:[],summary:null,
  mapping100PercentCertified:false,gameplayCompletionCertified:false};}
function buildWorldGapMatrix({ledger}={}){
 const sha=ledger?.romSha256;
 if(ledger?.verified!==true||ledger.source!=='VERIFIED_ROM_STATIC_GAP_LEDGER_V1'||
    !isKnownAuditedRomSha(sha)||
    ledger.mapping100PercentCertified!==false||
    ledger.runtimeEffectsCertified!==false||
    !Array.isArray(ledger.maps)||ledger.maps.length!==IDS||
    ledger.summary?.mapIds!==IDS||
    ledger.summary.normalMapHeaders!==HEADERS||
    ledger.summary.idsWithoutNormalHeader!==IDS-HEADERS||
    ledger.summary.staticallyIndexedActions!==ACTIONS||
    ledger.summary.scriptReferences!==REFERENCES||
    ledger.summary.asmTextReferences!==ASM||
    ledger.summary.unverifiedScriptEffects!==REFERENCES||
    ledger.summary.textPointersPending!==0||
    ledger.summary.liveEventBitValuesVerified!==0)
  return fail('Verified whole-ROM gap ledger and bounded semantic counts required');
 let headers=0,noHeaders=0,actions=0,interactions=0,asm=0,
  unknownRuntime=0,missingPointers=0,unverifiedEffects=0,unassigned=0;
 const maps=[];
 for(let id=0;id<IDS;id++){
  const m=ledger.maps[id];
  if(!m||m.mapId!==id||m.runtimeCompletionVerified!==false)
   return fail('Map ID, order, or completion flag inconsistent: '+id);
  if(m.staticHeaderVerified===false){
   if(m.gapClass!=='NO_NORMAL_MAP_HEADER'||
      !Number.isSafeInteger(m.unassignedHiddenItems)||
      m.unassignedHiddenItems<0||m.interactionCount!==0||
      m.asmReferences!==0)
    return fail('Non-normal map has fake static proof: '+id);
   noHeaders++;unassigned+=m.unassignedHiddenItems;
   maps.push({mapId:id,category:'NO_NORMAL_MAP_HEADER',
    hasNormalHeader:false,staticActionCount:null,
    scriptReferences:null,asmReferences:null,
    runtimeActionCompletionKnown:false,
    pending:['MAP_HEADER_NOT_A_NORMAL_GAMEPLAY_HEADER'],
    nextEvidence:'Classify unused/reserved ID and any unassigned hidden item reference',
    completionPercent:null,gameplayVerified:false});
   continue;
  }
  if(m.staticHeaderVerified!==true||
     !Number.isSafeInteger(m.staticActionCount)||m.staticActionCount<0||
     !Number.isSafeInteger(m.interactionCount)||m.interactionCount<0||
     !Number.isSafeInteger(m.asmReferences)||m.asmReferences<0||
     m.asmReferences>m.interactionCount||
     !Number.isSafeInteger(m.runtimeActionsUnproven)||
     m.runtimeActionsUnproven<0||m.runtimeActionsUnproven>m.staticActionCount||
     !Number.isSafeInteger(m.unverifiedScriptEffects)||
     m.unverifiedScriptEffects<0||
     m.unverifiedScriptEffects>m.interactionCount||
     !Number.isSafeInteger(m.missingTextPointers)||
     m.missingTextPointers<0||m.missingTextPointers>m.interactionCount||
     !Array.isArray(m.gapClasses)||
     m.gapClasses.some(x=>![
      'TEXT_POINTER_NOT_VERIFIED','ASM_EFFECTS_NOT_CERTIFIED',
      'SCRIPT_EFFECTS_NOT_CERTIFIED','LIVE_PROGRESS_NOT_PROVEN'
     ].includes(x))||
     m.gapClasses.length!==new Set(m.gapClasses).size)
    return fail('Normal map gap classification incoherent: '+id);
  const reasons=[];
  if(m.missingTextPointers>0)reasons.push('TEXT_POINTER_NOT_VERIFIED');
  if(m.asmReferences>0)reasons.push('ASM_EFFECTS_NOT_CERTIFIED');
  if(m.unverifiedScriptEffects>0)reasons.push('SCRIPT_EFFECTS_NOT_CERTIFIED');
  if(m.runtimeActionsUnproven>0)reasons.push('LIVE_PROGRESS_NOT_PROVEN');
  if(JSON.stringify(reasons)!==JSON.stringify(m.gapClasses))
   return fail('Map gap reasons do not match counters: '+id);
  if(m.status!==(reasons.length?'PARTIAL_STATIC_MAPPING':'PROVEN_STATIC_AND_RUNTIME'))
   return fail('Map static status conflicts with original classification: '+id);
  headers++;
  actions+=m.staticActionCount;interactions+=m.interactionCount;
  asm+=m.asmReferences;unknownRuntime+=m.runtimeActionsUnproven;
  missingPointers+=m.missingTextPointers;
  unverifiedEffects+=m.unverifiedScriptEffects;
  maps.push({mapId:id,category:'NORMAL_MAP_STATIC_CATALOGUE',
   hasNormalHeader:true,staticActionCount:m.staticActionCount,
   scriptReferences:m.interactionCount,asmReferences:m.asmReferences,
   runtimeActionCompletionKnown:false,
   actionsWithoutRuntimeProof:m.runtimeActionsUnproven,
   scriptsWithoutEffectProof:m.unverifiedScriptEffects,
   missingTextPointers:m.missingTextPointers,
   pending:reasons,
   nextEvidence:m.missingTextPointers>0?'VERIFY_TEXT_POINTER':
    m.asmReferences>0?'RESOLVE_STATIC_ASM_CONTROL_FLOW_AND_EFFECTS':
    m.unverifiedScriptEffects>0?'VERIFY_SCRIPT_EFFECTS':
    m.runtimeActionsUnproven>0?'CORROBORATE_RUNTIME_ACTION_PROGRESS':
    'CHECK_NON_SCRIPTED_RUNTIME_REQUIREMENTS',
   completionPercent:null,gameplayVerified:false});
 }
 if(headers!==HEADERS||noHeaders!==IDS-HEADERS||
    actions!==ACTIONS||interactions!==REFERENCES||asm!==ASM||
    missingPointers!==ledger.summary.textPointersPending||
    unverifiedEffects!==ledger.summary.unverifiedScriptEffects||
    unknownRuntime!==ledger.summary.runtimeActionsUnproven||
    unassigned!==ledger.summary.hiddenItemsWithoutNormalHeader)
  return fail('Global map counters do not reconcile with independently checked rows');
 const ranked=maps.filter(m=>m.hasNormalHeader)
  .sort((a,b)=>b.asmReferences-a.asmReferences||
    b.scriptsWithoutEffectProof-a.scriptsWithoutEffectProof||
    a.mapId-b.mapId).slice(0,15);
 if(!Array.isArray(ledger.priorities)||ledger.priorities.length!==15||
    JSON.stringify(ranked.map(x=>[x.mapId,x.asmReferences,
     x.scriptsWithoutEffectProof]))!==
     JSON.stringify(ledger.priorities.map(x=>[
      x.mapId,x.asmReferences,x.unverifiedScriptEffects])))
  return fail('Priority ranking differs from independently computed world inventory');
 return {verified:true,romSha256:sha,source:'COMPLETE_248_ID_STATIC_WORLD_GAP_MATRIX_V1',
  maps,summary:{
   mapIds:IDS,normalMapHeaders:HEADERS,noNormalHeader:IDS-HEADERS,
   staticallyIndexedActions:actions,scriptReferences:interactions,
   asmReferences:asm,unverifiedScriptEffects:unverifiedEffects,
   runtimeActionsUnproven:unknownRuntime,
   unassignedHiddenItems:unassigned,
   missingTextPointers:missingPointers,
   gameplayCompletedActionsCertified:0,
   gameplayCompletionPercentage:null,
   allNormalMapsHaveStaticCatalogue:true,
   allRuntimeBehaviorCertified:false},
  topUnresolvedMaps:ranked.map(x=>({
   mapId:x.mapId,asmReferences:x.asmReferences,
   scriptsWithoutEffectProof:x.scriptsWithoutEffectProof,
   nextEvidence:x.nextEvidence})),
  mapping100PercentCertified:false,gameplayCompletionCertified:false,
  warning:'248 physical map IDs and 1992 static action rows do not measure completed gameplay or prove access.'};
}
function mapWorldGapDetail({matrix,mapId}={}){
 if(matrix?.verified!==true||!isKnownAuditedRomSha(matrix.romSha256)||
    matrix.source!=='COMPLETE_248_ID_STATIC_WORLD_GAP_MATRIX_V1'||
    matrix.summary?.mapIds!==248||
    !Array.isArray(matrix.maps)||matrix.maps.length!==248||
    !Number.isInteger(mapId)||mapId<0||mapId>=248||
    matrix.maps[mapId]?.mapId!==mapId||
    matrix.maps[mapId]?.gameplayVerified!==false||
    matrix.gameplayCompletionCertified!==false)
  return {verified:false,reason:'Whole-ROM matrix or requested map not verified',mapId};
 return {verified:true,mapId,romSha256:matrix.romSha256,
  ...matrix.maps[mapId],pending:[...matrix.maps[mapId].pending],
  gameplayVerified:false,completionPercent:null};
}

function exportWorldGapRowsV2({matrix}={}){
 const denied=reason=>({verified:false,reason,rows:[],counts:null,
  gameplayCompletionCertified:false});
 if(matrix?.verified!==true||
    !isKnownAuditedRomSha(matrix.romSha256)||
    matrix.source!=='COMPLETE_248_ID_STATIC_WORLD_GAP_MATRIX_V1'||
    matrix.gameplayCompletionCertified!==false||
    matrix.mapping100PercentCertified!==false||
    !Array.isArray(matrix.maps)||matrix.maps.length!==IDS||
    matrix.summary?.mapIds!==IDS||
    matrix.summary.normalMapHeaders!==HEADERS||
    matrix.summary.noNormalHeader!==IDS-HEADERS||
    matrix.summary.gameplayCompletionPercentage!==null||
    matrix.summary.allRuntimeBehaviorCertified!==false||
    matrix.summary.staticallyIndexedActions!==ACTIONS||
    matrix.summary.scriptReferences!==REFERENCES||
    matrix.summary.asmReferences!==ASM||
    matrix.summary.unverifiedScriptEffects!==REFERENCES)
  return denied('Original 248-ID matrix and its static evidence must be verified');
 const rows=[];
 let normal=0,noHeader=0,actions=0,scripts=0,asm=0,pending=0,unverified=0;
 for(let mapId=0;mapId<IDS;mapId++){
  const m=matrix.maps[mapId];
  if(!m||m.mapId!==mapId||m.gameplayVerified!==false||
     m.completionPercent!==null||
     typeof m.nextEvidence!=='string'||m.nextEvidence.length<1||
     !Array.isArray(m.pending)||m.pending.some(x=>typeof x!=='string'))
   return denied('Invalid or incomplete map '+mapId);
  if(m.hasNormalHeader===true&&m.category==='NORMAL_MAP_STATIC_CATALOGUE'){
   const ints=[m.staticActionCount,m.scriptReferences,m.asmReferences,
    m.actionsWithoutRuntimeProof,m.scriptsWithoutEffectProof];
   if(ints.some(x=>!Number.isSafeInteger(x)||x<0)||
      m.asmReferences>m.scriptReferences||
      m.actionsWithoutRuntimeProof>m.staticActionCount||
      m.scriptsWithoutEffectProof>m.scriptReferences)
    return denied('Impossible static and runtime totals for map '+mapId);
   normal++;
   actions+=m.staticActionCount;scripts+=m.scriptReferences;
   asm+=m.asmReferences;pending+=m.actionsWithoutRuntimeProof;
   unverified+=m.scriptsWithoutEffectProof;
  }else if(m.hasNormalHeader===false&&
            m.category==='NO_NORMAL_MAP_HEADER'){
   if(m.staticActionCount!==null||m.scriptReferences!==null||
      m.asmReferences!==null||m.actionsWithoutRuntimeProof!==undefined||
      m.pending.length!==1||
      m.pending[0]!=='MAP_HEADER_NOT_A_NORMAL_GAMEPLAY_HEADER')
    return denied('Reserved or non-normal map cannot claim proof '+mapId);
   noHeader++;
  }else return denied('Unrecognized map classification '+mapId);
  rows.push({
   mapId,hasNormalHeader:m.hasNormalHeader,
   staticActionCount:m.staticActionCount,
   scriptReferences:m.scriptReferences,
   asmReferences:m.asmReferences,
   actionsWithoutRuntimeProof:m.actionsWithoutRuntimeProof??null,
   nextEvidence:m.nextEvidence,
   gapClasses:m.pending.join('|'),
   gameplayVerified:false,completionPercent:null
  });
 }
 const sum=matrix.summary;
 if(normal!==HEADERS||noHeader!==IDS-HEADERS||
    actions!==ACTIONS||scripts!==REFERENCES||asm!==ASM||
    unverified!==sum.unverifiedScriptEffects||
    pending!==sum.runtimeActionsUnproven)
  return denied('Flat export row counters disagree with the source matrix');
 return {verified:true,version:2,source:'OBJECT_ROWS_FOR_WINDOWS_POWERSHELL',
  romSha256:matrix.romSha256,
  counts:{mapIds:IDS,normalMapHeaders:normal,noNormalHeader:noHeader,
   staticallyIndexedActions:actions,scriptReferences:scripts,
   asmReferences:asm,runtimeActionsUnproven:pending,
   unverifiedScriptEffects:unverified,
   gameplayCompletionPercentage:null},
  rows,gameplayCompletionCertified:false};
}
module.exports={buildWorldGapMatrix,mapWorldGapDetail,exportWorldGapRowsV2};
