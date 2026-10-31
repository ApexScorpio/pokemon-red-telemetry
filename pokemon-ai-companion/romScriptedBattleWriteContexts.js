'use strict';
// Classify every physically observed FA/EA literal reference to the two
// map-script state bytes. Decode an opcode at the matching offset, while
// keeping unknown instruction boundaries, branch reachability and runtime
// effects explicitly separate from the physical bytes.
const crypto=require('node:crypto');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {decodeOpcode}=require('./romMapCodeAtlas');
const ROM_SIZE=1048576,BANK_SIZE=0x4000;
const CASES=Object.freeze([
 {mapId:96,ordinal:2,bank:24,address:0xd665,reads:1,writes:5,
  referenceStateLabels:['SCRIPT_SSANNE2F_DEFAULT',
   'SCRIPT_SSANNE2F_RIVAL_START_BATTLE',
   'SCRIPT_SSANNE2F_RIVAL_AFTER_BATTLE',
   'SCRIPT_SSANNE2F_RIVAL_EXIT','SCRIPT_SSANNE2F_NOOP']},
 {mapId:135,ordinal:11,bank:18,address:0xd65f,reads:1,writes:4,
  referenceStateLabels:['SCRIPT_GAMECORNER_DEFAULT',
   'SCRIPT_GAMECORNER_ROCKET_BATTLE',
   'SCRIPT_GAMECORNER_ROCKET_EXIT']}
]);
function reject(reason){return {verified:false,reason,entries:[],
 decodedCandidateCount:0,immediateValueCandidates:0,
 readCandidates:0,writeCandidates:0,actualScriptStateVerified:false};}
function inspectScriptStateLiteral({rom,bank,fileOffset,address,operation}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_SIZE||
    !Number.isInteger(bank)||bank<1||bank>=64||
    !Number.isInteger(fileOffset)||fileOffset<bank*BANK_SIZE||
    fileOffset+3>(bank+1)*BANK_SIZE||
    !Number.isInteger(address)||address<0xc000||address>0xdfff||
    (operation!=='READ_A'&&operation!=='WRITE_A'))
  return {verified:false,reason:'Invalid bank-local physical read/write'};
 const code=operation==='READ_A'?0xfa:0xea;
 if(rom[fileOffset]!==code||rom.readUInt16LE(fileOffset+1)!==address)
  return {verified:false,reason:'Literal RAM operand mismatch'};
 const pc=0x4000+fileOffset-bank*BANK_SIZE;
 const d=decodeOpcode(rom,bank,pc);
 if(!d.ok||d.at!==fileOffset||d.size!==3||d.opcode!==code)
  return {verified:false,reason:'Decoder rejects literal instruction candidate'};
 const bankStart=bank*BANK_SIZE,bankEnd=(bank+1)*BANK_SIZE;
 const from=Math.max(bankStart,fileOffset-10),to=Math.min(bankEnd,fileOffset+11);
 const before=fileOffset-2>=bankStart?
  rom.subarray(fileOffset-2,fileOffset).toString('hex'):null;
 let immediateSource=null,candidateAssignedValue=null;
 if(operation==='WRITE_A'){
  if(fileOffset>=bankStart+2&&rom[fileOffset-2]===0x3e){
   const prev=decodeOpcode(rom,bank,pc-2);
   if(prev.ok&&prev.opcode===0x3e&&prev.size===2&&prev.at===fileOffset-2){
    immediateSource='ADJACENT_LD_A_IMMEDIATE_CANDIDATE';
    candidateAssignedValue=rom[fileOffset-1];
   }
  }
  if(immediateSource===null&&fileOffset>bankStart&&rom[fileOffset-1]===0xaf){
   const prev=decodeOpcode(rom,bank,pc-1);
   if(prev.ok&&prev.opcode===0xaf&&prev.size===1&&prev.at===fileOffset-1){
    immediateSource='ADJACENT_XOR_A_ZERO_CANDIDATE';
    candidateAssignedValue=0;
   }
  }
 }
 return {verified:true,operation,opcode:code,
  fileOffset,bank,cpu:pc,wramAddress:address,
  exactOpcodeBytesHex:rom.subarray(fileOffset,fileOffset+3).toString('hex'),
  contextStartOffset:from,contextBytesHex:rom.subarray(from,to).toString('hex'),
  precedingTwoBytesHex:before,
  candidateAssignedValue,immediateSource,
  opcodeDecodesAtOffset:true,
  instructionBoundaryFromControlFlowVerified:false,
  precedingValueProvenOnExecutedPath:false,
  actualRamWriteVerified:false,runtimeExecuted:false};
}
function auditScriptedBattleStateWriteContexts({rom,scriptAtlas}={}){
 const layout=scriptAtlas?.scriptedBattleRamCandidates;
 const ref=scriptAtlas?.scriptedBattleReferenceEvidence;
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_SIZE||
    scriptAtlas?.verified!==true||layout?.verified!==true||
    ref?.verified!==true||layout.count!==2||
    !Array.isArray(layout.candidates)||layout.candidates.length!==2)
  return reject('Verified physical script memory reference catalogue required');
 const sha=crypto.createHash('sha256').update(rom).digest('hex');
 if(!isKnownAuditedRomSha(sha)||scriptAtlas.romSha256!==sha||
    layout.romSha256!==sha||ref.romSha256!==sha)
  return reject('Exact ROM SHA does not match the profile');
 const entries=[];
 for(let i=0;i<CASES.length;i++){
  const exp=CASES[i],c=layout.candidates[i],r=ref.entries?.[i];
  if(c?.mapId!==exp.mapId||c.ordinal!==exp.ordinal||
     c.handlerBank!==exp.bank||c.referenceWramAddress!==exp.address||
     c.referenceLayoutOnly!==true||c.addressProvenFromActualRomInstructions!==false||
     r?.mapId!==exp.mapId||r.ordinal!==exp.ordinal||r.battleWon!==null||
     !Array.isArray(c.literalLoadAOffsets)||!Array.isArray(c.literalStoreAOffsets)||
     c.literalLoadAOffsets.length!==exp.reads||
     c.literalStoreAOffsets.length!==exp.writes||
     c.literalLoadACandidateCount!==exp.reads||
     c.literalStoreACandidateCount!==exp.writes)
   return reject('Observed 060 script references do not match physical catalogue');
  const offsets=[...c.literalLoadAOffsets,...c.literalStoreAOffsets];
  if(new Set(offsets).size!==offsets.length)
   return reject('Duplicated read/write offsets');
  const reads=c.literalLoadAOffsets.map(fileOffset=>
   inspectScriptStateLiteral({rom,bank:exp.bank,fileOffset,
    address:exp.address,operation:'READ_A'}));
  const writes=c.literalStoreAOffsets.map(fileOffset=>
   inspectScriptStateLiteral({rom,bank:exp.bank,fileOffset,
    address:exp.address,operation:'WRITE_A'}));
  if([...reads,...writes].some(x=>x.verified!==true))
   return reject('A reported literal reference failed physical re-decode');
  entries.push({
   mapId:exp.mapId,ordinal:exp.ordinal,
   handlerBank:exp.bank,
   referenceScriptVariable:c.referenceVariable,
   referenceWramAddress:exp.address,
   reads,writes,readCandidateCount:reads.length,
   writeCandidateCount:writes.length,
   directAdjacentValueCandidates:writes.filter(x=>
    x.candidateAssignedValue!==null).length,
   referenceStateCandidateValues:writes.filter(x=>
    Number.isInteger(x.candidateAssignedValue)&&
    x.candidateAssignedValue<exp.referenceStateLabels.length)
    .map(x=>({
     fileOffset:x.fileOffset,
     candidateValue:x.candidateAssignedValue,
     referenceLabel:exp.referenceStateLabels[x.candidateAssignedValue],
     valueFromPhysicalAdjacentBytesOnly:true,
     referenceSemanticsVerifiedInRom:false
    })),
   referenceStateLabels:exp.referenceStateLabels,
   instructionBoundariesProven:false,
   controlFlowReachabilityVerified:false,
   liveRamValueRead:false,battleWon:null
  });
 }
 return {verified:true,romSha256:sha,entries,
  source:'EXACT_ROM_LD_A_FROM_AND_STORE_TO_REFERENCE_MAP_SCRIPT_BYTES_V1',
  decodedCandidateCount:entries.reduce((sum,e)=>sum+
   e.readCandidateCount+e.writeCandidateCount,0),
  immediateValueCandidates:entries.reduce((sum,e)=>
   sum+e.directAdjacentValueCandidates,0),
  readCandidates:2,writeCandidates:9,
  actualScriptStateVerified:false,allCandidatesRuntimeExecuted:false,
  gameProgressProven:false,
  warning:'All matching ROM opcode triplets re-decode correctly, but no execution trace proves boundaries, branches or assigned values.'};
}
module.exports={inspectScriptStateLiteral,auditScriptedBattleStateWriteContexts};
