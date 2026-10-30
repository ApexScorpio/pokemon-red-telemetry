'use strict';
// Explicit, fail-closed full-world ROM mapping gap ledger.
// Exact ROM SHA is required. Read-only static references are never interpreted
// as quests completed, reachable items, running scripts or understood ASM.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const MAP_IDS=248,NORMAL_MAPS=226,REFERENCES=1126,ASM_REFERENCES=626,ASM_UNIQUE=516;
function invalid(reason){return {verified:false,reason,maps:[],summary:null,
  mapping100PercentCertified:false,runtimeEffectsCertified:false};}
function buildMappingGapLedger({profile,index,scriptAtlas,tracker}={}){
 const sha=profile?.hash?.sha256?.toLowerCase();
 if(!isKnownAuditedRomSha(sha)||profile?.unknownLayout===true||
  index?.verified!==true||index.romSha256!==sha||
  scriptAtlas?.verified!==true||scriptAtlas.romSha256!==sha||
  tracker?.verified!==true||tracker.romSha256!==sha||
  !Array.isArray(index.maps)||index.maps.length!==MAP_IDS||
  !Array.isArray(scriptAtlas.maps)||scriptAtlas.maps.length!==MAP_IDS||
  !Array.isArray(tracker.maps)||tracker.maps.length!==MAP_IDS||
  scriptAtlas.summary?.referencedInteractions!==REFERENCES||
  scriptAtlas.summary?.asmTextReferences!==ASM_REFERENCES||
  scriptAtlas.summary?.uniqueAsmEntrypoints!==ASM_UNIQUE||
  tracker.summary?.scriptReferencesBound!==REFERENCES)
  return invalid('Identidade, catalogo de 248 IDs e atlas mundial sem validacao conjunta');
 const maps=[];const allScriptRows=[];
 let normalMaps=0,unresolvedMapIds=0,unassignedHidden=0,
  textPointersPending=0,unverifiedEffects=0,asmTextReferences=0,
  pendingRuntimeActions=0,staticActions=0;
 const allAsmOffsets=new Set(),unknownEffects=[];
 for(let mapId=0;mapId<MAP_IDS;mapId++){
  const map=index.maps[mapId],script=scriptAtlas.maps[mapId],progress=tracker.maps[mapId];
  if(map.mapId!==mapId||script.mapId!==mapId||progress.mapId!==mapId||
    map.verified!==script.verified||map.verified!==progress.verified)
   return invalid('Identificacao de mapa divergente: '+mapId);
  if(!map.verified){
   unresolvedMapIds++;
   const hidden=map.unassignedHiddenItems||[];
   unassignedHidden+=hidden.length;
   maps.push({mapId,staticHeaderVerified:false,
    gapClass:'NO_NORMAL_MAP_HEADER',unassignedHiddenItems:hidden.length,
    interactionCount:0,asmReferences:0,
    runtimeCompletionVerified:false});
   continue;
  }
  normalMaps++;
  if(!Array.isArray(script.interactions)||!Array.isArray(progress.actions))
   return invalid('Interacoes ou checklist invalidas: '+mapId);
  const referenced=script.interactions;
  const actions=progress.actions;
  const keyedRows=actions.filter(x=>!['WARP','HIDDEN_ITEM'].includes(x.kind));
  if(keyedRows.length!==referenced.length||
   actions.filter(x=>x.scriptReferenceBound===true).length!==referenced.length)
   return invalid('Referencias de texto e objetos nao concordam: '+mapId);
  const missingPointers=referenced.filter(x=>x.textPointerVerified!==true).length;
  const missingEffects=referenced.filter(x=>x.scriptEffectsVerified!==true).length;
  const asm=referenced.filter(x=>x.scriptCommand==='TX_START_ASM');
  const asmOffsets=new Set(),asmEntryDetails=new Map();
  for(const item of asm){
   if(item.asmCandidate?.verified!==true||item.scriptFileOffset!==item.asmCandidate.txAsmFileOffset)
    return invalid('ASM sem entrada de codigo candidata: '+mapId);
   asmOffsets.add(item.scriptFileOffset);allAsmOffsets.add(item.scriptFileOffset);
   const candidate=item.asmCandidate;
   if(!asmEntryDetails.has(item.scriptFileOffset))
    asmEntryDetails.set(item.scriptFileOffset,{
     fileOffset:item.scriptFileOffset,bank:candidate.bank,
     candidateInstructions:candidate.opcodeCandidateCount,
     pendingCalls:candidate.callsNotFollowed,
     pendingTargets:candidate.unresolvedBranchTargets,
     initialBudgetHit:candidate.firstPassLimitReached===true,
     expanded:candidate.candidateExpansionApplied===true,
     stillLimited:candidate.residualLimitReached===true,
     scriptEffectsVerified:false,
     references:0
    });
   asmEntryDetails.get(item.scriptFileOffset).references++;
  }
  const unprovenRuntime=actions.filter(x=>x.completedNow!==true&&x.completedNow!==false).length;
  textPointersPending+=missingPointers;
  unverifiedEffects+=missingEffects;
  asmTextReferences+=asm.length;
  pendingRuntimeActions+=unprovenRuntime;
  staticActions+=actions.length;
  allScriptRows.push(...referenced);
  const reasons=[];
  if(missingPointers>0)reasons.push('TEXT_POINTER_NOT_VERIFIED');
  if(asm.length>0)reasons.push('ASM_EFFECTS_NOT_CERTIFIED');
  if(missingEffects>0)reasons.push('SCRIPT_EFFECTS_NOT_CERTIFIED');
  if(unprovenRuntime>0)reasons.push('LIVE_PROGRESS_NOT_PROVEN');
  maps.push({mapId,staticHeaderVerified:true,
   staticActionCount:actions.length,interactionCount:referenced.length,
   asmReferences:asm.length,uniqueAsmEntrypoints:asmOffsets.size,
   asmHandlerCandidates:[...asmEntryDetails.values()].sort(
    (x,y)=>y.pendingTargets-x.pendingTargets||
     y.pendingCalls-x.pendingCalls||x.fileOffset-y.fileOffset),
   missingTextPointers:missingPointers,unverifiedScriptEffects:missingEffects,
   runtimeActionsUnproven:unprovenRuntime,
   status:reasons.length?'PARTIAL_STATIC_MAPPING':'PROVEN_STATIC_AND_RUNTIME',
   gapClasses:reasons,
   runtimeCompletionVerified:false});
  if(missingEffects)unknownEffects.push({mapId,count:missingEffects});
 }
 if(normalMaps!==NORMAL_MAPS||unresolvedMapIds!==22||
  allScriptRows.length!==REFERENCES||asmTextReferences!==ASM_REFERENCES||
  allAsmOffsets.size!==ASM_UNIQUE||unverifiedEffects!==REFERENCES||
  index.totals.hiddenItems!==54||unassignedHidden!==index.totals.hiddenItemsWithoutNormalHeader||
  staticActions!==tracker.summary.allStaticActions)
  return invalid('Contagem mundial nao fecha; recusar cobertura global ficticia');
 const rom0=scriptAtlas.summary;
 if(rom0.rom0BranchTargetOccurrences!==
     rom0.asmUnresolvedReasonCounts?.ROM0_OUTSIDE_LOCAL_GRAPH||
    rom0.physicallyMappedRom0Targets!==rom0.distinctRom0BranchDestinations||
    rom0.rom0EffectSemanticsCertified!==0||
    scriptAtlas.rom0PhysicalAddressMappingCertified!==true)
  return invalid('Prova fisica ROM0 nao concorda com destinos ASM');
 const unresolvedReasons=scriptAtlas.summary.asmUnresolvedReasonCounts||{};
 const callReasons=scriptAtlas.summary.asmUnfollowedCallClasses||{};
 const n=x=>Object.values(x).reduce((sum,v)=>sum+v,0);
 if(n(unresolvedReasons)!==scriptAtlas.summary.uniqueAsmUnresolvedTargets||
  n(callReasons)!==scriptAtlas.summary.uniqueAsmCallsNotFollowed)
  return invalid('As classes ASM nao explicam todos os alvos pendentes');
 const hotspots=maps.filter(m=>m.staticHeaderVerified)
  .sort((a,b)=>b.asmReferences-a.asmReferences||
    b.unverifiedScriptEffects-a.unverifiedScriptEffects||a.mapId-b.mapId)
  .slice(0,15).map(m=>({mapId:m.mapId,asmReferences:m.asmReferences,
   unverifiedScriptEffects:m.unverifiedScriptEffects}));
 return {verified:true,romSha256:sha,source:'VERIFIED_ROM_STATIC_GAP_LEDGER_V1',
  maps,
  summary:{mapIds:MAP_IDS,normalMapHeaders:NORMAL_MAPS,
   idsWithoutNormalHeader:unresolvedMapIds,
   hiddenItemsWithoutNormalHeader:unassignedHidden,
   staticallyIndexedActions:staticActions,
   scriptReferences:REFERENCES,textPointersPending,
   uniqueAsmEntrypoints:allAsmOffsets.size,asmTextReferences,
   candidateInstructions:scriptAtlas.summary.uniqueAsmCandidateInstructions,
   unresolvedAsmTargets:scriptAtlas.summary.uniqueAsmUnresolvedTargets,
   mappedRom0BranchReferences:rom0.rom0BranchTargetOccurrences,
   distinctRom0PhysicalTargets:rom0.distinctRom0BranchDestinations,
   boundedRom0OpcodeCandidates:rom0.rom0OpcodeCandidateInstructions,
   rom0StillSemanticallyUnknown:rom0.rom0BranchTargetOccurrences,
   rom0EffectsProven:0,
   untraversedAsmCalls:scriptAtlas.summary.uniqueAsmCallsNotFollowed,
   asmInitiallyCapped:scriptAtlas.summary.uniqueAsmFirstPassLimitHits,
   asmExpanded:scriptAtlas.summary.uniqueAsmExpandedEntrypoints,
   asmStillCapped:scriptAtlas.summary.uniqueAsmExpandedStillLimited,
   unverifiedScriptEffects:unverifiedEffects,
   runtimeActionsUnproven:pendingRuntimeActions,
   unresolvedAsmReasonCounts:{...unresolvedReasons},
   untraversedAsmCallClasses:{...callReasons}},
  priorities:hotspots,
  mapping100PercentCertified:false,runtimeEffectsCertified:false,
  warnings:['248 IDs ROM não equivalem a 248 mapas normais',
   'Entradas de texto e grafos de instruções são evidência estática',
   'Ações vistas na ROM não confirmam acessibilidade ou conclusão na RAM',
   'Mapa sem cabeçalho normal pode ser reservado, não necessariamente jogável']};
}
module.exports={buildMappingGapLedger};
