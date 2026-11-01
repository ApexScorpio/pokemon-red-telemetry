'use strict';
// Audit the 1,126 physical map-object script references individually.
// These are ROM address/metadata facts, NOT proof of scripted outcomes.
const {AUDITED_ROM_SHA256,isKnownAuditedRomSha}=require('./romKnownSha256');
const MAPS=248,HEADERS=226,REFERENCES=1126,ASM=626,UNIQUE_ASM=516;
const BY_KIND=Object.freeze({SIGN:202,NPC:472,TRAINER:334,ITEM:106,STATIC_POKEMON:12});
function invalid(reason){return {verified:false,reason,rows:[],summary:null,
 semantic100PercentCertified:false,gameplayCompletionCertified:false};}
const key=r=>r.mapId+':'+r.kind+':'+r.ordinal;
function buildScriptUnresolvedEvidence({atlas}={}){
 const sha=atlas?.romSha256;
 const summary=atlas?.summary;
 if(!isKnownAuditedRomSha(sha)||atlas?.verified!==true||
    !Array.isArray(atlas.maps)||atlas.maps.length!==MAPS||
    (atlas.references!==undefined&&
     (!Array.isArray(atlas.references)||
      atlas.references.length!==REFERENCES))||
    summary?.mapIds!==MAPS||summary.normalMaps!==HEADERS||
    summary.unresolvedMapIDs!==MAPS-HEADERS||
    summary.referencedInteractions!==REFERENCES||
    summary.resolvedTextPointers!==REFERENCES||
    summary.unresolvedTextPointers!==0||
    summary.asmTextReferences!==ASM||
    summary.uniqueAsmEntrypoints!==UNIQUE_ASM||
    summary.trainerEventFlagBindings!==332||
    summary.stationaryEventFlagBindings!==12||
    summary.trainerEventFlagBindingsMissing!==2||
    summary.asmSemanticallyCertified!==0||
    summary.semanticallyCertifiedInteractionScripts!==0||
    atlas.scriptEffectsSemanticallyComplete!==false)
  return invalid('Exact audited ROM and full unresolved script atlas required');
 const mapRefs=new Map(), perMap=[];
 let mapCount=0,noHeaders=0;
 for(let id=0;id<MAPS;id++){
  const map=atlas.maps[id];
  if(!map||map.mapId!==id||typeof map.verified!=='boolean'||
     !Array.isArray(map.interactions))
   return invalid('Map shape/order invalid: '+id);
  if(map.verified)mapCount++;else {
   noHeaders++;
   if(map.interactions.length!==0)return invalid('Non-normal map invents interactions: '+id);
  }
  perMap.push({mapId:id,hasNormalHeader:map.verified,
   totalReferences:map.interactions.length,asmReferences:0,
   unknownEffects:map.interactions.length});
  for(const r of map.interactions){
   const k=key(r);
   if(r.mapId!==id||mapRefs.has(k))
    return invalid('Map reference duplicate/mismatched: '+k);
   mapRefs.set(k,r);
  }
 }
 if(mapCount!==HEADERS||noHeaders!==MAPS-HEADERS||mapRefs.size!==REFERENCES)
  return invalid('248-map atlas does not reconcile with 1126 references');
 // romVariantRegistry publishes map-scoped interactions but intentionally
 // omits the redundant top-level references array. Use the map-scoped
 // records as the authoritative index; if a full raw audit supplies the
 // optional flattened list, reject any disagreement or identity mismatch.
 const records=atlas.references===undefined?
  [...mapRefs.values()]:atlas.references;
 if(records.length!==REFERENCES||
    records.some(r=>mapRefs.get(key(r))!==r))
  return invalid('Flattened references disagree with audited map interactions');
 const rows=[],seen=new Set(), kinds={SIGN:0,NPC:0,TRAINER:0,ITEM:0,STATIC_POKEMON:0};
 const asmEntrypoints=new Set();
 let asmRefs=0,boundEventBits=0;
 for(const r of records){
  const k=key(r);
  if(!Object.hasOwn(kinds,r.kind)||seen.has(k)||!mapRefs.has(k)||
     mapRefs.get(k)!==r||
     !Number.isInteger(r.ordinal)||r.ordinal<1||
     !Number.isInteger(r.x)||!Number.isInteger(r.y)||
     !Number.isInteger(r.textId)||r.textId<0||r.textId>255||
     !Number.isInteger(r.rawTextId)||r.rawTextId<0||r.rawTextId>255||
     r.textPointerVerified!==true||
     !Number.isInteger(r.scriptFileOffset)||r.scriptFileOffset<0||
     r.scriptFileOffset>=1048576||
     typeof r.scriptCommand!=='string'||!r.scriptCommand||
     r.conditionsFullyDecoded!==false||
     r.scriptEffectsVerified!==false||
     r.effectBranchesVerified!==false||
     r.interactionExecuted!==false||
     r.accessibleNow!==null||r.alreadyCompleted!==null)
    return invalid('Reference lacks verified offset or fabricates outcome: '+k);
  seen.add(k);kinds[r.kind]++;
  const isAsm=r.scriptCommand==='TX_START_ASM';
  if(isAsm){
    if(r.asmCandidate?.verified!==true||
       r.asmCandidate.txAsmFileOffset!==r.scriptFileOffset)
      return invalid('ASM handler is not anchored to physical ROM offset: '+k);
    asmRefs++;asmEntrypoints.add(r.scriptFileOffset);
    perMap[r.mapId].asmReferences++;
  }else if(r.asmCandidate!==null){
    return invalid('Non ASM text cannot claim ASM handler: '+k);
  }
  let eventBitIndex=null;
  if(r.eventBitBindingVerified===true){
    if(!Number.isInteger(r.eventBitIndex)||r.eventBitIndex<0||
       r.eventBitIndex>=2560)
      return invalid('Unbounded event flag binding: '+k);
    eventBitIndex=r.eventBitIndex;boundEventBits++;
  }else if(r.eventBitIndex!==null){
    return invalid('Unproven event bit presented as known: '+k);
  }
  rows.push({
    mapId:r.mapId,kind:r.kind,ordinal:r.ordinal,x:r.x,y:r.y,
    rawTextId:r.rawTextId,textId:r.textId,
    scriptFileOffset:r.scriptFileOffset,scriptCommand:r.scriptCommand,
    scriptDispatchClass:r.scriptDispatchClass,
    asmHandlerOffset:isAsm?r.scriptFileOffset:null,
    eventBitIndex,eventBitBindingVerified:r.eventBitBindingVerified===true,
    blockers:isAsm?['ASM_EFFECTS_NOT_SEMANTICALLY_CERTIFIED','LIVE_ACTION_NOT_PROVEN']:
      ['SCRIPT_EFFECTS_NOT_SEMANTICALLY_CERTIFIED','LIVE_ACTION_NOT_PROVEN'],
    effectsVerified:false,completedNow:null,accessibleNow:null
  });
 }
 if(Object.entries(BY_KIND).some(([k,n])=>kinds[k]!==n)||
    asmRefs!==ASM||asmEntrypoints.size!==UNIQUE_ASM||
    boundEventBits!==344||seen.size!==REFERENCES||
    perMap.reduce((n,m)=>n+m.totalReferences,0)!==REFERENCES)
  return invalid('Script categories, ASM offsets, or event-bit bindings do not reconcile');
 const unbound=rows.filter(r=>r.kind==='TRAINER'&&!r.eventBitBindingVerified)
  .map(r=>[r.mapId,r.ordinal]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 if(JSON.stringify(unbound)!==JSON.stringify([[96,2],[135,11]]))
  return invalid('Unbound trainer entries changed from audited ROM evidence');
 const hotspots=[...perMap].filter(x=>x.hasNormalHeader)
  .sort((a,b)=>b.asmReferences-a.asmReferences||
   b.totalReferences-a.totalReferences||a.mapId-b.mapId).slice(0,20);
 return {verified:true,source:'EXACT_ROM_MAP_INTERACTION_SCRIPT_EVIDENCE_V1',
  romSha256:sha,rows,perMap,hotspots,
  summary:{mapIds:MAPS,normalHeaders:HEADERS,nonNormalIds:MAPS-HEADERS,
   references:REFERENCES,byKind:kinds,physicalOffsetsVerified:REFERENCES,
   asmReferences:ASM,uniqueAsmEntrypoints:UNIQUE_ASM,
   eventBitBindings:boundEventBits,unboundTrainerReferences:unbound,
   scriptEffectsUnverified:REFERENCES,runtimeActionsCertified:0},
  semantic100PercentCertified:false,gameplayCompletionCertified:false,
  warning:'A ROM proves map-object text addresses and candidate handlers, never execution or accessibility.'};
}
function compareScriptUnresolvedEvidence({red,blue,green}={}){
 const required={red:AUDITED_ROM_SHA256.RED,blue:AUDITED_ROM_SHA256.BLUE,
  green:AUDITED_ROM_SHA256.GREEN_INTERNATIONAL_1_2_1};
 const datasets={red,blue,green};
 const deny=reason=>({verified:false,reason,positionDifferences:[],
  gameplayEquivalenceCertified:false});
 for(const [variant,sha] of Object.entries(required)){
  const d=datasets[variant];
  if(d?.verified!==true||d.romSha256!==sha||
     d.source!=='EXACT_ROM_MAP_INTERACTION_SCRIPT_EVIDENCE_V1'||
     !Array.isArray(d.rows)||d.rows.length!==REFERENCES||
     d.summary?.references!==REFERENCES||
     d.summary?.scriptEffectsUnverified!==REFERENCES||
     d.semantic100PercentCertified!==false||
     d.gameplayCompletionCertified!==false)
   return deny('Incompatible '+variant+' ROM interaction inventory');
  if(d.rows.some(r=>!Number.isInteger(r.mapId)||r.mapId<0||r.mapId>=MAPS||
     !Object.hasOwn(BY_KIND,r.kind)||!Number.isInteger(r.ordinal)||r.ordinal<1||
     !Number.isInteger(r.x)||!Number.isInteger(r.y)||
     !Number.isInteger(r.scriptFileOffset)||r.scriptFileOffset<0||
     r.scriptFileOffset>=1048576||
     !Number.isInteger(r.rawTextId)||r.rawTextId<0||r.rawTextId>255||
     (r.eventBitIndex!==null&&
       (!Number.isInteger(r.eventBitIndex)||r.eventBitIndex<0||
        r.eventBitIndex>=2560))||
     typeof r.scriptCommand!=='string'||!r.scriptCommand||
     r.effectsVerified!==false||r.completedNow!==null||r.accessibleNow!==null))
   return deny('Missing or implausible physical evidence: '+variant);
 }
 const indexes=Object.fromEntries(Object.entries(datasets).map(([v,d])=>
  [v,new Map(d.rows.map(r=>[key(r),r]))]));
 if(Object.values(indexes).some(i=>i.size!==REFERENCES))
  return deny('Duplicate interaction identifiers');
 const allKeys=new Set(Object.values(indexes).flatMap(x=>[...x.keys()]));
 const changes=[],positionDifferences=[],positionByMap=new Map(),
  counts={recordKeys:allKeys.size,
   missingRecordKeys:0,physicalOffsetsDifferent:0,commandsDifferent:0,
   textIdsDifferent:0,positionsDifferent:0,eventBitsDifferent:0};
 const pairs=[['red','blue'],['red','green'],['blue','green']];
 const pairwise=Object.fromEntries(pairs.map(([a,b])=>[a+'_'+b,{
  recordsCompared:0,offsetsDifferent:0,positionsDifferent:0,
  commandsDifferent:0,textIdsDifferent:0,eventBitsDifferent:0}]));
 const samePosition=(a,b)=>a.x===b.x&&a.y===b.y;
 for(const k of [...allKeys].sort()){
  const triplet=['red','blue','green'].map(v=>indexes[v].get(k)||null);
  const [a,b,c]=triplet;
  if(triplet.some(x=>x===null)){
   counts.missingRecordKeys++;
   changes.push({key:k,difference:['ABSENT_REFERENCE_IN_VARIANT']});
   continue;
  }
  for(const [v1,v2] of pairs){
   const x=indexes[v1].get(k),y=indexes[v2].get(k);
   const row=pairwise[v1+'_'+v2];
   row.recordsCompared++;
   if(x.scriptFileOffset!==y.scriptFileOffset)row.offsetsDifferent++;
   if(!samePosition(x,y))row.positionsDifferent++;
   if(x.scriptCommand!==y.scriptCommand)row.commandsDifferent++;
   if(x.rawTextId!==y.rawTextId)row.textIdsDifferent++;
   if(x.eventBitIndex!==y.eventBitIndex)row.eventBitsDifferent++;
  }
  const fields=[
   ['physicalOffsetsDifferent','scriptFileOffset'],
   ['commandsDifferent','scriptCommand'],
   ['textIdsDifferent','rawTextId'],
   ['eventBitsDifferent','eventBitIndex']
  ];
  const difference=[];
  for(const [countName,field] of fields)
   if(a[field]!==b[field]||b[field]!==c[field]){
    counts[countName]++;difference.push(countName);
   }
  if(!samePosition(a,b)||!samePosition(b,c)){
   counts.positionsDifferent++;difference.push('positionsDifferent');
   const detail={
    key:k,mapId:a.mapId,kind:a.kind,ordinal:a.ordinal,
    coordinateMatchIsOrdinalBased:true,
    red:{x:a.x,y:a.y,scriptFileOffset:a.scriptFileOffset},
    blue:{x:b.x,y:b.y,scriptFileOffset:b.scriptFileOffset},
    green:{x:c.x,y:c.y,scriptFileOffset:c.scriptFileOffset},
    redBlueDifferent:!samePosition(a,b),
    redGreenDifferent:!samePosition(a,c),
    blueGreenDifferent:!samePosition(b,c),
    outcomeOrAccessibilityVerified:false
   };
   positionDifferences.push(detail);
   positionByMap.set(a.mapId,(positionByMap.get(a.mapId)||0)+1);
  }
  if(difference.length)changes.push({key:k,difference,
   redOffset:a.scriptFileOffset,blueOffset:b.scriptFileOffset,
   greenOffset:c.scriptFileOffset});
 }
 const positionsByMap=[...positionByMap].map(([mapId,references])=>({
  mapId,references})).sort((a,b)=>b.references-a.references||a.mapId-b.mapId);
 const offsetOnlyDifferences=changes.filter(r=>
  r.difference.length===1&&r.difference[0]==='physicalOffsetsDifferent').length;
 return {verified:true,source:'TRIPLE_EXACT_ROM_SCRIPT_EVIDENCE_COMPARISON_V2',
  counts,changes,positionDifferences,positionsByMap,
  offsetOnlyDifferences,pairwise,
  positionEvidenceComplete:counts.missingRecordKeys===0,
  allMapScriptEffectsCertified:false,
  gameplayEquivalenceCertified:false,
  warning:'Coordinate differences compare map/type/ordinal references, not object identity or confirmed relocations. Physical offset differences alone do not imply different behavior.'};
}
module.exports={buildScriptUnresolvedEvidence,compareScriptUnresolvedEvidence};
