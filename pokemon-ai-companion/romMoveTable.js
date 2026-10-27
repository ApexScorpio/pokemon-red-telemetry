'use strict';
// Pesquisa a tabela Moves compilada de Pokemon Gen I no próprio binário.
// Fonte: pret/pokered/data/moves/moves.asm, macro move: 6 bytes
// (animation==id, effect, power, type, accuracyByte, PP).
// Não usa offsets de outras ROMs, nem aceita múltiplas candidatas.
const ROWS=165,WIDTH=6,BANK_SIZE=0x4000;
function findGen1MoveTable(rom) {
  if(!Buffer.isBuffer(rom)||rom.length<BANK_SIZE||rom.length%BANK_SIZE!==0)
    return {valid:false,reason:'ROM inválida ou sem bancos completos',rows:null,offset:null};
  const candidates=[];
  for(let bank=0;bank<rom.length/BANK_SIZE;bank++){
    const start=bank*BANK_SIZE,end=start+BANK_SIZE-ROWS*WIDTH;
    for(let pos=start;pos<=end;pos++){
      if(rom[pos]!==1||rom[pos+6]!==2||rom[pos+12]!==3)continue;
      let valid=true;
      const rows=[];
      for(let i=0;i<ROWS;i++){
        const j=pos+i*WIDTH, id=rom[j],effectByte=rom[j+1],
          powerByte=rom[j+2],typeByte=rom[j+3],
          accuracyByte=rom[j+4],basePp=rom[j+5];
        if(id!==i+1||basePp<1||basePp>40){valid=false;break;}
        rows.push({id,effectByte,powerByte,typeByte,accuracyByte,basePp,
          romFileOffset:j,romBank:bank});
      }
      if(valid)candidates.push({offset:pos,bank,rows});
    }
  }
  if(candidates.length!==1)
    return {valid:false,reason:'Tabela Moves não encontrada de forma única',
      candidates:candidates.length,offset:null,rows:null};
  const chosen=candidates[0];
  return {valid:true,offset:chosen.offset,bank:chosen.bank,rows:chosen.rows,
    fieldsVerifiedFromRom:['id','effectByte','powerByte','typeByte','accuracyByte','basePp'],
    source:'ROM local verificada: 165 entradas x 6 bytes, IDs sequenciais'};
}
module.exports={findGen1MoveTable};
