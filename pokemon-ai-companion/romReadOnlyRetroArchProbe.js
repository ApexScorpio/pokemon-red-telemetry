'use strict';
// Direct, read-only RetroArch Network Control Interface (NCI) probe.
// Allowed UDP commands: GET_STATUS and READ_CORE_MEMORY. Never send
// input, pause, reset, save/load state, write RAM or close the game.
// Source: https://docs.libretro.com/development/retroarch/network-control-interface/
const dgram=require('node:dgram');
const net=require('node:net');
const {verifyGlobalFlagReadback}=require('./romGlobalFlagReadback');

const AUDITED_CRC=Object.freeze({
 '9F7FDD53':'red',
 'D6DA8A1A':'blue',
 '3C2DD8AE':'green-international'
});
const fail=(status,extra={})=>({verified:false,status,
 playerActionConfirmed:false,snapshotAtomicVerified:false,
 gameEffectsCertified:false,...extra});
function privateIpv4(host){
 if(net.isIP(host)!==4)return false;
 const a=host.split('.').map(Number);
 return a[0]===10||a[0]===127||
  (a[0]===172&&a[1]>=16&&a[1]<=31)||
  (a[0]===192&&a[1]===168);
}
function parseStatus(response){
 if(typeof response!=='string')return null;
 if(/^GET_STATUS\s+CONTENTLESS\b/i.test(response))
  return {contentLoaded:false};
 const m=/^GET_STATUS\s+(PLAYING|PAUSED)\s+.*?crc32=([0-9a-f]{8})\b/i.exec(response);
 if(!m)return null;
 return {contentLoaded:true,mode:m[1].toUpperCase(),
  crc32:m[2].toUpperCase(),variant:AUDITED_CRC[m[2].toUpperCase()]||null};
}
function parseMemory(response,address,length){
 if(typeof response!=='string')return null;
 const m=/^READ_CORE_MEMORY\s+([0-9a-f]{4})\s+(.+)$/i.exec(response.trim());
 if(!m||m[1].toUpperCase()!==address||/^-1(?:\s|$)/.test(m[2]))
  return null;
 const bytes=m[2].trim().split(/\s+/);
 if(bytes.length!==length||bytes.some(x=>!/^[0-9a-f]{2}$/i.test(x)))
  return null;
 return bytes.map(x=>x.toUpperCase());
}
function oneQuery(socket,host,port,command,timeoutMs){
 return new Promise((resolve,reject)=>{
  let done=false;
  const complete=(error,value)=>{
   if(done)return;done=true;
   clearTimeout(timer);
   socket.removeListener('message',message);
   socket.removeListener('error',socketError);
   if(error)reject(error);
   else resolve(value);
  };
  const message=(packet,source)=>{
   if(source.address!==host||source.port!==port)return;
   const text=packet.toString('utf8').trim();
   const expected=command.startsWith('GET_STATUS')?'GET_STATUS ':
    'READ_CORE_MEMORY '+command.split(' ')[1]+' ';
   if(!text.toUpperCase().startsWith(expected))return;
   complete(null,text);
  };
  const socketError=error=>complete(error);
  const timer=setTimeout(()=>complete(new Error('UDP_READ_TIMEOUT')),timeoutMs);
  socket.on('message',message);
  socket.on('error',socketError);
  socket.send(Buffer.from(command,'ascii'),port,host,error=>{
   if(error)complete(error);
  });
 });
}
async function probeReadOnlyRetroArch({
 host='192.168.1.145',port=55355,timeoutMs=1200
}={}){
 // The default endpoint above comes from this project's actual server.js,
 // not from evidence that the device is currently reachable.
 if(!privateIpv4(host)||!Number.isInteger(port)||port<1||port>65535||
    !Number.isInteger(timeoutMs)||timeoutMs<250||timeoutMs>5000)
  return fail('PROBE_TARGET_NOT_PRIVATE_OR_INVALID');
 const socket=dgram.createSocket('udp4');
 const sent=[];
 const request=async command=>{
  if(command!=='GET_STATUS'&&
     !/^READ_CORE_MEMORY [0-9A-F]{4} (?:[1-9]|[1-9][0-9]|1[0-5][0-9]|160)$/.test(command))
   throw Error('PROBE_COMMAND_NOT_READ_ONLY');
  sent.push(command.startsWith('GET_STATUS')?'GET_STATUS':'READ_CORE_MEMORY');
  return oneQuery(socket,host,port,command,timeoutMs);
 };
 const read=async(address,length)=>{
  let all=[];
  for(let offset=0;offset<length;offset+=160){
   const a=(address+offset).toString(16).toUpperCase().padStart(4,'0');
   const count=Math.min(160,length-offset);
   const raw=await request('READ_CORE_MEMORY '+a+' '+count);
   const bytes=parseMemory(raw,a,count);
   if(!bytes)throw Error('CORE_MEMORY_READ_INVALID_OR_UNAVAILABLE');
   all.push(...bytes);
  }
  return all;
 };
 try{
  const initial=parseStatus(await request('GET_STATUS'));
  if(!initial)return fail('RETROARCH_STATUS_INVALID');
  if(!initial.contentLoaded)return fail('RETROARCH_CONTENTLESS');
  if(!initial.variant)return fail('ROM_CRC_NOT_IN_AUDITED_SET',
   {reportedCRC32:initial.crc32});
  const firstMap=await read(0xD35E,1);
  const firstPosition=await read(0xD361,2);
  const world=await read(0xD5A0,784);
  // Object-removal toggles are a distinct 32-byte region. The shared
  // readback verifier rejects stale toggles even if all event bits match.
  const repeatedToggles=await read(0xD5A6,32);
  const repeated=await read(0xD6F0,407);
  const lastMap=await read(0xD35E,1);
  const lastPosition=await read(0xD361,2);
  const final=parseStatus(await request('GET_STATUS'));
  if(!final||!final.contentLoaded||final.crc32!==initial.crc32)
   return fail('RETROARCH_CONTENT_OR_CRC_CHANGED',
    {variant:initial.variant});
  const mapVerified=firstMap[0]===lastMap[0];
  const positionVerified=firstPosition.length===2&&
   firstPosition.every((x,i)=>x===lastPosition[i]);
  const proof=verifyGlobalFlagReadback({
   firstWorldBlockHex:world,repeatToggleWindowHex:repeatedToggles,
   repeatFlagWindowHex:repeated,
   repeatMapHex:lastMap,expectedMapId:parseInt(firstMap[0],16),
   romIdentityMatched:true,mapWindowVerified:mapVerified,
   positionWindowVerified:positionVerified
  });
  if(proof.verified!==true)
   return fail('REMOTE_RAM_READBACK_REJECTED',{
    variant:initial.variant,reason:proof.reason,
    rejectedDomain:proof.domain,positionRepeated:positionVerified,
    mapRepeated:mapVerified
   });
  return {verified:true,status:'REMOTE_RAM_FLAGS_REPEAT_CORROBORATED',
   variant:initial.variant,activeRomCRC32:initial.crc32,
   romProfileCRC32Matched:true,activeRomSha256Verified:false,
   mapId:parseInt(firstMap[0],16),
   matchedFlagBytes:proof.readbackBytesMatched,
   matchedToggleBytes:proof.toggleBytesMatched,
   matchedTotalFlagBytes:proof.allFlagBytesMatched,
   mapRepeated:true,positionRepeated:true,
   readOnlyRequests:sent.length,
   playerActionConfirmed:false,snapshotAtomicVerified:false,
   gameEffectsCertified:false,
   source:'RETROARCH_UDP_READ_ONLY_DIRECT',
   note:'CRC32 identifica a correspondencia com o perfil local, nao prova SHA256 da ROM em execucao. Duas leituras iguais nao demonstram snapshot atomico, resultado de batalhas ou scripts'};
 }catch(error){
  return fail(error?.message==='UDP_READ_TIMEOUT'?
   'RETROARCH_UDP_NO_REPLY':
   error?.message==='CORE_MEMORY_READ_INVALID_OR_UNAVAILABLE'?
   'RETROARCH_CORE_MEMORY_UNAVAILABLE':'RETROARCH_UDP_READ_ERROR');
 }finally{
  socket.close();
 }
}
module.exports={probeReadOnlyRetroArch,parseStatus,parseMemory,privateIpv4};
