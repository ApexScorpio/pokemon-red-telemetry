'use strict';
// Physical ROMX entrypoint inspection across independently known MBC3 bank
// candidates. Cross-product scenarios are NOT executions or causal mappings.
const ROM_BYTES=1048576,BANK_SIZE=0x4000;
const fail=reason=>({verified:false,reason,
 transferSites:0,scenarioCount:0,scenarios:[],
 sameStaticWitnessPairs:0,executedTransfers:0,activeBanksVerified:0});
function buildMbc3RomxPhysicalScenarios({rom,transferSites,conditionalBanks}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_BYTES||
    ![0x0f,0x10,0x11,0x12,0x13].includes(rom[0x147])||
    rom[0x148]!==0x05||
    !Array.isArray(transferSites)||transferSites.length>256||
    conditionalBanks?.verified!==true||
    !Array.isArray(conditionalBanks.candidates)||
    !Number.isInteger(conditionalBanks.candidateByteSites)||
    conditionalBanks.candidateByteSites!==conditionalBanks.candidates.length||
    conditionalBanks.activeBankVerified!==false||
    conditionalBanks.executedBankWrites!==0)
  return fail('Require 1 MiB declared MBC3 ROM and bounded static bank inventory');
 const scenarios=[],sameWitnessPairs=[];
 for(const transfer of transferSites){
  if(!Number.isInteger(transfer?.fromRom0Cpu)||
     transfer.fromRom0Cpu<0||transfer.fromRom0Cpu>=0x4000||
     !Number.isInteger(transfer?.targetCpu)||
     transfer.targetCpu<0x4000||transfer.targetCpu>=0x8000||
     transfer.mapperFamilyFromHeader!=='MBC3'||
     transfer.transferExecuted!==false||
     transfer.activeBankKnown!==false||
     !Array.isArray(transfer.physicalMappings)||
     !Array.isArray(transfer.witnessPath)||
     transfer.witnessPath.at(-1)?.pc!==transfer.fromRom0Cpu)
   return fail('Invalid ROM0 to ROMX transfer witness or mapper evidence');
  const pathPcs=transfer.witnessPath.map(x=>x.pc);
  const before=pathPcs.slice(0,-1);
  for(const candidate of conditionalBanks.candidates){
   if(!Number.isInteger(candidate?.rom0WritePc)||
      candidate.rom0WritePc<0||candidate.rom0WritePc>=0x4000||
      !Number.isInteger(candidate.selectedBankIfExecuted)||
      candidate.selectedBankIfExecuted<1||
      candidate.selectedBankIfExecuted>127||
      candidate.executed!==false||
      candidate.activeBankKnown!==false||
      candidate.romxTransferLinked!==false)
    return fail('Invalid unexecuted conditional bank source');
   // Outside-file candidates have no physical bytes in this 1 MiB ROM.
   if(candidate.bankPresentInOneMiBRom!==true)continue;
   const bank=candidate.selectedBankIfExecuted;
   if(bank>63)return fail('Candidate is incorrectly marked physically present');
   const offset=bank*BANK_SIZE+transfer.targetCpu-0x4000;
   const mapped=transfer.physicalMappings.find(x=>x.bank===bank);
   if(!mapped||mapped.fileOffset!==offset||
      offset<0x4000||offset>=rom.length)
    return fail('Physical offset contradicts existing ROMX mapping evidence');
   const sameWitness=before.includes(candidate.rom0WritePc);
   const row={
    rom0TransferPc:transfer.fromRom0Cpu,
    romxTargetCpu:transfer.targetCpu,
    transferKind:transfer.transferKind,
    candidateWritePc:candidate.rom0WritePc,
    candidateBankIfExecuted:bank,
    physicalFileOffset:offset,
    physicalFirstOpcodeByte:rom[offset],
    physicalFirstOpcodeDecodable:mapped.firstOpcodeDecodable===true,
    sameStaticWitnessIncludesWrite:sameWitness,
    staticWitnessDoesNotProveExecution:true,
    bankWriteExecuted:false,transferExecuted:false,
    activeBankVerified:false,causalLinkVerified:false
   };
   scenarios.push(row);
   if(sameWitness)sameWitnessPairs.push({
    rom0TransferPc:transfer.fromRom0Cpu,
    candidateWritePc:candidate.rom0WritePc,bank});
  }
 }
 const distinctOffsets=[...new Set(scenarios.map(s=>s.physicalFileOffset))]
  .sort((a,b)=>a-b);
 return {verified:true,source:'ROMX_MBC3_BANK_STATIC_CROSS_PRODUCT_V1',
  transferSites:transferSites.length,
  candidateBankWriteSites:conditionalBanks.candidateByteSites,
  scenarioCount:scenarios.length,scenarios,
  sameStaticWitnessPairs:sameWitnessPairs.length,
  sameStaticWitnessEvidence:sameWitnessPairs,
  distinctPhysicalOffsets:distinctOffsets,
  distinctPhysicalOffsetCount:distinctOffsets.length,
  firstOpcodeDecodableScenarios:scenarios.filter(x=>
   x.physicalFirstOpcodeDecodable).length,
  executedTransfers:0,activeBanksVerified:0,causalLinksVerified:0,
  semantic100PercentCertified:false,
  warning:'Cross-product of static bank candidates and ROMX targets; no proof that bank write precedes transfer during execution.'};
}
module.exports={buildMbc3RomxPhysicalScenarios};
