'use strict';
// Find reference WRAM map-script addresses in exact ROM bytes, and evaluate
// separately supplied repeat-consistent read-only RAM bytes. Do not contact
// RetroArch, assume execution, or treat a script index as a won battle.
const crypto=require('node:crypto');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const ROM_BYTES=1048576,BANK=0x4000,WORLD_START=0xd5a0,WORLD_BYTES=784;
const CASES=Object.freeze([
 {mapId:96,ordinal:2,referenceName:'SS_ANNE_2F',
  referenceVariable:'wSSAnne2FCurScript',referenceAddress:0xd665,
  handlerBank:24,handlerOffset:0x0614e6},
 {mapId:135,ordinal:11,referenceName:'GAME_CORNER',
  referenceVariable:'wGameCornerCurScript',referenceAddress:0xd65f,
  handlerBank:18,handlerOffset:0x048e9d}
]);
const HEX=/^[a-f0-9]{2}$/i;
const bad=reason=>({verified:false,reason,candidates:[],
 readOnly:true,runtimeValueRead:false,battleWon:null});
function locateScriptedBattleRamCandidates({rom,scriptAtlas}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_BYTES||
    scriptAtlas?.verified!==true||
    scriptAtlas.scriptedBattleReferenceEvidence?.verified!==true)
  return bad('Exact ROM and linked scripted battle reference required');
 const sha=crypto.createHash('sha256').update(rom).digest('hex');
 const ref=scriptAtlas.scriptedBattleReferenceEvidence;
 if(!isKnownAuditedRomSha(sha)||scriptAtlas.romSha256!==sha||
    ref.romSha256!==sha||ref.referenceCases!==2||
    !Array.isArray(ref.entries)||ref.entries.length!==2)
  return bad('ROM signature and reference cases inconsistent');
 const candidates=[];
 for(let i=0;i<CASES.length;i++){
  const c=CASES[i],row=ref.entries[i];
  if(row.mapId!==c.mapId||row.ordinal!==c.ordinal||
     row.txAsmFileOffset!==c.handlerOffset||
     row.referenceMapName!==c.referenceName||
     row.referenceScriptVariable!==c.referenceVariable||
     row.sourceReferenceOnly!==true||
     row.battleWon!==null||
     row.referenceSemanticsVerifiedInThisRom!==false)
   return bad('Physical battle actor and reference memory label disagree');
  const bankStart=c.handlerBank*BANK,bankEnd=bankStart+BANK;
  const lo=c.referenceAddress&255,hi=c.referenceAddress>>8;
  const scanOpcode=opcode=>{
   const offsets=[];
   for(let at=bankStart;at+2<bankEnd;at++){
    if(rom[at]===opcode&&rom[at+1]===lo&&rom[at+2]===hi)
     offsets.push(at);
   }
   return offsets;
  };
  const reads=scanOpcode(0xfa),writes=scanOpcode(0xea);
  const hl=scanOpcode(0x21);
  candidates.push({
   mapId:c.mapId,ordinal:c.ordinal,referenceName:c.referenceName,
   referenceVariable:c.referenceVariable,
   referenceWramAddress:c.referenceAddress,
   worldBlockOffset:c.referenceAddress-WORLD_START,
   referenceDerivation:'PINNED_PRET_WRAM_END_D6B8_MINUS_DB_AND_DS_TAIL',
   addressProvenFromActualRomInstructions:false,
   referenceLayoutOnly:true,
   handlerBank:c.handlerBank,handlerFileOffset:c.handlerOffset,
   physicalBankScanned:bankEnd-bankStart,
   literalLoadACandidateCount:reads.length,
   literalStoreACandidateCount:writes.length,
   literalHlPointerCandidateCount:hl.length,
   literalLoadAOffsets:reads,
   literalStoreAOffsets:writes,
   literalHlPointerOffsets:hl,
   instructionBoundaryVerified:false,
   runtimeReadbackAvailable:false,
   currentScriptState:null,
   battleWon:null,
   warning:'Opcode triplets may overlap data. These are physical candidate matches to a pinned external WRAM label, not a proven execution path.'
  });
 }
 return {verified:true,romSha256:sha,
  source:'PHYSICAL_ROM_WINDOWNED_REFERENCE_WRAM_LITERAL_CANDIDATES',
  referenceCommit:ref.referenceCommit,
  candidates,count:2,worldBlockStart:WORLD_START,worldBlockLength:WORLD_BYTES,
  scriptAddressPhysicallyProven:false,
  scriptStateReadbackVerified:false,executed:false,readOnly:true,
  battleWon:null,
  warning:'The pinned reference WRAM address is a hypothesis until independently bound to the running ROM and its live memory reader.'};
}
// No memory I/O in this function. A caller must provide a corroborated first
// 784-byte block AND second byte/map read from the already authorized reader.
// Even a matching value only identifies a reference script index.
function assessScriptedBattleRamReadback({
 layout,mapId,romSha256,firstWorldBlockHex,repeatScriptHex,
 repeatMapHex,romIdentityMatched=false,mapPositionVerified=false,
 secondReadFromSameTargetVerified=false
}={}){
 const none=reason=>({verified:false,reason,mapId,
  scriptValue:null,referenceStateName:null,
  battleWon:null,canBattleNow:null,referenceOnly:true,
  completedGameplayCertified:false});
 if(layout?.verified!==true||layout.romSha256!==romSha256||
    !isKnownAuditedRomSha(romSha256)||layout.count!==2||
    !Array.isArray(layout.candidates)||layout.candidates.length!==2||
    layout.candidates.some((x,i)=>
     x.mapId!==CASES[i].mapId||
     x.ordinal!==CASES[i].ordinal||
     x.referenceWramAddress!==CASES[i].referenceAddress||
     x.worldBlockOffset!==CASES[i].referenceAddress-WORLD_START||
     x.handlerBank!==CASES[i].handlerBank||
     x.referenceLayoutOnly!==true||
     x.addressProvenFromActualRomInstructions!==false)||
    !Number.isInteger(mapId)||mapId<0||mapId>=248||
    !layout.candidates.some(x=>x.mapId===mapId))
  return none('Physical ROM and reference memory candidate not confirmed');
 if(romIdentityMatched!==true||mapPositionVerified!==true||
    secondReadFromSameTargetVerified!==true)
  return none('No matched ROM, map or repeated read from same target');
 if(!Array.isArray(firstWorldBlockHex)||
    firstWorldBlockHex.length!==WORLD_BYTES||
    firstWorldBlockHex.some(x=>typeof x!=='string'||!HEX.test(x))||
    typeof repeatScriptHex!=='string'||!HEX.test(repeatScriptHex)||
    typeof repeatMapHex!=='string'||!HEX.test(repeatMapHex)||
    parseInt(repeatMapHex,16)!==mapId)
  return none('RAM block, repeated map or repeated script byte malformed');
 const candidate=layout.candidates.find(x=>x.mapId===mapId);
 const offset=candidate.worldBlockOffset;
 if(offset<0||offset>=WORLD_BYTES)return none('Script label outside read block');
 const first=parseInt(firstWorldBlockHex[offset],16);
 const repeat=parseInt(repeatScriptHex,16);
 if(first!==repeat)return none('Script byte changed between independent reads');
 // The numeric index alone does not say battle victory, unlock state,
 // overworld sprite visibility or whether the next action can occur.
 const states=mapId===96?[
  'SCRIPT_SSANNE2F_DEFAULT','SCRIPT_SSANNE2F_RIVAL_START_BATTLE',
  'SCRIPT_SSANNE2F_RIVAL_AFTER_BATTLE','SCRIPT_SSANNE2F_RIVAL_EXIT',
  'SCRIPT_SSANNE2F_NOOP'
 ]:[
  'SCRIPT_GAMECORNER_DEFAULT','SCRIPT_GAMECORNER_ROCKET_BATTLE',
  'SCRIPT_GAMECORNER_ROCKET_EXIT'];
 return {verified:true,mapId,romSha256,
  referenceScriptVariable:candidate.referenceVariable,
  referenceWramAddress:candidate.referenceWramAddress,
  scriptValue:first,referenceStateName:states[first]??null,
  scriptValueRepeated:true,referenceOnly:true,
  actualScriptSemanticsVerifiedInRom:false,
  stateReadbackSource:'TWO_MATCHING_READ_ONLY_RAM_SAMPLES_FROM_MATCHED_ROM_AND_MAP',
  battleWon:null,canBattleNow:null,
  completedGameplayCertified:false,
  warning:'A matching script byte is a real readback but its named state is from pinned reference, not proof of a battle or objective.'};
}
module.exports={locateScriptedBattleRamCandidates,assessScriptedBattleRamReadback};
