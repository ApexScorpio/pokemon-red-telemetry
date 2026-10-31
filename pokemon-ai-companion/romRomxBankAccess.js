'use strict';
// ROMX physical offsets and header-declared mapper hypotheses for 1 MiB ROMs.
// Header fields do not prove real hardware, MBC register contents or execution.
const LENGTH=1048576,BANK=0x4000;
const MBC1_TYPES=new Set([0x01,0x02,0x03]);
const MBC3_TYPES=new Set([0x0f,0x10,0x11,0x12,0x13]);
const MBC5_TYPES=new Set([0x19,0x1a,0x1b,0x1c,0x1d,0x1e]);
function mapperType(type,size){
 if(size!==0x05)return 'UNKNOWN';
 if(MBC1_TYPES.has(type))return 'MBC1';
 if(MBC3_TYPES.has(type))return 'MBC3';
 if(MBC5_TYPES.has(type))return 'MBC5';
 return 'UNKNOWN';
}
function classifyRomxHeaderBankCandidates({rom,targetCpu}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==LENGTH||
    !Number.isInteger(targetCpu)||targetCpu<0x4000||targetCpu>=0x8000)
  return {verified:false,reason:'1 MiB ROM and ROMX CPU address required',
   physicalMappings:[],semantic100PercentCertified:false};
 const cartridgeType=rom[0x147],romSizeCode=rom[0x148],
  ramSizeCode=rom[0x149],mapperFamilyFromHeader=mapperType(cartridgeType,romSizeCode);
 const headerSizeMatchesFile=romSizeCode===0x05;
 const standardMbc1Conditional=mapperFamilyFromHeader==='MBC1';
 const physicalMappings=[];
 // The original inventory always covers physical banks 1..63. MBC5 may
 // additionally map physical bank 0 into ROMX; expose it separately.
 for(let bank=1;bank<LENGTH/BANK;bank++){
  const selectableIfStandardMbc1=standardMbc1Conditional?bank%32!==0:null;
  const selectableIfDeclaredMapper=mapperFamilyFromHeader==='UNKNOWN'?null:
   (mapperFamilyFromHeader==='MBC1'?bank%32!==0:true);
  physicalMappings.push({bank,fileOffset:bank*BANK+targetCpu-0x4000,
   selectableIfStandardMbc1,selectableIfDeclaredMapper});
 }
 const excludedIfStandardMbc1=physicalMappings.filter(
  x=>x.selectableIfStandardMbc1===false).map(x=>x.bank);
 const mbc5BankZeroCandidate=mapperFamilyFromHeader==='MBC5'?
  {bank:0,fileOffset:targetCpu-0x4000,
   origin:'ROM0_BYTES_MAPPED_IN_ROMX_IF_MBC5',
   firstOpcodeDecodable:null,executed:false}:null;
 const declaredMapperRomxCandidateCount=mapperFamilyFromHeader==='UNKNOWN'?
  null:physicalMappings.filter(x=>x.selectableIfDeclaredMapper).length+
   (mbc5BankZeroCandidate?1:0);
 return {verified:true,source:'ROM_HEADER_CONDITIONAL_MAPPER_V2',
  cartridgeType,romSizeCode,ramSizeCode,headerSizeMatchesFile,
  mapperFamilyFromHeader,standardMbc1Conditional,physicalMappings,
  physicalMappingCount:physicalMappings.length,
  excludedIfStandardMbc1,
  conditionalCandidateCount:standardMbc1Conditional?
   physicalMappings.length-excludedIfStandardMbc1.length:null,
  declaredMapperRomxCandidateCount,mbc5BankZeroCandidate,
  controllerIdentityRuntimeVerified:false,activeBankKnown:false,
  runtimeBankRegisterVerified:false,semantic100PercentCertified:false,
  warning:'A header declares MBC1/MBC3/MBC5 only, never proves actual hardware, selected ROMX bank, execution, or game effects.'};
}
module.exports={classifyRomxHeaderBankCandidates};
