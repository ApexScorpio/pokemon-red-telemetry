'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildScriptedBattleStateCandidates,mapScriptedBattleStateCandidates}=
 require('../romScriptedBattleStateCandidates');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function fixture(){
 const definitions=[
  {mapId:96,ordinal:2,bank:24,addr:0xd665,read:398245,
   stores:[398255,398344,398441,398515,398551],
   values:[null,1,2,3,4],
   labels:['SCRIPT_SSANNE2F_DEFAULT','SCRIPT_SSANNE2F_RIVAL_START_BATTLE',
    'SCRIPT_SSANNE2F_RIVAL_AFTER_BATTLE','SCRIPT_SSANNE2F_RIVAL_EXIT',
    'SCRIPT_SSANNE2F_NOOP'],referenceScriptVariable:'wSSAnne2FCurScript'},
  {mapId:135,ordinal:11,bank:18,addr:0xd65f,read:297929,
   stores:[297995,298070,298118,298696],values:[null,2,0,1],
   labels:['SCRIPT_GAMECORNER_DEFAULT','SCRIPT_GAMECORNER_ROCKET_BATTLE',
    'SCRIPT_GAMECORNER_ROCKET_EXIT'],referenceScriptVariable:'wGameCornerCurScript'}
 ];
 const entries=definitions.map(d=>({
  mapId:d.mapId,ordinal:d.ordinal,handlerBank:d.bank,
  referenceWramAddress:d.addr,battleWon:null,
  instructionBoundariesProven:false,controlFlowReachabilityVerified:false,
  directAdjacentValueCandidates:d.values.filter(v=>v!==null).length,
  referenceStateLabels:d.labels,
  reads:[{verified:true,operation:'READ_A',fileOffset:d.read,
   runtimeExecuted:false}],
  writes:d.stores.map((fileOffset,i)=>({
   verified:true,operation:'WRITE_A',fileOffset,
   wramAddress:d.addr,opcode:0xea,
   exactOpcodeBytesHex:'ea'+(d.addr&255).toString(16).padStart(2,'0')+
    (d.addr>>8).toString(16).padStart(2,'0'),
   opcodeDecodesAtOffset:true,runtimeExecuted:false,
   actualRamWriteVerified:false,
   instructionBoundaryFromControlFlowVerified:false,
   precedingValueProvenOnExecutedPath:false,
   candidateAssignedValue:d.values[i],
   immediateSource:d.values[i]===null?null:
    'ADJACENT_LD_A_IMMEDIATE_CANDIDATE'
  }))
 }));
 const reference={verified:true,romSha256:SHA,entries:definitions.map(d=>({
  mapId:d.mapId,ordinal:d.ordinal,referenceScriptVariable:d.referenceScriptVariable,
  referenceSemanticsVerifiedInThisRom:false,battleWon:null,
  mapScriptStateReadFromCurrentGame:false
 }))};
 return {verified:true,romSha256:SHA,
  scriptedBattleReferenceEvidence:reference,
  scriptedBattleWriteContexts:{verified:true,romSha256:SHA,
   entries,decodedCandidateCount:11,readCandidates:2,writeCandidates:9,
   immediateValueCandidates:7,actualScriptStateVerified:false,
   allCandidatesRuntimeExecuted:false}};
}
test('two special maps expose exactly seven static assignments without a fabricated battle',()=>{
 const x=buildScriptedBattleStateCandidates({scriptAtlas:fixture()});
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.physicalWriteCandidates,9);
 assert.equal(x.immediateValueCandidates,7);
 assert.equal(x.unknownValueWrites,2);
 assert.deepEqual(x.maps.map(m=>m.candidateWrites.map(w=>w.byteValueCandidate)),[
  [null,1,2,3,4],[null,2,0,1]]);
 assert.ok(x.maps.every(m=>m.currentBattleCompleted===null&&
  m.candidateWrites.every(w=>w.executed===false)));
});
test('map-specific projections do not leak another map or invent play progress',()=>{
 const atlas=fixture();
 atlas.scriptedBattleStateCandidates=buildScriptedBattleStateCandidates({scriptAtlas:atlas});
 const a=mapScriptedBattleStateCandidates({scriptAtlas:atlas,mapId:96});
 const b=mapScriptedBattleStateCandidates({scriptAtlas:atlas,mapId:135});
 assert.deepEqual(a.candidateWrites.map(x=>x.byteValueCandidate),[null,1,2,3,4]);
 assert.deepEqual(b.candidateWrites.map(x=>x.byteValueCandidate),[null,2,0,1]);
 assert.equal(a.unresolvedWriteCount,1);
 assert.equal(b.unresolvedWriteCount,1);
 assert.equal(mapScriptedBattleStateCandidates({scriptAtlas:atlas,mapId:15}).candidateWrites.length,0);
 assert.ok(a.candidateWrites.every(x=>x.completedBattle===null));
});
test('forged immediate value, offset, or apparent execution is rejected',()=>{
 const altered=fixture();altered.scriptedBattleWriteContexts.entries[0].writes[2].candidateAssignedValue=99;
 assert.equal(buildScriptedBattleStateCandidates({scriptAtlas:altered}).verified,false);
 const offset=fixture();offset.scriptedBattleWriteContexts.entries[1].writes[2].fileOffset++;
 assert.equal(buildScriptedBattleStateCandidates({scriptAtlas:offset}).verified,false);
 const played=fixture();played.scriptedBattleWriteContexts.entries[0].writes[1].runtimeExecuted=true;
 assert.equal(buildScriptedBattleStateCandidates({scriptAtlas:played}).verified,false);
 const missing=fixture();missing.scriptedBattleWriteContexts.entries[0].writes.pop();
 assert.equal(buildScriptedBattleStateCandidates({scriptAtlas:missing}).verified,false);
});
test('unknown or inconsistent ROM source does not authorize real game state',()=>{
 assert.equal(buildScriptedBattleStateCandidates({}).verified,false);
 const f=fixture();f.romSha256='0'.repeat(64);
 assert.equal(buildScriptedBattleStateCandidates({scriptAtlas:f}).verified,false);
 const f2=fixture();f2.scriptedBattleWriteContexts.verified=false;
 assert.equal(buildScriptedBattleStateCandidates({scriptAtlas:f2}).verified,false);
});
for(const [variant,envName] of [['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']]){
 test('original '+variant+' ROM offers seven static script states only',
  {skip:!process.env[envName]?'Original ROM required':false},()=>{
   const rom=readRom(process.env[envName]);
   const profile=inspectRomBuffer(rom,variant+'.gb');
   assert.equal(profile.hash.sha256,KNOWN[variant]);
   const atlas=profile.world.interactionScriptAtlas;
   const evidence=atlas.scriptedBattleStateCandidates;
   assert.equal(evidence.verified,true,evidence.reason);
   assert.equal(evidence.immediateValueCandidates,7);
   assert.equal(evidence.unknownValueWrites,2);
   assert.deepEqual(evidence.maps.map(e=>e.candidateWrites.map(w=>
    w.byteValueCandidate)),[[null,1,2,3,4],[null,2,0,1]]);
   assert.equal(evidence.executedWriteCount,0);
   assert.equal(evidence.gameProgressVerified,false);
  });
}

test('projection refuses a forged completed outcome or moved physical opcode',()=>{
 const atlas=fixture();
 atlas.scriptedBattleStateCandidates=buildScriptedBattleStateCandidates({scriptAtlas:atlas});
 const d=atlas.scriptedBattleStateCandidates;
 d.maps[0].candidateWrites[1].executed=true;
 assert.equal(mapScriptedBattleStateCandidates({scriptAtlas:atlas,mapId:96}).verified,false);
 d.maps[0].candidateWrites[1].executed=false;
 d.maps[1].candidateWrites[0].writeFileOffset++;
 assert.equal(mapScriptedBattleStateCandidates({scriptAtlas:atlas,mapId:135}).verified,false);
});
