'use strict';
// World-wide *candidate* inter-object links by physical ROM event-bit opcodes.
// If handler A contains SET bit x and handler B tests bit x, their script
// references share an event flag candidate; it is NOT proof A enables B.
// No execution, conditions, active MBC banks or previous save state inferred.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const fail=reason=>({verified:false,reason,entries:[],candidateLinks:[],
 summary:null,eventsCompletedCertified:false});
const KINDS=new Set(['SIGN','NPC','TRAINER','ITEM','STATIC_POKEMON']);
const OPS=new Set(['BIT_TEST','SET_BIT','RESET_BIT']);
function buildStaticWorldFlagDependencies({atlas}={}){
 const sha=String(atlas?.romSha256||'').toLowerCase();
 if(atlas?.verified!==true||!isKnownAuditedRomSha(sha)||
    atlas?.summary?.referencedInteractions!==1126||
    !Array.isArray(atlas.references)||atlas.references.length!==1126)
  return fail('ROM SHA and complete world interaction atlas not verified');
 const entries=[],index=new Map();
 const unique=new Map();
 for(const row of atlas.references){
  if(!Number.isInteger(row?.mapId)||row.mapId<0||row.mapId>247||
     !Number.isInteger(row.ordinal)||row.ordinal<1||
     !KINDS.has(row.kind)||row.asmMemoryEffectExecuted!==false)
   return fail('World object or static effect evidence malformed');
  if(row.scriptCommand!=='TX_START_ASM')continue;
  const graph=row.asmCandidate;
  if(graph?.verified!==true||graph.txAsmFileOffset!==row.scriptFileOffset||
     !Array.isArray(graph.adjacentRomFlagBitPatterns))
   return fail('ASM event flag candidate graph incomplete');
  const actorId=row.mapId+':'+row.kind+':'+row.ordinal;
  for(const p of graph.adjacentRomFlagBitPatterns){
   if(!OPS.has(p?.operation)||!Number.isInteger(p.bitIndex)||
      p.bitIndex<0||p.bitIndex>=2560||
      !['WORLD_EVENT_BIT','HIDDEN_ITEM_BIT','HIDDEN_COIN_BIT'].includes(p.domain)||
      p.operandsAndAdjacencyVerified!==true||
      p.instructionSequenceExecuted!==false||
      !Number.isInteger(p.offset)||!Number.isInteger(p.secondOffset)||
      p.secondOffset!==p.offset+3)
    return fail('Unverified or malformed ROM bit operation candidate');
   const key=p.domain+':'+p.bitIndex;
   const candidate={key,domain:p.domain,bitIndex:p.bitIndex,
    operation:p.operation,actorId,mapId:row.mapId,kind:row.kind,
    ordinal:row.ordinal,romHandlerOffset:row.scriptFileOffset,
    opcodeOffset:p.offset,bitInstructionOffset:p.secondOffset,
    physicallyDecoded:true,branchTakenVerified:false,
    gameEffectVerified:false,completedNow:null,
    source:'ROM_ADJACENT_FLAG_OPERATION_CANDIDATE'};
   entries.push(candidate);
   if(!index.has(key))index.set(key,{tests:[],writes:[]});
   const group=index.get(key);
   if(p.operation==='BIT_TEST')group.tests.push(candidate);
   else group.writes.push(candidate);
   unique.set(p.offset+':'+p.secondOffset+':'+p.operation,p);
  }
 }
 const candidateLinks=[];
 for(const [key,group] of index){
  for(const writer of group.writes){
   for(const reader of group.tests){
    if(writer.actorId===reader.actorId)continue;
    if(candidateLinks.length>=20000)
     return fail('Cross-reference graph too large to validate');
    candidateLinks.push({key,domain:writer.domain,bitIndex:writer.bitIndex,
     possibleWriter:writer.actorId,possibleReader:reader.actorId,
     possibleWriteOpcode:writer.operation,
     sameMap:writer.mapId===reader.mapId,
     verifiedActionDependency:false,scriptEffectVerified:false,
     causalLinkObserved:false});
   }
  }
 }
 candidateLinks.sort((a,b)=>
  a.key.localeCompare(b.key)||
  a.possibleWriter.localeCompare(b.possibleWriter)||
  a.possibleReader.localeCompare(b.possibleReader));
 return {verified:true,romSha256:sha,entries,candidateLinks,
  summary:{totalWorldObjects:1126,uniquePhysicalBitPatterns:unique.size,
   actorReferencesWithPatterns:new Set(entries.map(e=>e.actorId)).size,
   bitKeysReferenced:index.size,
   crossMapPotentialLinks:candidateLinks.filter(x=>!x.sameMap).length,
   sameMapPotentialLinks:candidateLinks.filter(x=>x.sameMap).length,
   totalPotentialLinks:candidateLinks.length,
   testedBitCandidateReferences:entries.filter(x=>x.operation==='BIT_TEST').length,
   setBitCandidateReferences:entries.filter(x=>x.operation==='SET_BIT').length,
   resetBitCandidateReferences:entries.filter(x=>x.operation==='RESET_BIT').length,
   trustedCausalLinks:0},
  eventsCompletedCertified:false,scriptEffectsCertified:false,
  note:'Static same-bit candidates only: dynamic RAM values, branch selection, movement, rewards and causal effects unobserved'};
}
module.exports={buildStaticWorldFlagDependencies};
