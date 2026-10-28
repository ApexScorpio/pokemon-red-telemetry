'use strict';
// Two coherent map+coordinate readings are required before issuing location
// and movement recommendations. Two sequential UDP observations do NOT prove
// an atomic emulator frame or the absence of movement between samples.
const hexByte=x=>typeof x==='string'&&/^[a-f\d]{2}$/i.test(x)?parseInt(x,16):null;
const fail=(reason,values={})=>({verified:false,reason,atomicSnapshotVerified:false,
  mapAndCoordinatesCorroborated:false,...values});
function verifyMapPositionWindow({firstMapByte,firstYByte,firstXByte,
  secondMapAndLastMapBytes}={}){
 const bytes=secondMapAndLastMapBytes;
 if(!Array.isArray(bytes)||bytes.length!==8)
  return fail('RELEITURA_D35E_D365_INCOMPLETA');
 const parsed=bytes.map(hexByte);
 const firstMap=hexByte(firstMapByte),firstY=hexByte(firstYByte),firstX=hexByte(firstXByte);
 if(firstMap===null||firstY===null||firstX===null||parsed.some(n=>n===null))
  return fail('RAM_MAPA_OU_COORDENADAS_INVALIDAS');
 const [secondMap,,,secondY,secondX]=parsed;
 if(firstMap>=248||secondMap>=248)
  return fail('ID_MAPA_FORA_DE_0_247',{firstMap,secondMap});
 if(firstMap!==secondMap)
  return fail('MAPA_MUDOU_DURANTE_LEITURA',{firstMap,secondMap});
 if(firstY!==secondY||firstX!==secondX)
  return fail('POSICAO_MUDOU_DURANTE_LEITURA',{
    firstPosition:{x:firstX,y:firstY},secondPosition:{x:secondX,y:secondY},mapId:firstMap});
 return {verified:true,reason:null,atomicSnapshotVerified:false,
  mapAndCoordinatesCorroborated:true,mapId:firstMap,
  x:firstX,y:firstY,lastMapId:parsed[7],
  source:'RAM_D35E_D361_D362_TWO_SEQUENTIAL_OBSERVATIONS',
  warning:'Leituras iguais não provam simultaneidade nem estado atual do frame seguinte'};
}
module.exports={verifyMapPositionWindow};
