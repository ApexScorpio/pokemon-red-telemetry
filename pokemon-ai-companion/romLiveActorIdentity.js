'use strict';
// Identify CURRENT sprites only through a unique ROM object ordinal and
// exact RAM sprite coordinates/picture. Proximity and manual boss lists
// are never identity evidence, for any of the 248 world map IDs.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const xy=x=>Number.isInteger(x)&&x>=-4&&x<=255;
const id=x=>Number.isSafeInteger(x)&&x>=1;
function matchLiveActorsToAuditedRom({
 entities,romAreaEvidence,mapId,romSha256,romIdentityMatched,
 spritesVerified,positionVerified
}={}){
 const input=Array.isArray(entities)?entities:[];
 const deny=reason=>({
  verified:false,mapId,identifiedItems:0,identifiedTrainers:0,movingCandidates:0,
  unidentifiedSprites:input.length,reason,
  entities:input.map(e=>({...e,romActorIdentityVerified:false,
   romActorIdentitySource:'NOT_VERIFIED'})),
  gameplayVictoryCertified:false,gameplayCollectionCertified:false
 });
 if(!Array.isArray(entities)||!id(mapId+1)||mapId>247||
    !isKnownAuditedRomSha(romSha256)||
    romIdentityMatched!==true||spritesVerified!==true||
    positionVerified!==true||
    romAreaEvidence?.verified!==true||romAreaEvidence.mapId!==mapId||
    !Array.isArray(romAreaEvidence.items)||
    !Array.isArray(romAreaEvidence.trainers))
  return deny('Missing current ROM/position/sprite proof');
 const objects=[...romAreaEvidence.items,...romAreaEvidence.trainers];
 const ordinals=new Set();
 for(const o of objects){
  if(!o||!id(o.objectOrdinal)||ordinals.has(o.objectOrdinal)||
     o.mapId!==mapId||!xy(o.x)||!xy(o.y)||
     !Number.isSafeInteger(o.pictureId)||
     o.source!=='OBJETO_DEFINIDO_NA_ROM_COM_CRC32_CORRESPONDENTE'||
     o.existsInRom!==true||
     !['item','trainer'].includes(o.kind))
   return deny('Contradictory ROM actor objects');
  ordinals.add(o.objectOrdinal);
 }
 const used=new Set();let identifiedItems=0,identifiedTrainers=0;
 const enriched=input.map(e=>{
  const out={...e,romActorIdentityVerified:false,
   romActorIdentitySource:'NOT_VERIFIED'};
  if(!e||!id(e.spriteIndex)||
     !xy(e.x)||!xy(e.y)||!Number.isSafeInteger(e.pictureId))
   return out;
  // The ROM object header, not the appearance-based icon/classifier,
  // determines item vs trainer. An NPC-looking sprite may be a trainer,
  // while a trainer-looking sprite may belong to a normal NPC.
  const candidates=objects.filter(o=>
   o.objectOrdinal===e.spriteIndex&&
   o.x===e.x&&o.y===e.y&&o.pictureId===e.pictureId&&
   (o.kind==='item'
     ?e.isItem===true&&e.isTrainer!==true
     :o.kind==='trainer'&&e.isItem!==true)&&
   o.observedInRam===true&&
   o.removedFromMap!==true);
  if(candidates.length!==1||used.has(candidates[0].objectOrdinal)){
   // A WALK actor whose RAM tile differs from its ROM home coordinate
   // is a candidate only. Never assign trainer name, team or victory.
   const moving=objects.filter(o=>
    o.kind==='trainer'&&o.objectOrdinal===e.spriteIndex&&
    o.pictureId===e.pictureId&&e.isItem!==true&&
    o.movementByte===0xfe&&o.observedInRam===null&&
    o.removedFromMap!==true&&
    o.movementCandidate?.possible===true&&
    o.movementCandidate.verified===false&&
    o.movementCandidate.ramX===e.x&&
    o.movementCandidate.ramY===e.y&&
    o.movementCandidate.romHomeX===o.x&&
    o.movementCandidate.romHomeY===o.y&&
    (e.x!==o.x||e.y!==o.y));
   if(moving.length===1){
    out.romActorMovementCandidate={
     possible:true,verified:false,kind:'trainer',
     mapId,objectOrdinal:moving[0].objectOrdinal,
     romHomeX:moving[0].x,romHomeY:moving[0].y,
     ramX:e.x,ramY:e.y,movementByteFromRom:0xfe,
     source:'ROM_WALK_AND_SAME_RAM_SLOT_PICTURE;_NOT_IDENTITY_PROOF'
    };
   }
   return out;
  }
  const match=candidates[0];
  const kind=match.kind;
  used.add(match.objectOrdinal);
  out.romActorIdentityVerified=true;
  out.romActorIdentitySource='EXACT_ROM_ORDINAL_COORDINATES_PICTURE_AND_RAM';
  out.romObjectOrdinal=match.objectOrdinal;
  out.romObjectKind=kind;
  if(kind==='item'){
   if(!Number.isSafeInteger(match.itemId)||match.itemId<0){
    out.romActorIdentityVerified=false;
    out.romActorIdentitySource='ROM_ITEM_ID_UNVERIFIED';
    used.delete(match.objectOrdinal);
    return out;
   }
   identifiedItems++;
   out.type='item';
   out.isItem=true;
   out.icon='🎒';
   out.itemId=match.itemId;
   out.itemName=typeof match.itemName==='string'?match.itemName:
      'Item #'+match.itemId+' (nome por confirmar)';
   out.name='🎒 '+out.itemName;
   out.nameSource='ROM_ITEM_ID_WITH_LOCAL_NAME_REFERENCE';
   out.isCollected=null;
   out.removedFromMap=match.removedFromMap??null;
   out.collectionCertified=false;
  }else{
   identifiedTrainers++;
   out.isTrainer=true;
   out.isItem=false;
   out.type='trainer';
   out.icon='⚔️';
   out.trainerClassId=match.trainerClassId??null;
   out.trainerNumber=match.trainerNumber??null;
   out.trainerName=match.trainerClassName||null;
   out.name=match.trainerClassName?
     '⚔️ '+match.trainerClassName:
     '⚔️ Treinador ROM #'+match.objectOrdinal;
   out.nameSource=match.trainerClassName?
     'ROM_TRAINER_CLASS_REFERENCE':'ROM_TRAINER_OBJECT_NO_VERIFIED_NAME';
   out.enemyRoster=Array.isArray(match.team)?match.team:null;
   out.teamSource=match.teamSource||null;
   out.isDefeated=null;
   out.victoryCertified=false;
  }
  return out;
 });
 return {verified:true,mapId,romSha256,
  identifiedItems,identifiedTrainers,
  movingCandidates:enriched.filter(e=>e.romActorMovementCandidate?.possible===true).length,
  unidentifiedSprites:enriched.length-identifiedItems-identifiedTrainers,
  entities:enriched,identityMethod:'EXACT_OBJECT_ORDINAL_X_Y_PICTURE_RAM',
  manualProximityUsed:false,gameplayVictoryCertified:false,
  gameplayCollectionCertified:false};
}
module.exports={matchLiveActorsToAuditedRom};
