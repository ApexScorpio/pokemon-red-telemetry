'use strict';
const {resolveSemantics,requirementsForSemantics}=require('./romScriptSemantics');
// Classification never replaces the original diagnostic or its exact count.
function blockerCategory(reason,sample){
 if(['STEP_BUDGET','PATH_BUDGET','LOOP_REQUIRES_FIXPOINT'].includes(reason))return reason;
 if(reason==='ROM_BANK_OR_TARGET_UNKNOWN'||reason==='invalid CPU/bank mapping')return 'UNKNOWN_BANK';
 if(reason==='UNRESOLVED_MEMORY_OR_BANK_WRITE')return sample?.address>=0x2000&&sample.address<0x4000?'UNKNOWN_BANK':'UNKNOWN_MEMORY';
 if(['INDIRECT_TARGET_UNKNOWN','RETURN_STACK_UNKNOWN'].includes(reason))return 'INDIRECT_TARGET';
 if(['INDIRECT_MEMORY_UNKNOWN','STACK_UNKNOWN','AF_STACK_UNKNOWN'].includes(reason))return 'UNKNOWN_MEMORY';
 if(reason.startsWith('UNSUPPORTED_OPCODE_')||reason==='undocumented opcode')return 'UNSUPPORTED_OPCODE';
 return 'OTHER';
}
function projectScriptCoverage({atlas,romSha256,reference}={}){
 const world=atlas?.scriptSemantics,r=reference;
 if(!r||atlas?.verified!==true||atlas.romSha256!==romSha256||world?.verified!==true||world.romSha256!==romSha256)return null;
 const rows=world.rows.filter(s=>['mapId','kind','ordinal','x','y','scriptFileOffset'].every(k=>s[k]===r[k]));
 if(rows.length!==1)return null;
 const asm=r.scriptCommand==='TX_START_ASM',h=asm?resolveSemantics(world,rows[0]):null;
 if(asm&&(!h?.verified||h.handlerOffset!==r.scriptFileOffset))return null;
 const samples=(h?.unresolved||[]).slice(0,4).map(u=>({...u,handlerOffset:h.handlerOffset,instructionOffset:u.offset??null,category:blockerCategory(u.reason,u)}));
 const counts=h?.unresolvedReasonCounts||Object.fromEntries([...new Set((h?.unresolved||[]).map(u=>u.reason))].map(reason=>[reason,h.unresolved.filter(u=>u.reason===reason).length]));
 const categories={};
 for(const [reason,count] of Object.entries(counts)){
  // Mixed memory/bank writes need all physical records to classify exactly.
  const matching=(h?.unresolved||[]).filter(u=>u.reason===reason);
  if(reason==='UNRESOLVED_MEMORY_OR_BANK_WRITE'&&h.unresolvedWriteCategoryCounts&&
     Object.values(h.unresolvedWriteCategoryCounts).reduce((a,b)=>a+b,0)===count){
   for(const [c,n] of Object.entries(h.unresolvedWriteCategoryCounts))categories[c]=(categories[c]||0)+n;
  }else if(reason==='UNRESOLVED_MEMORY_OR_BANK_WRITE'&&matching.length===count){
   for(const u of matching){const c=blockerCategory(reason,u);categories[c]=(categories[c]||0)+1;}
  }else {const c=reason==='UNRESOLVED_MEMORY_OR_BANK_WRITE'?'OTHER':blockerCategory(reason);categories[c]=(categories[c]||0)+count;}
 }
 const total=h?.unresolvedCount??h?.unresolved.length??0;
 return {romSha256,mapId:r.mapId,kind:r.kind,ordinal:r.ordinal,x:r.x,y:r.y,
  scriptFileOffset:r.scriptFileOffset,handlerOffset:h?.handlerOffset??null,
  executableAsm:asm,interpretationStatus:asm?'PARTIAL_ASM_ANALYSIS':'PRESENTATION_TEXT_NOT_ASM',
  unresolvedCount:total,unresolvedReasonCounts:counts,unresolvedCategoryCounts:categories,
  unresolvedSamples:samples,unresolvedSamplesBounded:h?.unresolvedSamplesBounded===true||total>samples.length,
  conditionalEffectCandidates:h?.effects.length??0,provenEffects:h?.effects.filter(e=>e.gameplayStateTransitionProven===true).length??0,
  fullScriptCertified:world.fullScriptSemanticsCertified===true&&h?.complete===true,
  handlerAnalysisComplete:h?.complete===true,runtimeRequirements:requirementsForSemantics(h),
  evidence:'STATIC_ROM_EVIDENCE',effectEvidence:'CONDITIONAL_PREDICTION',
  liveRamEvidence:null,playerActionEvidence:null,completedNow:null,accessibleNow:null};
}
module.exports={projectScriptCoverage,blockerCategory};
