'use strict';
// Exactly the eight read-only Game Boy WRAM/HRAM addresses audited in Bridge 038
// across Red, Blue and Green International. A stable readback is NOT an MBC3
// bank-register observation and NEVER proves this ROM0 instruction executed.
const SOURCE_CPU_ADDRESSES=Object.freeze([
 0xc0ef,0xcf08,0xcf09,0xd0b7,0xd52b,0xff8b,0xffb9,0xffe8
]);
const HEXBYTE=/^[0-9A-F]{2}$/i;
const failure=(status,extra={})=>({verified:false,status,
 stableRamBytes:0,runtimeBankVerified:false,
 selectedBank:null,playerActionConfirmed:false,atomicSnapshotVerified:false,
 ...extra});
function verifyMbc3SourceRamReadback({
 addresses,firstHex,repeatHex,romCrcMatched=false,
 mapRepeated=false,positionRepeated=false,statusRepeated=false
}={}){
 if(!Array.isArray(addresses)||
    addresses.length!==SOURCE_CPU_ADDRESSES.length||
    addresses.some((x,i)=>x!==SOURCE_CPU_ADDRESSES[i]))
  return failure('RAM_SOURCE_ADDRESS_CONTRACT_REJECTED');
 if(romCrcMatched!==true||mapRepeated!==true||
    positionRepeated!==true||statusRepeated!==true)
  return failure('ROM_MAP_POSITION_OR_STATUS_UNCORROBORATED');
 if(!Array.isArray(firstHex)||!Array.isArray(repeatHex)||
    firstHex.length!==addresses.length||
    repeatHex.length!==addresses.length||
    [...firstHex,...repeatHex].some(x=>typeof x!=='string'||!HEXBYTE.test(x)))
  return failure('RAM_SOURCE_BYTES_INVALID');
 const normalizedFirst=firstHex.map(x=>x.toUpperCase());
 const normalizedRepeat=repeatHex.map(x=>x.toUpperCase());
 if(normalizedFirst.some((v,i)=>v!==normalizedRepeat[i])){
  const changed=addresses.filter((a,i)=>normalizedFirst[i]!==normalizedRepeat[i]);
  return failure('RAM_SOURCE_READBACK_CHANGED',
   {changedAddresses:changed,readOnlyBytesRequested:addresses.length*2});
 }
 return {verified:true,status:'MBC3_RAM_SOURCE_REPEAT_CORROBORATED',
  source:'RETROARCH_MBC3_RAM_SOURCE_READ_ONLY_DOUBLE_READ_V1',
  auditedAddressCount:addresses.length,stableRamBytes:addresses.length,
  readOnlyBytesRequested:addresses.length*2,
  samples:addresses.map((addressCpu,i)=>({
   addressCpu,firstHex:normalizedFirst[i],repeatHex:normalizedRepeat[i],
   stable:true,registerWriteExecuted:false,
   selectedRomxBank:null
  })),
  readbackStable:true,romCrcMatched:true,
  mapRepeated:true,positionRepeated:true,statusRepeated:true,
  runtimeBankVerified:false,selectedBank:null,
  playerActionConfirmed:false,atomicSnapshotVerified:false,
  warning:'Repeated RAM samples are not atomic and do not establish any executed ROM0 MBC3 write or selected ROMX bank'};
}
module.exports={SOURCE_CPU_ADDRESSES,verifyMbc3SourceRamReadback};
