'use strict';
// Exact Gen I ROM text table address classification, never script outcome.
const BANK=0x4000;
const validByte=x=>Number.isInteger(x)&&x>=0&&x<=255;
const cpuToFile=(rom,bank,cpu)=>{
 if(!Buffer.isBuffer(rom)||!Number.isInteger(cpu))return null;
 if(cpu>0&&cpu<BANK)return cpu;
 const offset=bank*BANK+cpu-BANK;
 return Number.isInteger(bank)&&bank>0&&bank<rom.length/BANK&&
   cpu>=BANK&&cpu<2*BANK&&offset<rom.length?offset:null;
};
const fail=reason=>({verified:false,reason,textOutcomeVerified:false,
  dialogueExecuted:false});
const labels={0x17:'TX_FAR',0x08:'TX_START_ASM',0xff:'SCRIPT_POKECENTER_NURSE',
  0xfe:'SCRIPT_MART',0xf5:'SCRIPT_VENDING_MACHINE',
  0xf6:'SCRIPT_CABLE_CLUB_RECEPTIONIST',0xf7:'SCRIPT_PRIZE_VENDOR'};
function resolveStaticTextPointer({rom,mapBank,textPointerCpu,textId}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    !Number.isInteger(mapBank)||mapBank<1||mapBank>=rom.length/BANK||
    !Number.isInteger(textId)||textId<1||textId>63)
   return fail('ROM, banco ou índice Text ID sem prova');
 const table=cpuToFile(rom,mapBank,textPointerCpu),end=(mapBank+1)*BANK;
 if(table===null||table<BANK||table+textId*2>end)
   return fail('Tabela Text ID de mapa inválida ou fora de banco');
 const raw=rom.readUInt16LE(table+2*(textId-1));
 const at=cpuToFile(rom,mapBank,raw);
 if(at===null||at>=end)
   return fail('Destino de texto não corroborado em ROM0 ou ROMX');
 const firstByte=rom[at],command=labels[firstByte]||'TEXT_OPCODE_UNCLASSIFIED';
 const far={verified:false};
 if(firstByte===0x17){
   if(at+4>(at<BANK?BANK:end))return fail('TX_FAR truncado');
   const farCpu=rom.readUInt16LE(at+1),farBank=rom[at+3];
   const target=cpuToFile(rom,farBank,farCpu);
   if(target===null||rom[target]!==0x00)
     return fail('Segundo destino TX_FAR não corroborado');
   Object.assign(far,{verified:true,cpu:farCpu,bank:farBank,
     fileOffset:target,startsWithTxStart:true});
 }
 return {verified:true,romBank:at<BANK?0:mapBank,
   textPointerCpu:raw,textFileOffset:at,firstByte,
   command,far:far.verified?far:null,
   textOutcomeVerified:false,dialogueExecuted:false,
   source:'ROM_STATIC_TEXT_POINTER_ONLY'};
}
module.exports={resolveStaticTextPointer,cpuToFile};
