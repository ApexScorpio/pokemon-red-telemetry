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
  verified:false,mapId,identifiedItems:0,identifiedTrainers:0,
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
  if(!e||(!e.isItem&&!e.isTrainer)||!id(e.spriteIndex)||
     !xy(e.x)||!xy(e.y)||!Number.isSafeInteger(e.pictureId))
   return out;
  const kind=e.isItem===true?'item':e.isTrainer===true?'trainer':null;
  const candidates=objects.filter(o=>
   o.kind===kind&&o.objectOrdinal===e.spriteIndex&&
   o.x===e.x&&o.y===e.y&&o.pictureId===e.pictureId&&
   o.observedInRam===true&&
   o.removedFromMap!==true);
  if(candidates.length!==1||used.has(candidates[0].objectOrdinal))
   return out;
  const match=candidates[0];
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
  unidentifiedSprites:enriched.length-identifiedItems-identifiedTrainers,
  entities:enriched,identityMethod:'EXACT_OBJECT_ORDINAL_X_Y_PICTURE_RAM',
  manualProximityUsed:false,gameplayVictoryCertified:false,
  gameplayCollectionCertified:false};
}
module.exports={matchLiveActorsToAuditedRom};
