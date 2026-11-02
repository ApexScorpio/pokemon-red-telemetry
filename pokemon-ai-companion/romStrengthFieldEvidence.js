'use strict';
// pret/pokered: wStatusFlags1=$D728, BIT_STRENGTH_ACTIVE=bit 0.
// Already included in the contiguous D5A0-D8AF RAM read (offset 0x188).
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const START=0xD5A0,FLAG=0xD728,OFFSET=FLAG-START,LENGTH=784;
function readStrengthFieldEvidence({worldBlockHex,romSha256,
 romIdentityMatched=false,mapWindowVerified=false,
 positionWindowVerified=false}={}){
 const sha=String(romSha256||'').toLowerCase();
 const fail=reason=>({verified:false,activeAtSample:null,
   reason,romSha256:sha||null,address:'D728',bit:0,
   snapshotAtomicVerified:false,pushObserved:false});
 if(!isKnownAuditedRomSha(sha)||!romIdentityMatched||
    !mapWindowVerified||!positionWindowVerified)
   return fail('Identidade ROM ou janelas RAM de mapa/posição por confirmar');
 if(!Array.isArray(worldBlockHex)||worldBlockHex.length!==LENGTH)
   return fail('Bloco RAM D5A0-D8AF incompleto');
 const hex=worldBlockHex[OFFSET];
 if(typeof hex!=='string'||!/^[0-9a-f]{2}$/i.test(hex))
   return fail('Byte D728 inválido ou não lido');
 return {verified:true,romSha256:sha,address:'D728',bit:0,
   activeAtSample:(parseInt(hex,16)&1)!==0,
   rawByteHex:hex.toUpperCase(),snapshotAtomicVerified:false,
   pushObserved:false,source:'READ_CORE_MEMORY_D5A0_OFFSET_0x188',
   reason:'Bit de Strength observado; leitura global sequencial, não atómica.'};
}
module.exports={readStrengthFieldEvidence,START,FLAG,OFFSET,LENGTH};
