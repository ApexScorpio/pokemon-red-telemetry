'use strict';
// Compare two separately published ROM/RAM samples. This identifies a
// position DELTA of a sprite slot, not a proven actor identity, animation,
// game-engine movement, action, victory, or atomic emulator frame.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const byte=n=>Number.isInteger(n)&&n>=0&&n<=255;
const slot=n=>Number.isInteger(n)&&n>=1&&n<=15;
const result=(verified,reason,baselineEstablished=false,changes=[],comparisonVerified=false)=>({
 verified,reason,baselineEstablished,
 comparisonVerified,
 observedPositionChanges:changes,
 changedSpriteSlots:changes.length,
 sameActorAcrossFramesCertified:false,
 movementCauseCertified:false,romActorIdentityCertified:false,
 actionExecutedCertified:false,gameplayCompletionCertified:false,
 atomicSnapshotVerified:false,readOnly:true
});
class RomActorMotionSession{
 constructor(){this.reset('NO_PRIOR_LIVE_SAMPLE');}
 reset(reason='MOTION_SAMPLE_INVALIDATED'){
  this.previous=null;this.lastResetReason=reason;
 }
 ingest({romSha256,mapId,targetHost,targetPort,pollSequence,
  romIdentityMatched,spritesVerified,positionVerified,
  publicationGuardVerified,isSimulation=false,
  romAreaEvidence,entities}={}){
  const reject=reason=>{this.reset(reason);return result(false,reason);};
  const sha=typeof romSha256==='string'?romSha256.toLowerCase():null;
  if(!isKnownAuditedRomSha(sha)||!byte(mapId)||mapId>=248||
   typeof targetHost!=='string'||!targetHost||
   !Number.isInteger(targetPort)||targetPort<1||targetPort>65535||
   !Number.isSafeInteger(pollSequence)||pollSequence<1||
   romIdentityMatched!==true||spritesVerified!==true||
   positionVerified!==true||publicationGuardVerified!==true||
   isSimulation===true||romAreaEvidence?.verified!==true||
   romAreaEvidence.mapId!==mapId||
   !Array.isArray(romAreaEvidence.trainers)||
   !Array.isArray(romAreaEvidence.npcs)||
   !Array.isArray(entities))
   return reject('MISSING_COHERENT_ROM_MAP_RAM_OR_PUBLICATION_PROOF');
  const sprites=new Map();
  for(const e of entities){
   if(!e||!slot(e.spriteIndex)||!byte(e.x)||!byte(e.y)||
      !byte(e.pictureId)||sprites.has(e.spriteIndex))
    return reject('AMBIGUOUS_OR_INVALID_RAM_SPRITE_SLOT');
   sprites.set(e.spriteIndex,e);
  }
  const observed=new Map(),romOrdinals=new Set();
  for(const o of [...romAreaEvidence.trainers,...romAreaEvidence.npcs]){
   if(!o||!slot(o.objectOrdinal)||romOrdinals.has(o.objectOrdinal)||
      o.mapId!==mapId||!['trainer','npc'].includes(o.kind)||
      !byte(o.x)||!byte(o.y)||!byte(o.pictureId)||
      o.existsInRom!==true||
      o.source!=='OBJETO_DEFINIDO_NA_ROM_COM_CRC32_CORRESPONDENTE')
    return reject('MALFORMED_OR_DUPLICATED_ROM_ACTOR');
   romOrdinals.add(o.objectOrdinal);
   if(o.movementByte!==0xfe||o.removedFromMap===true)continue;
   const sprite=sprites.get(o.objectOrdinal);
   if(!sprite||sprite.pictureId!==o.pictureId||sprite.isItem===true)
    continue;
   const exactHome=sprite.x===o.x&&sprite.y===o.y&&
      o.observedInRam===true;
   const candidate=!exactHome&&o.observedInRam===null&&
      o.movementCandidate?.possible===true&&
      o.movementCandidate.verified===false&&
      o.movementCandidate.objectOrdinal===o.objectOrdinal&&
      o.movementCandidate.ramX===sprite.x&&
      o.movementCandidate.ramY===sprite.y&&
      o.movementCandidate.romHomeX===o.x&&
      o.movementCandidate.romHomeY===o.y;
   if(!exactHome&&!candidate)continue;
   observed.set(o.objectOrdinal,{
    mapId,objectOrdinal:o.objectOrdinal,kind:o.kind,
    pictureId:o.pictureId,homeX:o.x,homeY:o.y,
    ramX:sprite.x,ramY:sprite.y
   });
  }
  const current={sha,mapId,targetHost,targetPort,pollSequence,observed};
  const previous=this.previous;
  this.previous=current;
  if(!previous)
   return result(true,'FIRST_VALIDATED_BASELINE',true);
  if(previous.sha!==sha||previous.mapId!==mapId||
     previous.targetHost!==targetHost||
     previous.targetPort!==targetPort||
     previous.pollSequence+1!==pollSequence)
   return result(true,'NEW_BASELINE_AFTER_SCOPE_OR_POLL_GAP',true);
  const changes=[];
  for(const [ordinal,actor] of observed){
   const before=previous.observed.get(ordinal);
   if(!before||before.kind!==actor.kind||
      before.pictureId!==actor.pictureId||
      before.homeX!==actor.homeX||before.homeY!==actor.homeY||
      (before.ramX===actor.ramX&&before.ramY===actor.ramY))
    continue;
   changes.push({
    mapId,objectOrdinal:ordinal,romObjectKind:actor.kind,
    pictureId:actor.pictureId,romHome:{x:actor.homeX,y:actor.homeY},
    previousRam:{x:before.ramX,y:before.ramY},
    currentRam:{x:actor.ramX,y:actor.ramY},
    positionDeltaObserved:true,actorIdentityVerified:false,
    sameActorAcrossFramesCertified:false,movementCauseCertified:false,
    actionExecutedCertified:false,defeated:null,collected:null,
    source:'TWO_CONSECUTIVE_VALIDATED_ROM_WALK_SLOT_RAM_POSITIONS'
   });
  }
  return result(true,'SEQUENTIAL_RAM_POSITION_COMPARISON',true,changes,true);
 }
}
module.exports={RomActorMotionSession};
