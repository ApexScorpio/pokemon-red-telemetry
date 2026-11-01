'use strict';

// Manual, loopback-only FFB8 diagnostic.
// This wrapper NEVER interprets a byte as an executed ROM bank write.
const {isLocalRequester}=require('./romRuntimeConnectionSnapshot');
const {probeReadOnlyRetroArch,privateIpv4}=
 require('./romReadOnlyRetroArchProbe');

const ORIGINS=new Set([
 'http://127.0.0.1:3001',
 'http://localhost:3001',
 'http://[::1]:3001'
]);

const reject=(status,error)=>({
 status,
 body:{
  verified:false,error,readOnly:true,
  selectedBank:null,activeRomSha256Verified:false,
  snapshotAtomicVerified:false,
  gameplayEventObserved:false,
  playerActionConfirmed:false
 }
});

async function buildManualFfb8Response({
 remoteAddress,method,headers={},client,
 probe=probeReadOnlyRetroArch
}={}){
 if(!isLocalRequester(remoteAddress))
  return reject(403,'LOOPBACK_ONLY');

 if(method!=='GET')
  return reject(405,'GET_ONLY');

 if(headers['x-pokeguide-ffb8-opt-in']!=='READ_ONLY_FFB8')
  return reject(403,'EXPLICIT_DIAGNOSTIC_OPT_IN_REQUIRED');

 if(headers.origin&&!ORIGINS.has(headers.origin))
  return reject(403,'CROSS_ORIGIN_REJECTED');

 if(!client||!privateIpv4(client.ip)||
    !Number.isInteger(client.port)||client.port<1||
    client.port>65535)
  return reject(503,'RUNTIME_TARGET_UNAVAILABLE');

 const state=client.latestState;

 if(state?.connected!==true||
    state?.isSimulation===true||
    state?.romRuntimeIdentity?.matched!==true)
  return reject(409,'VERIFIED_LIVE_ROM_CONTEXT_REQUIRED');

 let result;

 try{
  result=await probe({
   host:client.ip,
   port:client.port,
   mbc3SourceReadback:false,
   ffb8Readback:true
  });
 }catch{
  return reject(502,'READ_ONLY_PROBE_ERROR');
 }

 const evidence=result?.ffb8SourceEvidence;

 if(result?.verified!==true||
    result.ffb8ReadbackVerified!==true||
    result.romProfileCRC32Matched!==true||
    result.activeRomSha256Verified!==false||
    result.snapshotAtomicVerified!==false||
    result.playerActionConfirmed!==false||
    result.gameEffectsCertified!==false||
    result.mbc3ActiveBankVerified!==false||
    evidence?.verified!==true||
    evidence.addressCpu!==0xffb8||
    evidence.repeatedStable!==true||
    evidence.bankRegisterWriteObserved!==false||
    evidence.gameplayEventObserved!==false||
    evidence.selectedBank!==null||
    typeof evidence.firstHex!=='string'||
    !/^[0-9A-F]{2}$/.test(evidence.firstHex)||
    evidence.firstHex!==evidence.repeatHex)
  return reject(502,'FFB8_READBACK_UNVERIFIED');

 return {
  status:200,
  body:{
   verified:true,
   status:'FFB8_STABLE_RAM_BYTE_ONLY',
   addressCpu:0xffb8,
   firstHex:evidence.firstHex,
   repeatHex:evidence.repeatHex,
   mapId:result.mapId,
   romVariantFromCRC:result.variant,
   readOnly:true,
   source:'EXPLICIT_LOOPBACK_READ_ONLY_PROBE',
   selectedBank:null,
   activeRomSha256Verified:false,
   bankRegisterWriteObserved:false,
   snapshotAtomicVerified:false,
   gameplayEventObserved:false,
   playerActionConfirmed:false,
   note:'Byte RAM estável em duas leituras. Não prova banco ativo, execução de script, identidade SHA256 ou conclusão de evento.'
  }
 };
}

module.exports={buildManualFfb8Response};