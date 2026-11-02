'use strict';

const crypto=require('node:crypto');
const {isKnownAuditedRomSha}=
 require('./romKnownSha256');
const {cpuToOffset}=
 require('./romMapCodeAtlas');

function buildIndexedJumpTargetWords({
 rom,romSha256,requirements
}={}){
 if(
  !Buffer.isBuffer(rom)||
  rom.length!==1048576||
  !isKnownAuditedRomSha(romSha256)||
  crypto.createHash('sha256')
   .update(rom).digest('hex')!==romSha256||
  !Array.isArray(requirements)
 )return [];

 const result=[];

 for(const r of requirements){
  if(
   r?.reason!==
    'LIVE_RAM_REQUIRED_FOR_INDEXED_ROM_JUMP_TABLE'||
   !Number.isInteger(r.sourceAddress)||
   !Number.isInteger(r.instructionOffset)||
   !Number.isInteger(r.assumedBank)||
   r.assumedBank<1||r.assumedBank>=64||
   !Number.isInteger(r.baseCpuAddress)||
   r.baseCpuAddress<0x4000||
   r.baseCpuAddress+254>=0x8000||
   r.pointerCandidateCount!==128||
   !Number.isInteger(r.targetCandidateCount)||
   !Number.isInteger(r.fixedRomCandidates)||
   !Number.isInteger(r.switchableRomCandidates)||
   !Number.isInteger(r.outsideRomCandidates)||
   r.runtimeRamReadObserved!==false||
   r.actualBankSelectionVerified!==false||
   r.indirectJumpObserved!==false||
   r.gameplayExecutionObserved!==false||
   r.gameEventCompleted!==false
  )continue;

  const first=cpuToOffset(
   r.assumedBank,r.baseCpuAddress,rom.length
  );

  const last=cpuToOffset(
   r.assumedBank,r.baseCpuAddress+254,rom.length
  );

  if(
   first===null||last===null||
   last!==first+254||
   last+1>=rom.length||
   Math.floor(first/16384)!==
    Math.floor((last+1)/16384)
  )continue;

  const words=rom.subarray(first,last+2);

  if(words.length!==256)continue;

  const distinct=new Set();
  const examples=[];
  let fixed=0,switchable=0,outside=0;

  for(let i=0;i<128;i++){
   const target=words.readUInt16LE(i*2);

   distinct.add(target);

   const kind=target<0x4000?
    'FIXED_ROM_WORD':
    target<0x8000?
     'SWITCHABLE_ROM_WORD_ASSUMED_BANK':
     'NON_ROM_CPU_WORD';

   if(target<0x4000)fixed++;
   else if(target<0x8000)switchable++;
   else outside++;

   if(examples.length<8&&
      !examples.some(x=>x.targetCpu===target)){
    examples.push({
     index:i,
     pointerCpu:r.baseCpuAddress+i*2,
     targetCpu:target,
     class:kind,
     candidatePhysicalOffset:
      target<0x8000?
       cpuToOffset(
        r.assumedBank,target,rom.length
       ):null
    });
   }
  }

  if(
   distinct.size!==r.targetCandidateCount||
   fixed!==r.fixedRomCandidates||
   switchable!==r.switchableRomCandidates||
   outside!==r.outsideRomCandidates
  )continue;

  result.push({
   source:'VERIFIED_ROM_INDEXED_TABLE_WORDS_128_V1',
   sourceAddress:r.sourceAddress,
   instructionOffset:r.instructionOffset,
   assumedBank:r.assumedBank,
   baseCpuAddress:r.baseCpuAddress,
   firstPhysicalOffset:first,
   pointerPositions:128,
   inputBytePossibilities:256,
   pointerIndexFormula:'SOURCE_BYTE_AND_0X7F',
   targetWordsLittleEndianHex:words.toString('hex'),
   uniqueRawTargetWords:distinct.size,
   fixedRomWordCount:fixed,
   switchableRomWordCount:switchable,
   nonRomWordCount:outside,
   exampleWords:examples,
   runtimeSourceByteObserved:false,
   bankSelectionObserved:false,
   indirectJumpObserved:false,
   gameEventCompleted:false,
   instructionTargetsProven:false
  });
 }

 return result;
}

module.exports={buildIndexedJumpTargetWords};