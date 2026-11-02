'use strict';
// Isolated, read-only guard for manual advice HTTP requests. Never publish
// the result of a request whose live ROM, target or RAM proof has changed.
const {getLiveAdviceContextKey}=require('./aiAdvisor');
const MAX_AGE_MS=15000;
function captureManualAdviceScope(client){
  const state=client?.latestState;
  const sha=client?.activeRomProfile?.hash?.sha256;
  const epoch=client?._videoEvidenceEpoch;
  const generation=client?._targetGeneration;
  const now=Date.now();
  const observed=Date.parse(state?.lastUpdate||'');
  if(typeof sha!=='string'||!sha||
    state?.romRuntimeIdentity?.matched!==true||
    state.romRuntimeIdentity.profileSha256!==sha||
    state.connected!==true||state.isSimulation===true||
    state.memoryReadStatus?.verified!==true||
    state.memoryReadStatus?.publicationPositionWindow?.verified!==true||
    !Number.isSafeInteger(epoch)||epoch<1||
    !Number.isSafeInteger(generation)||generation<0||
    typeof client?.ip!=='string'||!client.ip||
    !Number.isInteger(client?.port)||client.port<1||
    !Number.isFinite(observed)||now<observed||now-observed>=MAX_AGE_MS||
    (state.inBattle===true&&state.battle?.exactTurnMathReady!==true))
    return null;
  const runtime=JSON.stringify([client.ip,client.port,generation,epoch]);
  const snapshot={...state,adviceRuntimeScope:runtime};
  let key;
  try{key=getLiveAdviceContextKey(snapshot);}catch{return null;}
  if(key===null)return null;
  return {snapshot,key,sha,runtime,epoch,generation,ip:client.ip,port:client.port};
}
async function requestGuardedManualAdvice(client,question,provider){
  if(typeof question!=='string'||!question.trim()||
     question.length>2000||typeof provider!=='function')
    return {status:'invalid',reply:'Pedido de aconselhamento inválido.'};
  const start=captureManualAdviceScope(client);
  if(!start)
    return {status:'unverified',reply:'Não existe leitura RAM recente e verificada desta ROM e posição.'};
  let answer;
  try{answer=await provider(question.trim(),start.snapshot);}
  catch{return {status:'unavailable',reply:'Serviço de aconselhamento indisponível.'};}
  const end=captureManualAdviceScope(client);
  if(!end||end.key!==start.key||end.sha!==start.sha||
     end.runtime!==start.runtime)
    return {status:'stale',reply:'O estado da ROM ou da partida mudou; o conselho antigo foi descartado.'};
  if(typeof answer!=='string'||!answer.trim())
    return {status:'unavailable',reply:'Serviço de aconselhamento indisponível.'};
  return {status:'ok',reply:answer};
}
module.exports={captureManualAdviceScope,requestGuardedManualAdvice};
