'use strict';
// Read-only, loopback-only snapshot of the live RetroArchClient target.
// A snapshot does not contact RetroArch or prove reachability or ROM identity.
const net=require('node:net');
function isLocalRequester(address){
 if(typeof address!=='string')return false;
 if(address==='::1')return true;
 let ip=address;
 if(ip.startsWith('::ffff:'))ip=ip.slice(7);
 if(net.isIP(ip)!==4)return false;
 const octets=ip.split('.');
 return Number(octets[0])===127;
}
function getRuntimeConnectionSnapshot(client,{startupHost,startupPort}={}){
 if(!client||typeof client.ip!=='string'||!client.ip||
    !Number.isInteger(client.port)||client.port<1||client.port>65535)
  return {verified:false,reason:'NO_VALID_RUNTIME_CLIENT_TARGET',
   readOnly:true,retroArchReachabilityConfirmed:false};
 const state=client.latestState&&typeof client.latestState==='object'?
  client.latestState:{};
 return {
  verified:true,source:'CURRENT_RETROARCH_CLIENT_FIELDS',
  readOnly:true,selectedTargetHost:client.ip,selectedTargetPort:client.port,
  equalsStartupDefaults:client.ip===startupHost&&client.port===startupPort,
  targetSelectionHistoryKnown:false,
  pollingEnabled:client.isPolling===true,
  latestStateConnected:state.connected===true,
  latestRomIdentityMatched:state.romRuntimeIdentity?.matched===true,
  latestStateSimulation:state.isSimulation===true,
  latestUpdateRaw:typeof state.lastUpdate==='string'&&state.lastUpdate?
   state.lastUpdate:null,
  retroArchReachabilityConfirmed:false,
  activeRomSha256Verified:false,mbc3ActiveBankVerified:false,
  noUdpRequestsPerformed:true,requesterRestrictedToLoopback:true,
  note:'Snapshot of active server memory only; it does not prove the target currently responds or which bank is selected.'
 };
}
function buildLocalConnectionResponse({remoteAddress,client,startupHost,startupPort}={}){
 if(!isLocalRequester(remoteAddress))
  return {status:403,body:{verified:false,error:'LOOPBACK_ONLY'}};
 if(!client)return {status:503,body:{verified:false,error:'RUNTIME_CLIENT_UNAVAILABLE'}};
 const report=getRuntimeConnectionSnapshot(client,{startupHost,startupPort});
 if(!report.verified)
  return {status:503,body:report};
 return {status:200,body:report};
}
module.exports={isLocalRequester,getRuntimeConnectionSnapshot,buildLocalConnectionResponse};
