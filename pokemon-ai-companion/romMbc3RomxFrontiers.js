'use strict';
// Audit bounded static ROMX decoding frontiers. A raw 0x00 may be NOP or
// non-code data; this module never labels a frontier as executed or reachable.
const {decodeOpcode}=require('./romMapCodeAtlas');
const bad=reason=>({verified:false,reason,cappedEntries:0,
 frontierEvidence:[],activeBankVerified:false,executedInstructions:0});
function auditMbc3RomxFrontiers({rom,depthSweep}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    ![0x0f,0x10,0x11,0x12,0x13].includes(rom[0x147])||
    rom[0x148]!==5||
    depthSweep?.verified!==true||depthSweep.deepestBudget!==1024||
    depthSweep.executedInstructions!==0||
    depthSweep.activeBankVerified!==false||
    !Array.isArray(depthSweep.comparisons)||
    depthSweep.comparisons.length!==depthSweep.uniquePhysicalEntrypoints||
    depthSweep.comparisons.length>64)
  return bad('A verified 1024-instruction MBC3 depth sweep is required');
 const evidence=[],reasons=Object.create(null);
 let capped=0,sampled=0,totalUnique=0,zeroFirst=0,allZeroWindow=0,validFirst=0;
 let longZero=0,zeroToBankEnd=0,totalZeroBytes=0;
 for(const record of depthSweep.comparisons){
  const bank=record?.bank,cpu=record?.entryCpu;
  if(!Number.isInteger(bank)||bank<1||bank>63||
     !Number.isInteger(cpu)||cpu<0x4000||cpu>=0x8000||
     record.physicalFileOffset!==bank*0x4000+cpu-0x4000||
     !Array.isArray(record.budgetExhaustedByDepth)||
     record.budgetExhaustedByDepth.length!==4||
     !Array.isArray(record.decodedByDepth)||
     record.decodedByDepth.length!==4||
     !Number.isInteger(record.frontierUniquePendingAt1024)||
     record.frontierUniquePendingAt1024<0||
     record.frontierUniquePendingAt1024>4096||
     !Array.isArray(record.frontierTargetsAt1024)||
     record.frontierTargetsAt1024.length!==
       record.frontierUniquePendingAt1024||
     record.executed!==false||record.activeBankVerified!==false||
     record.causalLinkVerified!==false)
   return bad('Malformed or executed ROMX frontier record');
  const cappedAt1024=record.budgetExhaustedByDepth[3]===true;
  if(cappedAt1024!== (record.frontierUniquePendingAt1024>0)||
     (cappedAt1024&&record.decodedByDepth[3]!==1024)||
     (!cappedAt1024&&record.frontierTargetsAt1024.length!==0))
   return bad('Frontier proof and budget status disagree');
  if(!cappedAt1024)continue;
  capped++;
  totalUnique+=record.frontierUniquePendingAt1024;
  const samples=[],seen=new Set();
  for(const item of record.frontierTargetsAt1024){
   const pos=item?.cpuPc;
   const offset=bank*0x4000+pos-0x4000;
   if(!Number.isInteger(pos)||pos<0x4000||pos>=0x8000||
      seen.has(pos)||item.fileOffset!==offset||
      offset<0x4000||offset>=rom.length||
      item.firstByte!==rom[offset]||
      typeof item.rawWindowHex!=='string'||
      item.rawWindowHex.length<2||item.rawWindowHex.length>32||
      !/^[0-9a-f]+$/.test(item.rawWindowHex)||
      !Number.isInteger(item.leadingNopBytesInWindow)||
      item.leadingNopBytesInWindow<0||
      typeof item.firstOpcodeDecodable!=='boolean')
    return bad('Invalid frontier sample location or raw byte');
   seen.add(pos);
   const window=rom.subarray(offset,Math.min(offset+16,(bank+1)*0x4000));
   const hex=Array.from(window,b=>b.toString(16).padStart(2,'0')).join('');
   const leading=Array.from(window).findIndex(x=>x!==0);
   const zeroRun=leading===-1?window.length:leading;
   const decoded=decodeOpcode(rom,bank,pos);
   const bankEnd=(bank+1)*0x4000;
   let end=offset;
   while(end<bankEnd&&rom[end]===0)end++;
   const zeroLen=end-offset;
   if(item.rawWindowHex!==hex||
      item.leadingNopBytesInWindow!==zeroRun||
      item.firstOpcodeDecodable!==(decoded.ok===true)||
      item.firstDecodeReason!==(decoded.ok?null:decoded.reason)||
      item.zeroRunLengthToNonzeroOrBankEnd!==zeroLen||
      item.zeroRunEndCpuExclusive!==pos+zeroLen||
      item.zeroRunReachesBankEnd!==(zeroLen>0&&end===bankEnd)||
      item.firstNonzeroByteAfterRun!==
       (end<bankEnd?rom[end]:null))
    return bad('Frontier sample does not match ROM bytes or zero run');
   totalZeroBytes+=zeroLen;
   if(zeroLen>=16)longZero++;
   if(zeroLen>0&&end===bankEnd)zeroToBankEnd++;
   sampled++;
   if(item.firstByte===0)zeroFirst++;
   if(window.length===16&&zeroRun===16)allZeroWindow++;
   if(decoded.ok)validFirst++;
   else{
    const reason=decoded.reason||'UNKNOWN';
    reasons[reason]=(reasons[reason]||0)+1;
   }
   samples.push({...item,staticCandidateOnly:true,
    targetRuntimeObserved:false,activeBankVerified:false});
  }
  if(samples.length===0)return bad('Capped frontier without a sample');
  evidence.push({bank,entryCpu:cpu,
   entryFileOffset:record.physicalFileOffset,
   decodedCandidateInstructionsAt1024:record.decodedByDepth[3],
   pendingUniqueTargetCount:record.frontierUniquePendingAt1024,
   pendingRawStaticEdges:record.pendingStaticEdgesAt1024,
   samples,wasExecuted:false,activeBankVerified:false,
   causalityToSourceWriteVerified:false});
 }
 if(capped!==depthSweep.entriesStillBudgetExhausted||
    sampled!==totalUnique)
  return bad('Capped frontier targets are missing or inconsistent');
 return {verified:true,source:'MBC3_ROMX_1024_FRONTIER_BYTE_EVIDENCE_V2',
  cappedEntries:capped,entriesUncapped:depthSweep.comparisons.length-capped,
  sampledFrontierTargets:sampled,totalPendingUniqueFrontierTargets:totalUnique,
  zeroFirstByteSamples:zeroFirst,allZero16ByteWindows:allZeroWindow,
  decodableFirstOpcodeSamples:validFirst,decodeFailureReasons:{...reasons},
  fullFrontierCoverage:true,
  longZeroRunsAtLeast16:longZero,
  zeroRunsReachingBankEnd:zeroToBankEnd,
  totalZeroPrefixBytesAcrossSamples:totalZeroBytes,
  frontierEvidence:evidence,activeBankVerified:false,
  executedInstructions:0,causalBankWritesVerified:0,
  gameplay100PercentCertified:false,
  warning:'Unvisited static graph frontiers only. A 0x00 byte or 16-byte zero window does not prove padding, execution, control-flow reachability, or active ROM bank.'};
}
module.exports={auditMbc3RomxFrontiers};
