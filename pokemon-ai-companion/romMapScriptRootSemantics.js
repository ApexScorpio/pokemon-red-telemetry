'use strict';

// Physical map-script roots, independent from TX_START_ASM handlers.
// Conditional ROM abstract execution is not observed gameplay.
const crypto=require('node:crypto');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {mapScriptAndTextReferences,cpuToOffset}=
 require('./romMapCodeAtlas');
const {interpretHandler}=require('./romScriptSemantics');

const MAP_COUNT=248;
const NORMAL_MAPS=226;
const ROM_BYTES=1048576;

const invalid=reason=>({
 verified:false,reason,romSha256:null,
 rows:[],roots:[],summary:null,
 observedExecution:false,gameplayCompleted:false
});

function buildMapScriptRootSemantics({
 rom,maps,romSha256
}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_BYTES||
    !isKnownAuditedRomSha(romSha256)||
    crypto.createHash('sha256').update(rom).digest('hex')!==romSha256||
    !Array.isArray(maps)||maps.length!==MAP_COUNT)
  return invalid('Unverified physical ROM or 248-map catalogue');

 let refs;

 try{
  refs=mapScriptAndTextReferences(rom,maps);
 }catch(error){
  return invalid('Map script pointers rejected: '+error.message);
 }

 if(refs.scriptSeeds.length!==NORMAL_MAPS||
    refs.totals.normalMapHeaders!==NORMAL_MAPS)
  return invalid('226 authenticated map roots required');

 const unique=new Map();
 const roots=[];
 const rows=[];

 let completeRoots=0;
 let unresolvedPaths=0;
 const allReasons={};

 for(const seed of refs.scriptSeeds){
  const offset=cpuToOffset(
   seed.bank,seed.pc,rom.length
  );

  if(!Number.isInteger(offset))
   return invalid('Unmapped physical map root');

  const key=seed.bank+':'+seed.pc;

  let rootIndex=unique.get(key);

  if(rootIndex===undefined){
   const analysis=interpretHandler({
    rom,
    fileOffset:offset,
    entryKind:'MAP_SCRIPT_ROOT'
   });

   if(analysis.verified!==true||
      analysis.handlerOffset!==offset||
      !Array.isArray(analysis.effects)||
      !Array.isArray(analysis.unresolved))
    return invalid('Abstract map script analysis rejected');

   const reasons={};

   for(const u of analysis.unresolved){
    const reason=u.reason||'UNKNOWN';
    reasons[reason]=(reasons[reason]||0)+1;
    allReasons[reason]=(allReasons[reason]||0)+1;
   }

   const effects=analysis.effects.filter(e=>
    e.gameplayStateTransitionProven===true
   ).map(e=>({
    instructionOffset:e.instructionOffset,
    address:e.address,
    domain:e.domain,
    value:e.value,
    conditions:e.conditions,
    trace:e.trace,
    gameplayStateTransitionProven:true,
    observedExecution:false,
    completedNow:null,
    accessibleNow:null,
    source:'ROM_MAP_SCRIPT_ROOT_ABSTRACT_EXECUTION'
   }));

   if(analysis.complete===true)completeRoots++;

   unresolvedPaths+=analysis.unresolved.length;

   rootIndex=roots.length;
   unique.set(key,rootIndex);

   roots.push({
    rootIndex,
    bank:seed.bank,
    cpuAddress:seed.pc,
    fileOffset:offset,
    completeBoundedAnalysis:analysis.complete===true,
    unresolvedCount:analysis.unresolved.length,
    unresolvedReasonCounts:reasons,
    unresolvedSamples:analysis.unresolved.slice(0,3).map(u=>({
     reason:u.reason,
     instructionOffset:u.offset??null
    })),
    unresolvedSamplesBounded:analysis.unresolved.length>3,
    effects,
    effectCount:effects.length,
    preconditions:analysis.preconditions,
    rootInvokedInCurrentPlay:false,
    actualBankSelectionVerified:false,
    fullMapScriptCertified:false,
    observedExecution:false
   });
  }

  rows.push({
   mapId:seed.mapId,
   rootIndex
  });
 }

 if(rows.length!==NORMAL_MAPS||unique.size!==roots.length||
    new Set(rows.map(r=>r.mapId)).size!==NORMAL_MAPS)
  return invalid('Duplicate or missing map root identity');

 const uniqueEffects=new Set();

 for(const root of roots){
  for(const e of root.effects){
   uniqueEffects.add(JSON.stringify([
    e.instructionOffset,
    e.address,
    e.value,
    e.conditions
   ]));
  }
 }

 return {
  verified:true,
  romSha256,
  source:'SHA_VERIFIED_MAP_SCRIPT_ROOT_ABSTRACT_EXECUTION_V1',
  rows,
  roots,
  summary:{
   mapScriptPointers:rows.length,
   uniquePhysicalMapScriptRoots:roots.length,
   uniqueConditionalEffectCandidates:uniqueEffects.size,
   completeBoundedRoots:completeRoots,
   unresolvedPhysicalPaths:unresolvedPaths,
   unresolvedReasonCounts:allReasons,
   globallyCertifiedGameplayEffects:0
  },
  rootInvocationObserved:false,
  selectedBankObserved:false,
  gameplayCompleted:false,
  fullMapScriptSemanticsCertified:false,
  warning:'Efeitos condicionais obtidos por execução abstrata de código ROM. Não provam que o script foi chamado, que o banco estava selecionado ou que um evento aconteceu.'
 };
}

function mapScriptRootEvidence({
 catalogue,romSha256,mapId
}={}){
 if(catalogue?.verified!==true||
    catalogue.source!==
     'SHA_VERIFIED_MAP_SCRIPT_ROOT_ABSTRACT_EXECUTION_V1'||
    !isKnownAuditedRomSha(romSha256)||
    catalogue.romSha256!==romSha256||
    !Number.isInteger(mapId)||mapId<0||mapId>=MAP_COUNT||
    !Array.isArray(catalogue.rows)||
    catalogue.rows.length!==NORMAL_MAPS||
    !Array.isArray(catalogue.roots)||
    catalogue.rootInvocationObserved!==false||
    catalogue.gameplayCompleted!==false||
    catalogue.fullMapScriptSemanticsCertified!==false)
  return null;

 const matches=catalogue.rows.filter(r=>r.mapId===mapId);

 if(matches.length!==1)return null;

 const row=matches[0];
 const root=catalogue.roots[row.rootIndex];

 if(!root||root.rootIndex!==row.rootIndex||
    !Number.isInteger(root.fileOffset)||
    !Array.isArray(root.effects)||
    root.effectCount!==root.effects.length||
    !Array.isArray(root.preconditions)||
    root.rootInvokedInCurrentPlay!==false||
    root.actualBankSelectionVerified!==false||
    root.observedExecution!==false)
  return null;

 return {
  verified:true,
  mapId,
  romSha256,
  physicalRootOffset:root.fileOffset,
  bank:root.bank,
  cpuAddress:root.cpuAddress,
  conditionalEffectCandidates:root.effectCount,
  effects:root.effects.map(e=>({
   ...e,
   mapId,
   completedNow:null,
   accessibleNow:null,
   observedExecution:false
  })),
  unresolvedCount:root.unresolvedCount,
  unresolvedReasonCounts:{...root.unresolvedReasonCounts},
  unresolvedSamples:root.unresolvedSamples.map(x=>({...x})),
  unresolvedSamplesBounded:root.unresolvedSamplesBounded,
  completeBoundedAnalysis:root.completeBoundedAnalysis,
  preconditions:[...root.preconditions],
  rootInvokedInCurrentPlay:false,
  actualBankSelectionVerified:false,
  fullMapScriptCertified:false,
  gameplayCompleted:false,
  source:catalogue.source
 };
}

module.exports={
 buildMapScriptRootSemantics,
 mapScriptRootEvidence
};