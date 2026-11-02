'use strict';

const {isKnownAuditedRomSha}=
 require('./romKnownSha256');

// Applies only to maps not handled by T221.
// First sample already exists in C100..C2FF.
// At most one extra read of 128 bytes per poll.

const FIRST=0xc100;
const END=0xc300;
const MAX_SPAN=128;
const MAX_SOURCES=8;

const invalid=reason=>({
 verified:false,
 reason,
 values:[],
 twoReadSamplesConfirmed:false,
 publicationPositionVerified:false,
 atomicSnapshotVerified:false,
 scriptExecutionObserved:false,
 gameEventCompleted:false
});

function validScope(s){
 return !!s&&
  typeof s.host==='string'&&
  s.host.length>0&&
  Number.isInteger(s.port)&&
  s.port>=1&&s.port<=65535&&
  Number.isSafeInteger(s.generation)&&
  s.generation>=0;
}

function sameScope(a,b){
 return validScope(a)&&validScope(b)&&
  a.host===b.host&&
  a.port===b.port&&
  a.generation===b.generation;
}

function byteAt(bytes,index){
 if(!Array.isArray(bytes)||
    index<0||index>=bytes.length)return null;

 const value=bytes[index];

 if(
  typeof value==='string'&&
  /^[0-9a-f]{2}$/i.test(value)
 )return parseInt(value,16);

 if(
  Number.isInteger(value)&&
  value>=0&&value<=255
 )return value;

 return null;
}

function selectBudgetWindow(evidence){
 const info=evidence?.runtimeBudgetConditionRamSources;

 if(
  evidence?.verified!==true||
  !Number.isInteger(evidence.mapId)||
  evidence.mapId<0||evidence.mapId>=248||
  [31,34,36].includes(evidence.mapId)||
  !isKnownAuditedRomSha(evidence.romSha256)||
  info?.reason!==
   'PATH_BUDGET_CONDITION_RAM_DEPENDENCIES'||
  info.source!=='ROM_ABSTRACT_CONDITION_HISTORY'||
  info.pathsResolved!==false||
  !Number.isInteger(info.pathBudgetStops)||
  info.pathBudgetStops<=0||
  !Array.isArray(info.candidateSources)||
  info.candidateSources.length>12
 )return null;

 const candidates=[];
 const seen=new Set();

 for(const c of info.candidateSources){
  if(
   !Number.isInteger(c?.address)||
   c.address<FIRST||c.address>=END||
   !Number.isInteger(c.conditionalStoppedPaths)||
   c.conditionalStoppedPaths<1||
   c.conditionalStoppedPaths>info.pathBudgetStops||
   c.runtimeRamReadObserved!==false||
   c.liveValueKnown!==false||
   seen.has(c.address)
  )continue;

  seen.add(c.address);

  candidates.push({
   address:c.address,
   paths:c.conditionalStoppedPaths
  });
 }

 if(!candidates.length)return null;

 // Select the most informative compact group,
 // without ever reading a larger memory range.
 const windows=candidates.map(c=>{
  const grouped=candidates.filter(x=>
   x.address>=c.address&&
   x.address-c.address<MAX_SPAN
  ).sort((a,b)=>
   b.paths-a.paths||a.address-b.address
  ).slice(0,MAX_SOURCES);

  const score=grouped.reduce(
   (n,x)=>n+x.paths,0
  );

  const addresses=grouped.map(x=>x.address);

  return {
   score,
   grouped,
   min:Math.min(...addresses),
   max:Math.max(...addresses)
  };
 });

 windows.sort((a,b)=>
  b.score-a.score||
  b.grouped.length-a.grouped.length||
  a.min-b.min
 );

 const best=windows[0];

 if(
  !best||
  best.max-best.min+1>MAX_SPAN
 )return null;

 return {
  start:best.min,
  length:best.max-best.min+1,
  sources:best.grouped.sort(
   (a,b)=>a.address-b.address
  ),
  sourcesNotSelected:
   candidates.length-best.grouped.length,
  totalCandidateSources:
   info.distinctCandidateRamSources
 };
}

async function collectWorldBudgetRamReadback({
 evidence,
 romSha256,
 mapId,
 firstSpriteBlock,
 eligible=false,
 getTargetScope,
 readMemoryBlock
}={}){
 if(!eligible)
  return invalid('PUBLICATION_ELIGIBILITY_NOT_PROVEN');

 if(
  !isKnownAuditedRomSha(romSha256)||
  evidence?.romSha256!==romSha256||
  evidence?.mapId!==mapId||
  !Number.isInteger(mapId)
 )return invalid('ROM_OR_MAP_ID_MISMATCH');

 const window=selectBudgetWindow(evidence);

 if(!window)
  return invalid('NO_VERIFIED_IN_BLOCK_RAM_DEPENDENCY');

 if(
  !Array.isArray(firstSpriteBlock)||
  firstSpriteBlock.length!==512||
  typeof getTargetScope!=='function'||
  typeof readMemoryBlock!=='function'
 )return invalid('FIRST_BLOCK_OR_READER_INVALID');

 const firstValues=new Map();

 for(const source of window.sources){
  const value=byteAt(
   firstSpriteBlock,
   source.address-FIRST
  );

  if(value===null)
   return invalid('FIRST_BYTE_INVALID');

  firstValues.set(source.address,value);
 }

 const before=getTargetScope();

 if(!validScope(before))
  return invalid('TARGET_SCOPE_INVALID');

 let repeated;

 try{
  repeated=await readMemoryBlock(
   window.start.toString(16).toUpperCase(),
   window.length
  );
 }catch{
  return invalid('SECOND_READ_EXCEPTION');
 }

 const after=getTargetScope();

 if(!sameScope(before,after))
  return invalid('RETROARCH_TARGET_CHANGED');

 if(
  !Array.isArray(repeated)||
  repeated.length!==window.length
 )return invalid('SECOND_BLOCK_INCOMPLETE');

 const values=[];

 for(const source of window.sources){
  const first=firstValues.get(source.address);

  const second=byteAt(
   repeated,
   source.address-window.start
  );

  if(second===null)
   return invalid('SECOND_BYTE_INVALID');

  if(first!==second)
   return invalid('RAM_VALUE_CHANGED_BETWEEN_READS');

  values.push({
   address:source.address,
   value:first,
   firstValue:first,
   secondValue:second,
   repeatedReadMatched:true,
   conditionalStoppedPaths:
    source.paths
  });
 }

 return {
  verified:true,
  source:'RETROARCH_DOUBLE_READ_WORLD_BUDGET_WINDOW',
  romSha256,
  mapId,
  values,
  selectedReadStart:window.start,
  extraReadBytes:window.length,
  sourcesNotSelected:window.sourcesNotSelected,
  twoReadSamplesConfirmed:true,
  publicationPositionVerified:false,
  atomicSnapshotVerified:false,
  scriptExecutionObserved:false,
  gameEventCompleted:false,
  readOnly:true
 };
}

module.exports={
 selectBudgetWindow,
 collectWorldBudgetRamReadback
};