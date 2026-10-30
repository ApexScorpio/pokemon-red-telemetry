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
 // The full in-memory audit has a flat references array; verified saved
 // profiles deliberately store only maps[].interactions to avoid duplicate
 // JSON/ZIP payloads. Both representations must produce the same graph.
 let references=atlas?.references;
 if(!Array.isArray(references)&&Array.isArray(atlas?.maps)&&
    atlas.maps.length===248){
  if(atlas.maps.some((m,i)=>m?.mapId!==i||!Array.isArray(m.interactions)))
   return fail('Persisted map interaction catalogue incomplete');
  references=atlas.maps.flatMap(m=>m.interactions);
 }
 if(atlas?.verified!==true||!isKnownAuditedRomSha(sha)||
    atlas?.summary?.referencedInteractions!==1126||
    !Array.isArray(references)||references.length!==1126)
  return fail('ROM SHA and complete world interaction atlas not verified');
 const entries=[],index=new Map();
 const unique=new Map();
 for(const row of references){
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
     possibleWriterMapId:writer.mapId,possibleReaderMapId:reader.mapId,
     possibleWriterKind:writer.kind,possibleReaderKind:reader.kind,
     possibleWriterOrdinal:writer.ordinal,possibleReaderOrdinal:reader.ordinal,
     writerRomHandlerOffset:writer.romHandlerOffset,
     readerRomHandlerOffset:reader.romHandlerOffset,
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
// Build a small, read-only per-map view of the physical ROM candidates.
// This does not assert that speaking to one NPC changes another NPC.
function candidateFlagLinksForMap({atlas,mapId}={}){
 if(!Number.isInteger(mapId)||mapId<0||mapId>247)
  return {verified:false,mapId,reason:'ID de mapa invalido',links:[]};
 const graph=buildStaticWorldFlagDependencies({atlas});
 if(graph.verified!==true)
  return {verified:false,mapId,reason:graph.reason,links:[]};
 const links=graph.candidateLinks.filter(x=>
  x.possibleWriterMapId===mapId||x.possibleReaderMapId===mapId);
 return {verified:true,mapId,romSha256:graph.romSha256,links,
  candidateLinkCount:links.length,
  crossMapCandidateCount:links.filter(x=>!x.sameMap).length,
  wholeWorldCandidateLinks:graph.summary.totalPotentialLinks,
  wholeWorldCrossMapCandidates:graph.summary.crossMapPotentialLinks,
  provenCausalLinks:0,actionEffectsCertified:false,
  source:'ROM_STATIC_SHARED_FLAG_OPCODE_CANDIDATES',
  caveat:'O mesmo bit em dois scripts nao prova dependencias, acessibilidade nem efeitos'};
}
module.exports={buildStaticWorldFlagDependencies,candidateFlagLinksForMap};
