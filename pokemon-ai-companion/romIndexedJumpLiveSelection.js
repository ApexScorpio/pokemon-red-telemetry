'use strict';

const {isKnownAuditedRomSha}=
 require('./romKnownSha256');

const SOURCE=
 'RETROARCH_RAM_PLUS_ROM_INDEXED_TABLE_CONDITIONAL_V1';

function invalid(reason){
 return {
  verified:false,
  reason,
  source:SOURCE,
  selections:[],
  publicationPositionVerified:false,
  atomicSnapshotVerified:false,
  indirectJumpObserved:false,
  gameEventCompleted:false
 };
}

function readBlockByte(block,start,length,address){
 if(
  !Array.isArray(block)||
  block.length!==length||
  address<start||
  address>=start+length
 )return null;

 const value=block[address-start];

 if(
  typeof value==='string'&&
  /^[0-9a-f]{2}$/i.test(value)
 )return parseInt(value,16);

 return null;
}

function readExistingSource(blocks,address){
 if(!Number.isInteger(address))
  return null;

 const locations=[
  {
   name:'PLAYER_D158',
   start:0xd158,
   length:530,
   block:blocks?.player
  },
  {
   name:'WORLD_D5A0',
   start:0xd5a0,
   length:784,
   block:blocks?.world
  },
  {
   name:'SPRITES_C100',
   start:0xc100,
   length:512,
   block:blocks?.sprites
  }
 ];

 for(const loc of locations){
  if(
   address>=loc.start&&
   address<loc.start+loc.length
  ){
   const value=readBlockByte(
    loc.block,
    loc.start,
    loc.length,
    address
   );

   return value===null?null:{
    value,
    block:loc.name
   };
  }
 }

 return null;
}

function selectIndexedJumpLiveWords({
 evidence,
 romSha256,
 mapId,
 blocks,
 eligible=false
}={}){
 if(!eligible)
  return invalid('LIVE_PUBLICATION_GATES_NOT_VERIFIED');

 if(
  !isKnownAuditedRomSha(romSha256)||
  evidence?.verified!==true||
  evidence.romSha256!==romSha256||
  evidence.mapId!==mapId||
  !Number.isInteger(mapId)||
  mapId<0||mapId>=248||
  !Array.isArray(evidence.indexedRomTableWords)||
  !Array.isArray(
   evidence.runtimeIndexedJumpRequirements
  )
 )return invalid('ROM_MAP_OR_TABLE_EVIDENCE_INVALID');

 const selections=[];

 for(const table of evidence.indexedRomTableWords){
  if(selections.length>=8)break;

  if(
   table?.source!==
    'VERIFIED_ROM_INDEXED_TABLE_WORDS_128_V1'||
   !Number.isInteger(table.sourceAddress)||
   !Number.isInteger(table.instructionOffset)||
   !Number.isInteger(table.assumedBank)||
   table.assumedBank<1||table.assumedBank>=64||
   !Number.isInteger(table.baseCpuAddress)||
   table.baseCpuAddress<0x4000||
   table.baseCpuAddress+254>=0x8000||
   table.pointerPositions!==128||
   table.inputBytePossibilities!==256||
   table.pointerIndexFormula!==
    'SOURCE_BYTE_AND_0X7F'||
   typeof table.targetWordsLittleEndianHex!=='string'||
   !/^[0-9a-f]{512}$/.test(
    table.targetWordsLittleEndianHex
   )||
   table.bankSelectionObserved!==false||
   table.runtimeSourceByteObserved!==false||
   table.indirectJumpObserved!==false||
   table.instructionTargetsProven!==false||
   table.gameEventCompleted!==false
  )continue;

  const requirement=
   evidence.runtimeIndexedJumpRequirements.find(r=>
    r.reason===
     'LIVE_RAM_REQUIRED_FOR_INDEXED_ROM_JUMP_TABLE'&&
    r.sourceAddress===table.sourceAddress&&
    r.instructionOffset===table.instructionOffset&&
    r.assumedBank===table.assumedBank&&
    r.baseCpuAddress===table.baseCpuAddress&&
    r.runtimeRamReadObserved===false&&
    r.actualBankSelectionVerified===false&&
    r.indirectJumpObserved===false&&
    r.gameplayExecutionObserved===false&&
    r.gameEventCompleted===false
   );

  if(!requirement)continue;

  const observed=readExistingSource(
   blocks,
   table.sourceAddress
  );

  if(!observed)continue;

  const index=observed.value&127;
  const offset=index*4;
  const raw=table.targetWordsLittleEndianHex;
  const low=parseInt(raw.slice(offset,offset+2),16);
  const high=parseInt(raw.slice(offset+2,offset+4),16);
  const targetCpu=low|(high<<8);

  const className=targetCpu<0x4000?
   'FIXED_ROM_WORD':
   targetCpu<0x8000?
    'SWITCHABLE_ROM_WORD_ASSUMED_BANK':
    'NON_ROM_CPU_WORD';

  const candidatePhysicalOffset=targetCpu<0x4000?
   targetCpu:
   targetCpu<0x8000?
    table.assumedBank*16384+targetCpu-0x4000:
    null;

  selections.push({
   sourceAddress:table.sourceAddress,
   sourceRamByte:observed.value,
   sourceReadBlock:observed.block,
   instructionOffset:table.instructionOffset,
   pointerIndex:index,
   pointerCpu:table.baseCpuAddress+index*2,
   rawTargetCpu:targetCpu,
   targetClass:className,
   candidatePhysicalOffset,
   assumedBank:table.assumedBank,
   sourceRamReadObserved:true,
   rawRomTableWordVerified:true,
   bankSelectionObserved:false,
   indirectJumpObserved:false,
   instructionBoundaryVerified:false,
   gameEventCompleted:false
  });
 }

 if(!selections.length)
  return invalid('NO_CORROBORATED_SOURCE_IN_EXISTING_BLOCKS');

 return {
  verified:true,
  source:SOURCE,
  romSha256,
  mapId,
  selections,
  sourceReadCount:selections.length,
  additionalUdpRequests:0,
  publicationPositionVerified:false,
  atomicSnapshotVerified:false,
  indirectJumpObserved:false,
  gameEventCompleted:false
 };
}

module.exports={
 readExistingSource,
 selectIndexedJumpLiveWords
};