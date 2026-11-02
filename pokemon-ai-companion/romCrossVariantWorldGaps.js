'use strict';
// Independent SHA-locked, map-by-map comparison of three *static* world
// coverage reports. Identical counters cannot certify identical gameplay.
const {AUDITED_ROM_SHA256}=require('./romKnownSha256');
const EXPECTED=Object.freeze({
 RED:AUDITED_ROM_SHA256.RED,
 BLUE:AUDITED_ROM_SHA256.BLUE,
 GREEN:AUDITED_ROM_SHA256.GREEN_INTERNATIONAL_1_2_1
});
const MAPS=248,HEADERS=226,ACTIONS=1992,SCRIPTS=1126,ASM=626;
const FIELDS=['hasNormalHeader','staticActionCount','scriptReferences',
 'asmReferences','actionsWithoutRuntimeProof','nextEvidence','gapClasses'];
function fail(reason){return {verified:false,reason,mapsCompared:0,differences:[],
  identicalStaticCoverage:false,gameplayEquivalent:null,
  gameplayCompletionCertified:false};}
function inspect(variant,report){
 if(report?.verified!==true||report.version!==2||
    report.source!=='OBJECT_ROWS_FOR_WINDOWS_POWERSHELL'||
    report.romSha256!==EXPECTED[variant]||
    report.gameplayCompletionCertified!==false||
    !Array.isArray(report.rows)||report.rows.length!==MAPS||
    report.counts?.mapIds!==MAPS||
    report.counts.normalMapHeaders!==HEADERS||
    report.counts.noNormalHeader!==MAPS-HEADERS||
    report.counts.staticallyIndexedActions!==ACTIONS||
    report.counts.scriptReferences!==SCRIPTS||
    report.counts.asmReferences!==ASM||
    report.counts.unverifiedScriptEffects!==SCRIPTS||
    report.counts.gameplayCompletionPercentage!==null||
    !Number.isSafeInteger(report.counts.runtimeActionsUnproven)||
    report.counts.runtimeActionsUnproven<0)
  return false;
 let normal=0,actions=0,scripts=0,asm=0,pending=0;
 for(let i=0;i<MAPS;i++){
  const r=report.rows[i];
  if(!r||r.mapId!==i||r.gameplayVerified!==false||
     r.completionPercent!==null||
     typeof r.nextEvidence!=='string'||r.nextEvidence.length===0||
     typeof r.gapClasses!=='string')
   return false;
  if(r.hasNormalHeader===true){
   normal++;
   const values=[r.staticActionCount,r.scriptReferences,
    r.asmReferences,r.actionsWithoutRuntimeProof];
   if(values.some(v=>!Number.isSafeInteger(v)||v<0)||
      r.asmReferences>r.scriptReferences||
      r.actionsWithoutRuntimeProof>r.staticActionCount)
    return false;
   actions+=r.staticActionCount;scripts+=r.scriptReferences;
   asm+=r.asmReferences;pending+=r.actionsWithoutRuntimeProof;
  }else if(r.hasNormalHeader!==false||
    r.staticActionCount!==null||r.scriptReferences!==null||
    r.asmReferences!==null||r.actionsWithoutRuntimeProof!==null||
    r.gapClasses!=='MAP_HEADER_NOT_A_NORMAL_GAMEPLAY_HEADER')return false;
 }
 return normal===HEADERS&&actions===ACTIONS&&scripts===SCRIPTS&&
  asm===ASM&&pending===report.counts.runtimeActionsUnproven;
}
function compareCrossVariantWorldGaps({red,blue,green}={}){
 const reports={RED:red,BLUE:blue,GREEN:green};
 for(const variant of Object.keys(reports))
  if(!inspect(variant,reports[variant]))
   return fail('Invalid or mismatched audited '+variant+' static ROM export');
 const differences=[],counts=Object.fromEntries(FIELDS.map(f=>[f,0]));
 const sameByMap=[];
 for(let mapId=0;mapId<MAPS;mapId++){
  const rows={
   RED:red.rows[mapId],BLUE:blue.rows[mapId],GREEN:green.rows[mapId]
  };
  const fields=FIELDS.filter(field=>!(Object.is(rows.RED[field],rows.BLUE[field])&&
    Object.is(rows.RED[field],rows.GREEN[field])));
  if(fields.length){
   for(const f of fields)counts[f]++;
   differences.push({mapId,fields,
    values:Object.fromEntries(fields.map(f=>[f,{
     RED:rows.RED[f],BLUE:rows.BLUE[f],GREEN:rows.GREEN[f]}])),
    semanticGameEffectProven:false,liveProgressProven:false});
  }else sameByMap.push(mapId);
 }
 return {
  verified:true,source:'THREE_SHA_LOCKED_STATIC_WORLD_COVERAGE_COMPARISON',
  romSha256:EXPECTED,mapsCompared:MAPS,
  mapsWithEqualStaticCoverage:sameByMap.length,
  mapsWithDifferentStaticCoverage:differences.length,
  differenceCountsByField:counts,differences,
  identicalStaticCoverage:differences.length===0,
  gameplayEquivalent:null,gameplayCompletionCertified:false,
  checksAll248Ids:true,requiresLiveGameValidation:true,
  warning:'Matching gap evidence means only matching static coverage; it proves neither equal game code nor identical outcomes.'
 };
}
module.exports={compareCrossVariantWorldGaps};
