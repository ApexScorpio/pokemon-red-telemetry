'use strict';
// Pure physical-bank inventory conditional on standard MBC1 cartridge header.
// ROM header != live MBC register or proof a target actually runs.
const LENGTH=1048576,BANK=0x4000,MBC1_TYPES=new Set([1,2,3]);
const HEADER_FAMILIES=Object.freeze({
  0:'ROM_ONLY',1:'MBC1',2:'MBC1',3:'MBC1',
  5:'MBC2',6:'MBC2',
  15:'MBC3',16:'MBC3',17:'MBC3',18:'MBC3',19:'MBC3',
  25:'MBC5',26:'MBC5',27:'MBC5',28:'MBC5',29:'MBC5',30:'MBC5'
});
const hexCode=value=>'0x'+value.toString(16).toUpperCase().padStart(2,'0');
function classifyRomxHeaderBankCandidates({rom,targetCpu}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==LENGTH||
   !Number.isInteger(targetCpu)||targetCpu<0x4000||targetCpu>=0x8000)
  return {verified:false,reason:'1 MiB ROM and ROMX CPU address required',
   physicalMappings:[],semantic100PercentCertified:false};
 const cartridgeType=rom[0x147],romSizeCode=rom[0x148];
 const controllerFamilyByHeader=HEADER_FAMILIES[cartridgeType]||'OTHER_OR_UNKNOWN';
 const romSizeHeaderMatchesFile=romSizeCode===5;
 const standardMbc1Conditional=MBC1_TYPES.has(cartridgeType)&&romSizeHeaderMatchesFile;
 const mbc1ConditionalReason=!MBC1_TYPES.has(cartridgeType)
  ? 'HEADER_TYPE_NOT_STANDARD_MBC1'
  : !romSizeHeaderMatchesFile
   ? 'HEADER_SIZE_CODE_NOT_1MIB'
   : 'HEADER_STANDARD_MBC1_1MIB_ONLY';
 const physicalMappings=[];
 for(let bank=1;bank<LENGTH/BANK;bank++)
  physicalMappings.push({bank,fileOffset:bank*BANK+targetCpu-0x4000,
   selectableIfStandardMbc1:standardMbc1Conditional?bank%32!==0:null});
 const excludedIfStandardMbc1=physicalMappings.filter(
  x=>x.selectableIfStandardMbc1===false).map(x=>x.bank);
 return {verified:true,source:'ROM_HEADER_CONDITIONAL_STANDARD_MBC1_V1',
  cartridgeType,romSizeCode,
  cartridgeTypeHex:hexCode(cartridgeType),romSizeCodeHex:hexCode(romSizeCode),
  controllerFamilyByHeader,romSizeHeaderMatchesFile,mbc1ConditionalReason,
  standardMbc1Conditional,
  physicalMappings,physicalMappingCount:physicalMappings.length,
  excludedIfStandardMbc1,
  conditionalCandidateCount:standardMbc1Conditional?
   physicalMappings.length-excludedIfStandardMbc1.length:null,
  controllerIdentityRuntimeVerified:false,activeBankKnown:false,
  semantic100PercentCertified:false,
  warning:'Conditional on standard MBC1; controller, selected bank, code execution and effects remain unknown.'};
}
module.exports={classifyRomxHeaderBankCandidates};
