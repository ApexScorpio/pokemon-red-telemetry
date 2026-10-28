'use strict';
// wWalkBikeSurfState = D700. A movement hint must use a mode corroborated by
// independent sequential observations, without claiming an atomic frame.
const byte=x=>typeof x==='string'&&/^[0-9a-f]{2}$/i.test(x)?parseInt(x,16):null;
function verifyMovementModeWindow({firstModeByte,secondModeBytes}={}){
 const first=byte(firstModeByte),last=Array.isArray(secondModeBytes)&&secondModeBytes.length===1?
  byte(secondModeBytes[0]):null;
 if(first===null||last===null)return {verified:false,reason:'D700_INCOMPLETE_OR_INVALID',atomicSnapshotVerified:false};
 if(first>2||last>2)return {verified:false,reason:'D700_NOT_WALK_BIKE_SURF',atomicSnapshotVerified:false};
 if(first!==last)return {verified:false,reason:'D700_CHANGED_DURING_SEQUENTIAL_READS',atomicSnapshotVerified:false,
  initialModeByte:first,finalModeByte:last};
 return {verified:true,modeByte:first,mode:['WALK','BIKE','SURF'][first],
  atomicSnapshotVerified:false,source:'D700_FIRST_EVENT_BLOCK_AND_REPEAT',
  warning:'Two equal readings do not prove no mode change between frames'};
}
module.exports={verifyMovementModeWindow};
