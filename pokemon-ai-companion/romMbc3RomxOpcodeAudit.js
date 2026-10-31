'use strict';
// Audit the first Game Boy CPU instruction at conditional ROMX entrypoints.
// A decodable byte proves neither code nor execution.
const {decodeOpcode}=require('./romMapCodeAtlas');
const BYTES=1048576;
function auditMbc3RomxEntryOpcodes({rom,scenarioAtlas}={}){
 const bad=(reason)=>({verified:false,reason,scenariosAudited:0,
  notDecodableCount:0,notDecodable:[],activeBankVerified:false});
 if(!Buffer.isBuffer(rom)||rom.length!==BYTES||
    ![0x0f,0x10,0x11,0x12,0x13].includes(rom[0x147])||
    rom[0x148]!==5||scenarioAtlas?.verified!==true||
    !Array.isArray(scenarioAtlas.scenarios)||
    scenarioAtlas.scenarios.length>4096||
    scenarioAtlas.scenarioCount!==scenarioAtlas.scenarios.length||
    scenarioAtlas.activeBanksVerified!==0||
    scenarioAtlas.executedTransfers!==0)
  return bad('Verified bounded ROMX conditional atlas required');
 const nonDecodable=[],reasons=Object.create(null);
 let valid=0;
 for(const s of scenarioAtlas.scenarios){
  if(!Number.isInteger(s.rom0TransferPc)||s.rom0TransferPc<0||
     s.rom0TransferPc>=0x4000||
     !Number.isInteger(s.candidateWritePc)||s.candidateWritePc<0||
     s.candidateWritePc>=0x4000||
     !Number.isInteger(s.candidateBankIfExecuted)||
     s.candidateBankIfExecuted<1||s.candidateBankIfExecuted>=64||
     !Number.isInteger(s.romxTargetCpu)||
     s.romxTargetCpu<0x4000||s.romxTargetCpu>=0x8000||
     !Number.isInteger(s.physicalFileOffset)||
     s.physicalFileOffset!==s.candidateBankIfExecuted*0x4000+
       s.romxTargetCpu-0x4000||
     s.physicalFileOffset>=rom.length||
     s.physicalFirstOpcodeByte!==rom[s.physicalFileOffset]||
     typeof s.physicalFirstOpcodeDecodable!=='boolean'||
     s.bankWriteExecuted!==false||s.transferExecuted!==false||
     s.activeBankVerified!==false||s.causalLinkVerified!==false)
   return bad('Malformed or ungrounded ROMX physical scenario');
  const decoded=decodeOpcode(rom,s.candidateBankIfExecuted,s.romxTargetCpu);
  if((decoded.ok===true)!==s.physicalFirstOpcodeDecodable)
   return bad('Atlas and independently decoded opcode disagree');
  if(decoded.ok){valid++;continue;}
  const reason=decoded.reason||'UNKNOWN_DECODE_FAILURE';
  reasons[reason]=(reasons[reason]||0)+1;
  nonDecodable.push({
   transferPc:s.rom0TransferPc,writePc:s.candidateWritePc,
   bank:s.candidateBankIfExecuted,targetCpu:s.romxTargetCpu,
   fileOffset:s.physicalFileOffset,firstByte:s.physicalFirstOpcodeByte,
   reason,canBeCodeEntrypoint:false,bankWriteExecuted:false,
   transferExecuted:false,selectedBankVerified:false,
   staticCandidateOnly:true
  });
 }
 const uniqueLocations=[...new Map(nonDecodable.map(x=>[
  x.bank+':'+x.targetCpu,{bank:x.bank,targetCpu:x.targetCpu,
   fileOffset:x.fileOffset,firstByte:x.firstByte,reason:x.reason}])).values()];
 return {verified:true,source:'MBC3_ROMX_FIRST_OPCODE_AUDIT_V1',
  scenariosAudited:scenarioAtlas.scenarioCount,
  firstOpcodeDecodableCount:valid,
  notDecodableCount:nonDecodable.length,
  notDecodable,reasonCounts:{...reasons},
  distinctNonDecodablePhysicalLocations:uniqueLocations,
  distinctNonDecodablePhysicalLocationCount:uniqueLocations.length,
  bankWriteExecutionsVerified:0,romxTransfersExecuted:0,
  activeBankVerified:false,gameplayEventsVerified:false,
  semantic100PercentCertified:false,
  warning:'A ROMX first opcode is a conditional static possibility only. A nondecodable candidate does not mean the cartridge is corrupt.'};
}
module.exports={auditMbc3RomxEntryOpcodes};
