'use strict';
// Cabeçalhos de treinadores auditados byte a byte nas ROMs:
// Red SHA-256 5ca7..., Blue 2a951..., Green Intl 1.2.1 aafa...
// O 1.º byte da estrutura do treinador codifica o bit (low nibble) e a
// distância de visão (high nibble); o ponteiro word+2 é wEventFlags+byte.
// O atlas só contém mapas cujos cabeçalhos foram ÚNICOS, tinham o número
// exato de objetos treinador e coincidiam com EVENT_BEAT_* de pret/pokered.
const ROM_HASHES=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
]);
const VERIFIED_BY_MAP={
 15:[1010],
 17:[1041,1042,1043,1044,1045,1046],
 21:[1105,1106,1107,1108,1109,1110],
 27:[1217,1218,1219,1220,1221,1222],
 29:[1249,1250,1251],
 51:[1378,1379,1380],
 113:[2297],
 207:[1778,1779,1780,1781],
 208:[1794,1795],
 209:[1810,1811,1812],
 210:[1826,1827,1828,1829],
 213:[1874,1875,1876],
 233:[1890,1891,1892],
 234:[1905,1906],
 245:[2273],
 246:[2281],
 247:[2289]
};
function trainerFlagsForCurrentMap(profile,romMap,eventHex){
 const sha=profile?.hash?.sha256?.toLowerCase();
 const mapId=romMap?.mapId;
 const ids=VERIFIED_BY_MAP[mapId];
 if(!ROM_HASHES.has(sha)||!romMap?.valid||!ids)
  return {verified:false,source:'SEM_CABECALHO_TREINADOR_ROM_CERTIFICADO',entries:[]};
 const trainerObjects=(romMap.objects?.objects||[])
  .map((object,i)=>({object,i})).filter(x=>x.object.kind==='trainer');
 if(trainerObjects.length!==ids.length)return {verified:false,
  source:'NÚMERO_DE_TREINADORES_DIVERGE_DA_ROM',entries:[]};
 if(!Array.isArray(eventHex)||eventHex.length!==320||
   eventHex.some(x=>typeof x!=='string'||!/^[a-fA-F0-9]{2}$/.test(x)))
   return {verified:false,source:'FLAGS_RAM_D747_INCOMPLETAS',entries:[]};
 return {verified:true,mapId,source:'CABECALHOS_ROM_RED_BLUE_GREEN_AUDITADOS+FLAGS_RAM_D747',
   entries:ids.map((bitId,k)=>({
      objectOrdinal:trainerObjects[k].i+1,trainerOrder:k,eventBitIndex:bitId,
      defeated:!!(parseInt(eventHex[bitId>>3],16)&(1<<(bitId&7))),
      source:'ROM_CABEÇALHO + FLAG_RAM'
   }))};
}
module.exports={trainerFlagsForCurrentMap,VERIFIED_BY_MAP};
