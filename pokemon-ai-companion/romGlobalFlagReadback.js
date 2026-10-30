'use strict';
// Cross-check two read-only RetroArch RAM reads for the world flag domains.
// First: D5A0..D8AF (784 bytes); second: D6F0..D886 (407 bytes).
// This establishes repeat consistency, NOT an atomic memory snapshot,
// completed trainer victories, captured Pokemon or executed scripts.
const HEX=/^[0-9a-f]{2}$/i;
const checked=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(x=>
 typeof x==='string'&&HEX.test(x));
const fail=(reason,domain=null)=>({verified:false,reason,domain,
 readbackBytesMatched:0,romAndMapCorroborated:false,
 snapshotAtomicVerified:false,playerActionConfirmed:false});
function verifyGlobalFlagReadback({
 firstWorldBlockHex,repeatFlagWindowHex,repeatMapHex,
 expectedMapId,romIdentityMatched=false,
 mapWindowVerified=false,positionWindowVerified=false
}={}){
 if(romIdentityMatched!==true||mapWindowVerified!==true||
    positionWindowVerified!==true)
  return fail('Identidade ROM, mapa ou coordenadas sem corroboracao');
 if(!Number.isInteger(expectedMapId)||expectedMapId<0||expectedMapId>247||
    !checked(repeatMapHex,1)||
    parseInt(repeatMapHex[0],16)!==expectedMapId)
  return fail('Mapa alterado depois da segunda leitura de flags','MAP');
 if(!checked(firstWorldBlockHex,784)||!checked(repeatFlagWindowHex,407))
  return fail('Bloco RAM de flags incompleto, malformado ou sem segunda leitura','RAM');
 const domains=[
  {name:'HIDDEN_ITEMS',first:336,second:0,length:14},
  {name:'HIDDEN_COINS',first:350,second:14,length:2},
  {name:'WORLD_EVENTS',first:423,second:87,length:320}
 ];
 for(const {name,first,second,length} of domains){
  for(let i=0;i<length;i++)
   if(firstWorldBlockHex[first+i].toUpperCase()!==
      repeatFlagWindowHex[second+i].toUpperCase())
    return fail('Flags RAM alteradas entre leituras; recusar estado mundial',name);
 }
 return {verified:true,reason:null,domain:null,readbackBytesMatched:336,
  romAndMapCorroborated:true,
  hiddenItemBytesMatched:14,hiddenCoinBytesMatched:2,
  worldEventBytesMatched:320,
  snapshotAtomicVerified:false,playerActionConfirmed:false,
  source:'RETROARCH_READ_CORE_MEMORY_D5A0_THEN_D6F0_READBACK',
  warning:'Duas leituras iguais nao provam snapshot atomico, causalidade, vitoria, captura nem efeitos de scripts'};
}
module.exports={verifyGlobalFlagReadback};
