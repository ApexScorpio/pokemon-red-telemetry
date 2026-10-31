'use strict';
// Conditional MBC3 bank numbering for static A-byte provenance ONLY.
// A candidate bank is not an observed bank, executed write, or ROMX transfer.
const BANK_SIZE=0x4000,ROM_BYTES=1048576,FILE_BANKS=ROM_BYTES/BANK_SIZE;
const invalid=reason=>({verified:false,reason,candidates:[],
 candidateByteSites:0,unknownByteSites:0,activeBankVerified:false,
 executedBankWrites:0,semantic100PercentCertified:false});
function classifyMbc3ConditionalBanks({plan}={}){
 if(!plan||plan.verified!==true||!Array.isArray(plan.sites)||
    !Number.isInteger(plan.siteCount)||plan.siteCount!==plan.sites.length||
    plan.sites.length>512||plan.runtimeBankVerified!==false)
  return invalid('Expected bounded static MBC3 source plan');
 const candidates=[],missing=[],seen=new Set();
 for(const site of plan.sites){
  const pc=site?.writePc,value=site?.conditionalByte;
  if(!Number.isInteger(pc)||pc<0||pc>=0x4000||seen.has(pc)||
     site.executed!==false||site.bankActiveVerified!==false)
   return invalid('Invalid site, duplicate PC, or invented execution');
  seen.add(pc);
  if(value===null||value===undefined){missing.push(pc);continue;}
  if(!Number.isInteger(value)||value<0||value>255)
   return invalid('Conditional byte must be uint8');
  const raw=value&0x7f,bank=raw===0?1:raw;
  const inFile=bank>=1&&bank<FILE_BANKS;
  candidates.push({rom0WritePc:pc,conditionalSourceByte:value,
   selectedBankIfExecuted:bank,mcb3SevenBitBank:raw,
   zeroAliasToBankOne:raw===0,highBitIgnored:(value&0x80)!==0,
   bankPresentInOneMiBRom:inFile,
   physicalBankStartOffset:inFile?bank*BANK_SIZE:null,
   physicalBankEndExclusive:inFile?(bank+1)*BANK_SIZE:null,
   executed:false,activeBankKnown:false,romxTransferLinked:false,
   runtimeByteVerified:false});
 }
 const inFile=candidates.filter(x=>x.bankPresentInOneMiBRom);
 return {verified:true,source:'MBC3_CONDITIONAL_BANK_CANDIDATES_V1',
  physicalBanksInFile:FILE_BANKS,candidates,
  candidateByteSites:candidates.length,unknownByteSites:missing.length,
  missingSourceWritePcs:missing,
  inPhysicalFileSites:inFile.length,
  outsidePhysicalFileSites:candidates.length-inFile.length,
  zeroAliasSites:candidates.filter(x=>x.zeroAliasToBankOne).length,
  highBitIgnoredSites:candidates.filter(x=>x.highBitIgnored).length,
  distinctConditionalBanksInFile:[...new Set(inFile.map(x=>
   x.selectedBankIfExecuted))].sort((a,b)=>a-b),
  executedBankWrites:0,activeBankVerified:false,
  linkedRomxTransferSites:0,semantic100PercentCertified:false,
  warning:'Values describe bank IF the instruction executes. No causal link from these sources to ROMX transfer sites is established.'};
}
module.exports={classifyMbc3ConditionalBanks};
