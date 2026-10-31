'use strict';
// Opt-in to two already-supported READ_CORE_MEMORY calls only on maps 96/135.
// The running companion supplies its existing RAM reader and same-target
// identity. Never pause, save, write memory, press buttons or restart RetroArch.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const {verifyMapPositionWindow}=require('./romMapPositionConsistency');
const {assessScriptedBattleRamReadback}=require('./romScriptedBattleRam');
const SCRIPT_BYTES=Object.freeze({96:'D665',135:'D65F'});
const hexByte=x=>typeof x==='string'&&/^[a-f\d]{2}$/i.test(x);
const deny=(status,requests=0)=>({
 verified:false,status,readOnly:true,readOnlyRequests:requests,
 readback:null,scriptValue:null,referenceStateName:null,
 battleWon:null,snapshotAtomicVerified:false,gameProgressCertified:false
});
async function collectScriptedBattleLiveReadback({
 profile,mapId,firstWorldBlockHex,firstMapByte,firstYByte,
 firstXByte,eligible=false,readMemoryBlock,getTarget
}={}){
 if(mapId!==96&&mapId!==135)
  return deny('MAP_NOT_SCRIPTED_BATTLE');
 const sha=profile?.hash?.sha256;
 const layout=profile?.world?.interactionScriptAtlas?.scriptedBattleRamCandidates;
 if(eligible!==true||!isKnownAuditedRomSha(sha)||
    layout?.verified!==true||layout.romSha256!==sha||
    !Array.isArray(firstWorldBlockHex)||firstWorldBlockHex.length!==784||
    firstWorldBlockHex.some(x=>!hexByte(x))||
    !hexByte(firstMapByte)||parseInt(firstMapByte,16)!==mapId||
    !hexByte(firstXByte)||!hexByte(firstYByte)||
    typeof readMemoryBlock!=='function'||typeof getTarget!=='function')
  return deny('INITIAL_ROM_MAP_AND_WORLD_WINDOW_NOT_CORROBORATED');
 let attempted=0;
 try{
  const before=getTarget();
  if(!before||typeof before.host!=='string'||!before.host||
     !Number.isInteger(before.port)||before.port<1||before.port>65535)
   return deny('TARGET_UNAVAILABLE');
  attempted++;
  const repeatedScript=await readMemoryBlock(SCRIPT_BYTES[mapId],1);
  if(!Array.isArray(repeatedScript)||repeatedScript.length!==1||
     !hexByte(repeatedScript[0]))
   return deny('SECOND_SCRIPT_BYTE_MISSING',attempted);
  attempted++;
  const repeatedPosition=await readMemoryBlock('D35E',8);
  const after=getTarget();
  const sameTarget=after?.host===before.host&&after?.port===before.port;
  if(!sameTarget)return deny('RETROARCH_TARGET_CHANGED',attempted);
  const position=verifyMapPositionWindow({
   firstMapByte,firstYByte,firstXByte,
   secondMapAndLastMapBytes:repeatedPosition
  });
  if(position.verified!==true||position.mapId!==mapId)
   return deny('SCRIPT_REPEAT_POSITION_REJECTED_'+
    (position.reason||'UNKNOWN'),attempted);
  const readback={
   firstWorldBlockHex,repeatScriptHex:repeatedScript[0],
   repeatMapHex:repeatedPosition[0],
   romIdentityMatched:true,mapPositionVerified:true,
   secondReadFromSameTargetVerified:true
  };
  const checked=assessScriptedBattleRamReadback({
   layout,mapId,romSha256:sha,...readback
  });
  if(checked.verified!==true)
   return deny('SCRIPT_BYTE_CORROBORATION_REJECTED_'+
    (checked.reason||'UNKNOWN'),attempted);
  return {verified:true,status:'SCRIPT_BYTE_REPEATED_REFERENCE_ONLY',
   readOnly:true,readOnlyRequests:attempted,mapId,
   readback,scriptValue:checked.scriptValue,
   referenceStateName:checked.referenceStateName,
   battleWon:null,snapshotAtomicVerified:false,
   gameProgressCertified:false,source:checked.stateReadbackSource,
   warning:'Repeated ROM-matched map-script byte; reference label only. No battle victory or atomic frame proven.'};
 }catch(error){
  return deny('OPTIONAL_SCRIPT_READ_ERROR_'+
   (typeof error?.code==='string'&&/^[A-Z_0-9]{1,45}$/.test(error.code)?
    error.code:'READ_FAILED'),attempted);
 }
}
module.exports={collectScriptedBattleLiveReadback};
