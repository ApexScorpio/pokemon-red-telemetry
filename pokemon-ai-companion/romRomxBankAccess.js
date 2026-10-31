'use strict';
// Pure physical-bank inventory conditional on standard MBC1 cartridge header.
// ROM header != live MBC register or proof a target actually runs.
const LENGTH=1048576,BANK=0x4000,MBC1_TYPES=new Set([1,2,3]);
function classifyRomxHeaderBankCandidates({rom,targetCpu}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==LENGTH||
   !Number.isInteger(targetCpu)||targetCpu<0x4000||targetCpu>=0x8000)
  return {verified:false,reason:'1 MiB ROM and ROMX CPU address required',
   physicalMappings:[],semantic100PercentCertified:false};
 const cartridgeType=rom[0x147],romSizeCode=rom[0x148];
 const standardMbc1Conditional=MBC1_TYPES.has(cartridgeType)&&romSizeCode===5;
 const physicalMappings=[];
 for(let bank=1;bank<LENGTH/BANK;bank++)
  physicalMappings.push({bank,fileOffset:bank*BANK+targetCpu-0x4000,
   selectableIfStandardMbc1:standardMbc1Conditional?bank%32!==0:null});
 const excludedIfStandardMbc1=physicalMappings.filter(
  x=>x.selectableIfStandardMbc1===false).map(x=>x.bank);
 return {verified:true,source:'ROM_HEADER_CONDITIONAL_STANDARD_MBC1_V1',
  cartridgeType,romSizeCode,standardMbc1Conditional,
  physicalMappings,physicalMappingCount:physicalMappings.length,
  excludedIfStandardMbc1,
  conditionalCandidateCount:standardMbc1Conditional?
   physicalMappings.length-excludedIfStandardMbc1.length:null,
  controllerIdentityRuntimeVerified:false,activeBankKnown:false,
  semantic100PercentCertified:false,
  warning:'Conditional on standard MBC1; controller, selected bank, code execution and effects remain unknown.'};
}
module.exports={classifyRomxHeaderBankCandidates};
