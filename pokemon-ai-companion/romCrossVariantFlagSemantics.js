'use strict';
// Contrast Red, Blue and Green International *physical ROM candidate* branches.
// Do not compare entire JSON dumps for equality: a ROM hack may legitimately
// relocate a routine while keeping the same visible flag condition.
// This module allows ONLY the four physically audited shared-call offsets
// below to differ. All other declared static semantics must agree.
// No runtime game state, completion, reward or actual dialogue is inferred.
const {KNOWN}=require('./romComprehensiveAudit');
const ORDER=Object.freeze(['red','blue','green']);
const CALL=Object.freeze({red:0x3c49,blue:0x3c49,green:0x3c30});
const fail=reason=>({verified:false,reason,comparisons:[],
 differences:[],sameCausalOutcomeVerified:false});
function invariant(link){
 const branch=link.readerBranchCondition,dual=link.readerDualTextChoice;
 return {
  bitIndex:link.bitIndex,domain:link.domain,
  writerMapId:link.possibleWriterMapId,
  readerMapId:link.possibleReaderMapId,
  writerKind:link.possibleWriterKind,
  readerKind:link.possibleReaderKind,
  writerOrdinal:link.possibleWriterOrdinal,
  readerOrdinal:link.possibleReaderOrdinal,
  writerAsmOffset:link.writerRomHandlerOffset,
  readerAsmOffset:link.readerRomHandlerOffset,
  writeOpcode:link.possibleWriteOpcode,
  referenceEventName:link.referenceEventName,
  writerReferenceMapName:link.writerReferenceMapName,
  readerReferenceMapName:link.readerReferenceMapName,
  branchCondition:branch?.condition,
  branchKind:branch?.branchKind,
  branchCpu:branch?.branchCpu,
  branchTarget:branch?.takenTargetCpu,
  branchWhenBitSet:branch?.jumpTakenIfBitSet,
  textClearPointer:dual?.textOnBitClearPointerCpu??null,
  textSetPointer:dual?.textOnBitSetPointerCpu??null,
  textOptionsProved:link.readerTwoAlternativeTextScriptsVerified===true,
  crossMap:!link.sameMap,
  causalLinkObserved:link.causalLinkObserved
 };
}
function key(l){
 return [l.domain,l.bitIndex,l.possibleWriterMapId,
  l.possibleWriterKind,l.possibleWriterOrdinal,
  l.possibleReaderMapId,l.possibleReaderKind,l.possibleReaderOrdinal].join(':');
}
function compareCrossVariantFlagSemantics({graphs}={}){
 if(!graphs||typeof graphs!=='object')return fail('Three ROM graphs required');
 const index={};
 for(const variant of ORDER){
  const g=graphs[variant];
  if(!g||g.verified!==true||g.romSha256!==KNOWN[variant]||
     !Array.isArray(g.candidateLinks)||g.candidateLinks.length!==8||
     g.summary?.totalPotentialLinks!==8||
     g.summary?.crossMapPotentialLinks!==5||
     g.summary?.trustedCausalLinks!==0)
   return fail('Missing or unverified original '+variant+' ROM graph');
  const byKey=new Map();
  for(const l of g.candidateLinks){
   if(l.verifiedActionDependency!==false||
      l.causalLinkObserved!==false||l.scriptEffectVerified!==false||
      l.readerConditionalDirectionVerified!==true||
      l.readerBranchCondition?.condition!=='NZ'||
      l.readerBranchCondition?.jumpTakenIfBitSet!==true||
      l.readerBranchCondition?.branchActuallyTaken!==null||
      l.referenceNameSource!=='pret/pokered'||
      l.referenceNameIsRomIntrinsic!==false)
    return fail('Unproven execution or invalid physical condition in '+variant);
   const id=key(l);
   if(byKey.has(id))return fail('Repeated physical candidate link: '+variant);
   byKey.set(id,l);
  }
  index[variant]=byKey;
 }
 const baseline=index.red;
 const differences=[];
 for(const variant of ['blue','green']){
  const other=index[variant];
  for(const [id,base] of baseline){
   const next=other.get(id);
   if(!next)return fail('Missing '+variant+' ROM candidate '+id);
   if(JSON.stringify(invariant(base))!==JSON.stringify(invariant(next)))
    return fail('Non-equivalent physical ROM bit condition: '+variant+' '+id);
  }
 }
 for(const variant of ORDER){
  let doubleTextCount=0;
  for(const [id,l] of index[variant]){
   const dual=l.readerDualTextChoice;
   if(l.bitIndex===1231){
    if(l.readerTwoAlternativeTextScriptsVerified!==true||
       dual?.alternativeTextScriptsStaticallyProven!==true||
       dual.sharedCallCpu!==CALL[variant]||
       dual.dialogueShown!==false||dual.playerEffectVerified!==false)
     return fail('Unverified or unexpected '+variant+' shared TX_FAR call '+id);
    doubleTextCount++;
    if(variant==='green')differences.push({
     key:id,sourceRom:'red/blue',targetRom:'green',
     field:'readerDualTextChoice.sharedCallCpu',
     redBlueCallCpu:CALL.red,greenCallCpu:CALL.green,
     romPhysicalCandidateOffsetsVerified:true,
     sameVisibleGameplayOutcomeCertified:false
    });
   }else if(l.readerTwoAlternativeTextScriptsVerified!==false||
            dual?.alternativeTextScriptsStaticallyProven===true)
    return fail('Unexpected alternative TX_FAR selection '+id);
  }
  if(doubleTextCount!==4)return fail('Expected four TX_FAR choices: '+variant);
 }
 if(differences.length!==4)return fail('Expected exactly four sanctioned call relocations');
 return {verified:true,
  variants:ORDER.slice(),
  romSha256:Object.fromEntries(ORDER.map(v=>[v,KNOWN[v]])),
  linkedFlagCandidatesPerRom:8,crossMapCandidatesPerRom:5,
  doubleTextFlag1231PerRom:4,
  compareStaticBranchSemantics:true,
  byteIdenticalRomClaims:false,
  differences,
  totalPermittedCallRelocations:4,
  referenceNamesSource:'pret/pokered',
  sameCausalOutcomeVerified:false,
  gameProgressKnown:false,
  note:'Red/Blue call $3C49, Green International calls $3C30. This is verified code-offset variation, not proof of identical gameplay results.'};
}
module.exports={compareCrossVariantFlagSemantics};
