'use strict';
// TypeEffects Gen I: pares (tipo atacante, defensor, multiplicador/10),
// terminados por FF. A assinatura inicial foi confirmada nas três ROMs reais;
// as ROMs alteradas com estrutura incompatível são recusadas.
// Fonte: pret/pokered/data/types/type_matchups.asm.
const BANK_SIZE=0x4000;
const INITIAL=Buffer.from([
  0x15,0x14,20, 0x14,0x16,20, 0x14,0x19,20,
  0x16,0x15,20, 0x17,0x15,20, 0x15,0x05,20,
  0x04,0x02,0
]);
const TYPES=new Set([0,1,2,3,4,5,7,8,20,21,22,23,24,25,26]);
function findGen1TypeMatchups(rom) {
  if(!Buffer.isBuffer(rom)||rom.length<BANK_SIZE||rom.length%BANK_SIZE!==0)
    return {verified:false,reason:'ROM sem bancos válidos',orderedTypeRulesFromRom:null};
  const candidates=[];
  for(let offset=rom.indexOf(INITIAL);offset!==-1;offset=rom.indexOf(INITIAL,offset+1)){
    const bank=Math.floor(offset/BANK_SIZE),end=(bank+1)*BANK_SIZE;
    let position=offset,records=[],pairs=new Set(),valid=true,terminated=false;
    while(position+3<=end && records.length<=82){
      if(rom[position]===0xff){terminated=true;break;}
      const attacker=rom[position],defender=rom[position+1],multiplier=rom[position+2];
      const key=attacker+':'+defender;
      if(!TYPES.has(attacker)||!TYPES.has(defender)||
         ![0,5,20].includes(multiplier)||pairs.has(key)){valid=false;break;}
      records.push({attackType:attacker,defenderType:defender,multiplier,
        romFileOffset:position});pairs.add(key);position+=3;
    }
    // As três ROMs auditadas contêm exatamente 82 registos.
    if(valid&&terminated&&records.length===82) candidates.push({offset,bank,records});
  }
  if(candidates.length!==1) return {verified:false,
    reason:'Tabela TypeEffects ausente, incompatível ou ambígua',
    candidates:candidates.length,orderedTypeRulesFromRom:null};
  const found=candidates[0];
  return {verified:true,source:'ROM: TypeEffects (82 triplos e terminador FF)',
    bank:found.bank,offset:found.offset,recordCount:found.records.length,
    orderedTypeRulesFromRom:found.records};
}
module.exports={findGen1TypeMatchups};
