'use strict';
// WildMonEncounterSlotChances, pret/pokered/data/wild/probabilities.asm:
// 10 pares (limiar inclusivo 0..255, offset dentro dos 20 bytes de slots).
// Pesos derivados dos bytes reais, sem atribuir tabela genérica a ROM alterada.
// A assinatura dos três primeiros pares é conservadora: variantes com outra
// sequência devem ser auditadas e NÃO receber dados presumidos.
const PREFIX=Buffer.from([50,0,101,2,140,4]);
const BANK=0x4000,ROWS=10;
function findGen1EncounterWeights(rom){
  if(!Buffer.isBuffer(rom)||rom.length<BANK||rom.length%BANK!==0)
    return {verified:false,reason:'ROM inválida',weights:null};
  const matches=[];
  for(let at=rom.indexOf(PREFIX);at!==-1;at=rom.indexOf(PREFIX,at+1)){
    if(at+ROWS*2>(Math.floor(at/BANK)+1)*BANK)continue;
    const weights=[],thresholds=[];let previous=-1,valid=true;
    for(let i=0;i<ROWS;i++){
      const limit=rom[at+2*i],off=rom[at+2*i+1];
      if(off!==i*2||limit<=previous){valid=false;break;}
      weights.push(limit-previous);
      thresholds.push(limit);
      previous=limit;
    }
    if(valid&&previous===255&&weights.reduce((a,b)=>a+b,0)===256)
      matches.push({at,weights,thresholds});
  }
  if(matches.length!==1)return {verified:false,
    reason:'Tabela de limiares de encontros ausente/ambígua/não conforme',
    candidates:matches.length,weights:null};
  const chosen=matches[0];
  return {verified:true,offset:chosen.at,bank:Math.floor(chosen.at/BANK),
    weights:chosen.weights,thresholdsInclusive:chosen.thresholds,
    rawHex:rom.subarray(chosen.at,chosen.at+ROWS*2).toString('hex'),
    source:'ROM: WildMonEncounterSlotChances, 10 limiares inclusivos'};
}
module.exports={findGen1EncounterWeights};
