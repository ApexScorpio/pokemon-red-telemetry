'use strict';
// Strict SHA-audited static map-script write alternatives for two special battles.
// Ordering in the ROM does not prove runtime chronology, battle completion,
// active bank, or a transition from any currently observed game state.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const CASES=Object.freeze([
 {mapId:96,ordinal:2,bank:24,address:0xd665,
  read:398245,
  stores:[398255,398344,398441,398515,398551],
  values:[null,1,2,3,4],
  labels:['SCRIPT_SSANNE2F_DEFAULT','SCRIPT_SSANNE2F_RIVAL_START_BATTLE',
    'SCRIPT_SSANNE2F_RIVAL_AFTER_BATTLE','SCRIPT_SSANNE2F_RIVAL_EXIT',
    'SCRIPT_SSANNE2F_NOOP']},
 {mapId:135,ordinal:11,bank:18,address:0xd65f,
  read:297929,
  stores:[297995,298070,298118,298696],
  values:[null,2,0,1],
  labels:['SCRIPT_GAMECORNER_DEFAULT','SCRIPT_GAMECORNER_ROCKET_BATTLE',
    'SCRIPT_GAMECORNER_ROCKET_EXIT']}
]);
function bad(reason){return {verified:false,reason,maps:[],
  physicalWriteCandidates:0,immediateValueCandidates:0,
  unknownValueWrites:0,executedWriteCount:0,gameProgressVerified:false};}
function buildScriptedBattleStateCandidates({scriptAtlas}={}){
 const sha=scriptAtlas?.romSha256;
 const contexts=scriptAtlas?.scriptedBattleWriteContexts;
 const reference=scriptAtlas?.scriptedBattleReferenceEvidence;
 if(scriptAtlas?.verified!==true||!isKnownAuditedRomSha(sha)||
    contexts?.verified!==true||contexts.romSha256!==sha||
    contexts.decodedCandidateCount!==11||
    contexts.readCandidates!==2||contexts.writeCandidates!==9||
    contexts.immediateValueCandidates!==7||
    contexts.actualScriptStateVerified!==false||
    contexts.allCandidatesRuntimeExecuted!==false||
    !Array.isArray(contexts.entries)||contexts.entries.length!==2||
    reference?.verified!==true||reference.romSha256!==sha||
    !Array.isArray(reference.entries)||reference.entries.length!==2)
  return bad('Physical ROM scan of eleven static operands required');
 const maps=[];
 for(let i=0;i<CASES.length;i++){
  const c=CASES[i],e=contexts.entries[i],r=reference.entries[i];
  if(e?.mapId!==c.mapId||e.ordinal!==c.ordinal||
     e.handlerBank!==c.bank||e.referenceWramAddress!==c.address||
     e.battleWon!==null||e.instructionBoundariesProven!==false||
     e.controlFlowReachabilityVerified!==false||
     !Array.isArray(e.reads)||e.reads.length!==1||
     e.reads[0].verified!==true||e.reads[0].operation!=='READ_A'||
     e.reads[0].fileOffset!==c.read||
     e.reads[0].runtimeExecuted!==false||
     !Array.isArray(e.writes)||e.writes.length!==c.stores.length||
     r?.mapId!==c.mapId||r.ordinal!==c.ordinal||
     r.referenceSemanticsVerifiedInThisRom!==false||
     r.battleWon!==null||r.mapScriptStateReadFromCurrentGame!==false)
   return bad('Special actor or map-script read is inconsistent');
  const candidateWrites=[];
  for(let j=0;j<c.stores.length;j++){
   const w=e.writes[j],v=c.values[j];
   if(w?.verified!==true||w.operation!=='WRITE_A'||
      w.fileOffset!==c.stores[j]||
      w.wramAddress!==c.address||w.opcode!==0xea||
      w.exactOpcodeBytesHex!=='ea'+(c.address&255).toString(16).padStart(2,'0')+
       (c.address>>8).toString(16).padStart(2,'0')||
      w.opcodeDecodesAtOffset!==true||
      w.runtimeExecuted!==false||w.actualRamWriteVerified!==false||
      w.instructionBoundaryFromControlFlowVerified!==false||
      w.precedingValueProvenOnExecutedPath!==false||
      w.candidateAssignedValue!==v||
      (v===null?w.immediateSource!==null:
       !['ADJACENT_LD_A_IMMEDIATE_CANDIDATE',
         'ADJACENT_XOR_A_ZERO_CANDIDATE'].includes(w.immediateSource)))
    return bad('Write opcode, order, or adjacent static value differs from ROM certification');
   candidateWrites.push({
    mapId:c.mapId,writeFileOffset:w.fileOffset,
    referenceWramAddress:c.address,byteValueCandidate:v,
    referenceLabelCandidate:v===null?null:c.labels[v]??null,
    immediateSource:w.immediateSource,
    valueProvenOnExecutedPath:false,
    opcodeCandidatePhysicallyDecoded:true,
    instructionBoundaryFromControlFlowVerified:false,
    executed:false,memoryChangeObserved:false,
    completedBattle:null
   });
  }
  if(!Array.isArray(e.referenceStateLabels)||
     JSON.stringify(e.referenceStateLabels)!==JSON.stringify(c.labels)||
     e.directAdjacentValueCandidates!==c.values.filter(x=>x!==null).length)
   return bad('Pinned symbolic states or read/write counts disagree');
  maps.push({
   mapId:c.mapId,ordinal:c.ordinal,
   referenceScriptVariable:r.referenceScriptVariable,
   referenceWramAddress:c.address,
   physicalReadOffset:c.read,
   referenceStateLabels:c.labels.slice(),
   candidateWrites,
   staticKnownValueCandidates:candidateWrites.filter(x=>
    x.byteValueCandidate!==null).length,
   unknownValueWrites:candidateWrites.filter(x=>
    x.byteValueCandidate===null).length,
   orderInRomIsNotExecutionOrder:true,
   currentScriptValue:null,
   currentBattleCompleted:null,
   canStartBattleNow:null,
   effectsVerified:false,
   warning:'Candidate EA stores and adjacent A values are physical evidence, not observed execution or chronological transitions.'
  });
 }
 return {verified:true,romSha256:sha,
  source:'SHA_VERIFIED_ROM_SCRIPT_WRITES_AND_PINNED_SYMBOLIC_STATES',
  maps,mapCount:2,
  physicalWriteCandidates:9,
  immediateValueCandidates:7,
  unknownValueWrites:2,executedWriteCount:0,
  gameProgressVerified:false,liveReadbackPerformed:false,
  worldMapCoverageClaimed:false};
}
function mapScriptedBattleStateCandidates({scriptAtlas,mapId}={}){
 const data=scriptAtlas?.scriptedBattleStateCandidates;
 if(!Number.isInteger(mapId)||mapId<0||mapId>=248||
    data?.verified!==true||
    data.romSha256!==scriptAtlas?.romSha256||
    !isKnownAuditedRomSha(data.romSha256)||
    data.mapCount!==2||
    !Array.isArray(data.maps)||data.maps.length!==2||
    data.executedWriteCount!==0||
    data.gameProgressVerified!==false||
    data.physicalWriteCandidates!==9||
    data.immediateValueCandidates!==7||
    data.unknownValueWrites!==2||
    data.source!=='SHA_VERIFIED_ROM_SCRIPT_WRITES_AND_PINNED_SYMBOLIC_STATES'||
    data.maps.some((m,i)=>m.mapId!==CASES[i].mapId||
      m.ordinal!==CASES[i].ordinal||
      m.referenceWramAddress!==CASES[i].address||
      m.physicalReadOffset!==CASES[i].read||
      m.currentScriptValue!==null||
      m.currentBattleCompleted!==null||
      m.canStartBattleNow!==null||
      m.effectsVerified!==false||
      m.candidateWrites.length!==CASES[i].stores.length||
      m.candidateWrites.some((w,j)=>
       w.mapId!==CASES[i].mapId||
       w.writeFileOffset!==CASES[i].stores[j]||
       w.referenceWramAddress!==CASES[i].address||
       w.byteValueCandidate!==CASES[i].values[j]||
       w.opcodeCandidatePhysicallyDecoded!==true||
       w.valueProvenOnExecutedPath!==false||
       w.instructionBoundaryFromControlFlowVerified!==false||
       w.executed!==false||w.memoryChangeObserved!==false||
       w.completedBattle!==null)))
  return {verified:false,mapId,reason:'Verified static state write catalogue required',candidateWrites:[]};
 const row=data.maps.find(x=>x.mapId===mapId);
 return {verified:true,mapId,
  candidateWrites:row?row.candidateWrites.map(x=>({...x})):[],
  unresolvedWriteCount:row?.unknownValueWrites??0,
  physicalReadOffset:row?.physicalReadOffset??null,
  noRuntimeProgressProof:true};
}
module.exports={buildScriptedBattleStateCandidates,mapScriptedBattleStateCandidates};
