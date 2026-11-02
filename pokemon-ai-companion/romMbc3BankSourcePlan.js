'use strict';
// Static observation requirements for ROM0 MBC3 bank-selection A sources.
// Never reads emulator memory or claims any action/bank was executed.
const REGION=[
 [0x0000,0x3fff,'ROM0'],[0x4000,0x7fff,'ROMX'],
 [0x8000,0x9fff,'VRAM'],[0xa000,0xbfff,'CART_RAM_OR_RTC'],
 [0xc000,0xdfff,'WRAM'],[0xe000,0xfdff,'ECHO'],
 [0xfe00,0xfe9f,'OAM'],[0xfea0,0xfeff,'UNUSABLE'],
 [0xff00,0xff7f,'IO'],[0xff80,0xfffe,'HRAM'],
 [0xffff,0xffff,'IE']
];
function addressDomain(address){
 if(!Number.isInteger(address)||address<0||address>0xffff)return null;
 const r=REGION.find(([start,end])=>address>=start&&address<=end);
 return {address,domain:r[2],futureReadOnlyRamCandidate:['WRAM','HRAM'].includes(r[2])};
}
function planMbc3BankInputs({directWriteSites}={}){
 if(!Array.isArray(directWriteSites)||directWriteSites.length>512)
  return {verified:false,reason:'Invalid bounded site list'};
 const sites=[],kinds=Object.create(null),reads=new Set();
 for(const s of directWriteSites){
  if(s?.opcode!==0xea||!Number.isInteger(s.rom0Pc)||
     s.rom0Pc<0||s.rom0Pc>=0x4000||
     s.literalTargets?.some(t=>t.registerKind==='ROM_BANK_NUMBER')!==true||
     s.aSourceProvenance?.verified!==true||
     s.aSourceProvenance.writePc!==s.rom0Pc)
   return {verified:false,reason:'Site lacks literal bank write or source proof'};
  const p=s.aSourceProvenance,kind=p.sourceKind;
  const allowed=['IMMEDIATE_A','ZEROING_A','REGISTER_OR_HL_READ',
   'MEMORY_READ','STACK_POP_AF','UNRESOLVED'];
  if(!allowed.includes(kind))return {verified:false,reason:'Unknown source kind'};
  kinds[kind]=(kinds[kind]||0)+1;
  const address=kind==='MEMORY_READ'?addressDomain(p.sourceAddressCpu):null;
  if(address?.futureReadOnlyRamCandidate)reads.add(address.address);
  sites.push({writePc:s.rom0Pc,sourcePc:p.sourcePc,kind,
   sourceRegister:p.sourceRegister??null,
   conditionalByte:['IMMEDIATE_A','ZEROING_A'].includes(kind)?
    p.conditionalByte:s.registerInputProvenance?.verified===true?
    s.registerInputProvenance.conditionalByte:null,
   sourceCpuAddress:address?.address??null,
   sourceDomain:address?.domain??null,
   memoryPointerUnknown:kind==='MEMORY_READ'&&address===null,
   readbackPerformed:false,executed:false,bankActiveVerified:false});
 }
 const uniqueRamAddresses=[...reads].sort((a,b)=>a-b);
 return {verified:true,source:'MBC3_ROM0_SOURCE_OBSERVATION_PLAN_V1',
  sites,kinds:{...kinds},siteCount:sites.length,
  uniqueRamAddresses,uniqueRamAddressCount:uniqueRamAddresses.length,
  runtimeReadCount:0,runtimeBankVerified:false,
  warning:'Static path and conditional byte only. Requires separate repeated read-only live state proof.'};
}
module.exports={addressDomain,planMbc3BankInputs};
