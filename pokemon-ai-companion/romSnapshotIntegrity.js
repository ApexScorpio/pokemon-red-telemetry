'use strict';
// Cada ciclo lê diversos blocos de RAM em sequência, enquanto o Game Boy avança.
// Validar o mapa ANTES/DEPOIS evita atribuir eventos de uma zona à zona anterior.
// Um mapa igual nos dois extremos não prova atomicidade dos estados internos.
function verifyMapSnapshot(firstMapHex, finalMapBytes) {
 if(typeof firstMapHex!=='string'||!/^[a-f0-9]{2}$/i.test(firstMapHex)||
    !Array.isArray(finalMapBytes)||finalMapBytes.length!==1||
    typeof finalMapBytes[0]!=='string'||!/^[a-f0-9]{2}$/i.test(finalMapBytes[0]))
   return {verified:false, reason:'MAPA_RAM_RELEITURA_INCOMPLETA',
     initialMapId:null, finalMapId:null};
 const first=parseInt(firstMapHex,16),last=parseInt(finalMapBytes[0],16);
 if(first>=248||last>=248)
   return {verified:false,reason:'MAPA_GEN1_DESCONHECIDO',
     initialMapId:first,finalMapId:last};
 if(first!==last)
   return {verified:false,reason:'MUDANÇA_DE_MAPA_DURANTE_A_LEITURA_RAM',
     initialMapId:first,finalMapId:last};
 return {verified:true,reason:null,initialMapId:first,finalMapId:last,
   source:'RAM_D35E_LIDA_NO_INÍCIO_E_NO_FIM_DA_AMOSTRA',
   limitations:'Mapa idêntico não certifica leitura atómica de todos os outros bytes.'};
}
module.exports={verifyMapSnapshot};
