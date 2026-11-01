'use strict';

const {isKnownAuditedRomSha}=
 require('./romKnownSha256');

// Only addresses already evidenced as candidate dependencies
// in T218-T220. No inference about the active map script.
const ADDRESSES=[0xc21e,0xc22e,0xc23e];

const invalid=reason=>({
 verified:false,
 reason,
 values:[],
 twoReadSamplesConfirmed:false,
 atomicSnapshotVerified:false,
 scriptExecutionObserved:false,
 gameEventCompleted:false
});

function validScope(s){
 return s&&typeof s.host==='string'&&s.host.length>0&&
  Number.isInteger(s.port)&&s.port>0&&s.port<=65535&&
  Number.isSafeInteger(s.generation)&&s.generation>=0;
}

function sameScope(a,b){
 return validScope(a)&&validScope(b)&&
  a.host===b.host&&
  a.port===b.port&&
  a.generation===b.generation;
}

function byteFrom(array,index){
 if(!Array.isArray(array)||index<0||index>=array.length)
  return null;

 const value=array[index];

 if(typeof value==='string'&&/^[0-9a-f]{2}$/i.test(value))
  return parseInt(value,16);

 if(Number.isInteger(value)&&value>=0&&value<=255)
  return value;

 return null;
}

async function collectBudgetBranchLiveReadback({
 evidence,
 romSha256,
 mapId,
 firstSpriteBlock,
 eligible=false,
 getTargetScope,
 readMemoryBlock
}={}){
 if(!eligible)return invalid('PUBLICATION_ELIGIBILITY_NOT_PROVEN');

 if(
  !isKnownAuditedRomSha(romSha256)||
  !Number.isInteger(mapId)||
  ![31,34,36].includes(mapId)||
  evidence?.verified!==true||
  evidence.mapId!==mapId||
  evidence.romSha256!==romSha256||
  evidence.runtimeBudgetConditionRamSources?.reason!==
    'PATH_BUDGET_CONDITION_RAM_DEPENDENCIES'||
  evidence.runtimeBudgetConditionRamSources?.pathsResolved!==false||
  !Array.isArray(
   evidence.runtimeBudgetConditionRamSources.candidateSources
  )
 )return invalid('ROM_MAP_OR_BUDGET_EVIDENCE_INVALID');

 const candidates=
  evidence.runtimeBudgetConditionRamSources.candidateSources;

 const addresses=ADDRESSES.filter(address=>
  candidates.some(item=>
   item.address===address&&
   item.runtimeRamReadObserved===false&&
   item.liveValueKnown===false
  )
 );

 if(!addresses.length)
  return invalid('NO_MATCHING_PROVEN_BRANCH_DEPENDENCY');

 if(
  !Array.isArray(firstSpriteBlock)||
  firstSpriteBlock.length!==512||
  typeof getTargetScope!=='function'||
  typeof readMemoryBlock!=='function'
 )return invalid('FIRST_RAM_BLOCK_OR_READER_INVALID');

 const firstValues=new Map();

 for(const address of addresses){
  const value=byteFrom(
   firstSpriteBlock,address-0xc100
  );

  if(value===null)return invalid('FIRST_RAM_BYTE_INVALID');

  firstValues.set(address,value);
 }

 const before=getTargetScope();

 if(!validScope(before))
  return invalid('TARGET_SCOPE_UNVERIFIED');

 let second;

 try{
  // Read-only RetroArch command, exactly one 33-byte read
  // unless the existing readMemoryBlock needs a retry.
  second=await readMemoryBlock('C21E',33);
 }catch{
  return invalid('SECOND_RAM_READ_EXCEPTION');
 }

 const after=getTargetScope();

 if(!sameScope(before,after))
  return invalid('RETROARCH_TARGET_CHANGED');

 if(!Array.isArray(second)||second.length!==33)
  return invalid('SECOND_RAM_BLOCK_INCOMPLETE');

 const values=[];

 for(const address of addresses){
  const first=firstValues.get(address);

  const repeated=byteFrom(
   second,address-0xc21e
  );

  if(repeated===null)
   return invalid('SECOND_RAM_BYTE_INVALID');

  if(first!==repeated)
   return invalid('RAM_VALUE_CHANGED_BETWEEN_READS');

  values.push({
   address,
   value:first,
   firstValue:first,
   secondValue:repeated,
   repeatedReadMatched:true
  });
 }

 return {
  verified:true,
  source:'RETROARCH_DOUBLE_READ_C100_C21E',
  romSha256,
  mapId,
  values,
  twoReadSamplesConfirmed:true,
  publicationPositionVerified:false,
  atomicSnapshotVerified:false,
  scriptExecutionObserved:false,
  gameEventCompleted:false,
  readOnly:true,
  extraReadBytes:33
 };
}

module.exports={
 collectBudgetBranchLiveReadback,
 ADDRESSES
};