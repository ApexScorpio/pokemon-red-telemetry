'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildRomAreaEvidence}=require('../romAreaEvidence');
const {matchLiveActorsToAuditedRom}=require('../romLiveActorIdentity');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const sha=AUDITED_ROM_SHA256.RED;
const romObj=(kind='trainer',movement=0xfe,picture=23)=>({
 kind,spriteId:picture,x:7,y:8,movement,
 trainerClassOrItemId:kind==='trainer'?212:kind==='item'?17:null,
 trainerNumberOrLevel:1
});
const ram=(x=8,y=8,picture=23)=>({
 spriteIndex:1,x,y,pictureId:picture,
 isItem:false,isTrainer:false,type:'boss',name:'Graphic only'
});
function sample({kind='trainer',movement=0xfe,romPic=23,
  live=[ram()],romIdentityMatched=true,spritesVerified=true,
  positionVerified=true,removedFromMap=null}={}){
 const map={valid:true,mapId:15,objects:{objects:[
  romObj(kind,movement,romPic)
 ]}};
 const entries=Array.isArray(live)?live:[live];
 const toggleables=removedFromMap===null?null:{
  verified:true,entries:[{spriteIndex:1,removedFromMap,source:'TEST_FLAG'}]
 };
 const evidence=buildRomAreaEvidence(map,entries,{17:'Potion'},{
  romIdentityMatched,spritesVerified,toggleables
 });
 const identified=matchLiveActorsToAuditedRom({
  entities:entries,romAreaEvidence:evidence,mapId:15,
  romSha256:sha,romIdentityMatched,spritesVerified,positionVerified
 });
 return {evidence,identified};
}
test('ROM WALK trainer with displaced RAM tile is only a movement candidate',()=>{
 const {evidence,identified}=sample();
 assert.equal(evidence.trainers[0].movementByte,0xfe);
 assert.equal(evidence.trainers[0].observedInRam,null);
 assert.equal(evidence.trainers[0].movementCandidate.possible,true);
 assert.equal(evidence.trainers[0].movementCandidate.verified,false);
 assert.equal(identified.identifiedTrainers,0);
 assert.equal(identified.movingCandidates,1);
 assert.equal(identified.entities[0].romActorIdentityVerified,false);
 assert.equal(identified.entities[0].romActorMovementCandidate.verified,false);
 assert.equal(identified.entities[0].name,'Graphic only');
 assert.equal(identified.gameplayVictoryCertified,false);
});
test('ROM WALK NPC displaced from home is candidate without trainer promotion',()=>{
 const {evidence,identified}=sample({kind:'npc'});
 assert.equal(evidence.npcs[0].observedInRam,null);
 assert.equal(evidence.npcs[0].movementCandidate.possible,true);
 assert.equal(identified.identifiedTrainers,0);
 assert.equal(identified.movingCandidates,0);
});
test('ROM WALK trainer at exact starting tile remains fully verified',()=>{
 const {evidence,identified}=sample({live:[ram(7,8)]});
 assert.equal(evidence.trainers[0].observedInRam,true);
 assert.equal(evidence.trainers[0].movementCandidate,null);
 assert.equal(identified.identifiedTrainers,1);
 assert.equal(identified.movingCandidates,0);
});
test('ROM STAY trainer at different tile is not a candidate',()=>{
 const {evidence,identified}=sample({movement:0xff});
 assert.equal(evidence.trainers[0].observedInRam,false);
 assert.equal(evidence.trainers[0].movementCandidate,null);
 assert.equal(identified.movingCandidates,0);
});
test('ROM movement byte unavailable never invents movement',()=>{
 const {evidence,identified}=sample({movement:null});
 assert.equal(evidence.trainers[0].movementByte,null);
 assert.equal(identified.movingCandidates,0);
});
test('ROM item cannot be moving actor even with WALK byte',()=>{
 const e={...ram(8,8,61),isItem:true,type:'item'};
 const {evidence,identified}=sample({kind:'item',romPic:61,live:[e]});
 assert.equal(evidence.items[0].movementCandidate,null);
 assert.equal(identified.movingCandidates,0);
 assert.equal(identified.identifiedItems,0);
});
test('wrong RAM ordinal blocks moving actor candidate',()=>{
 const {evidence,identified}=sample({live:[{...ram(),spriteIndex:2}]});
 assert.equal(evidence.trainers[0].movementCandidate,null);
 assert.equal(identified.movingCandidates,0);
});
test('wrong RAM picture blocks moving actor candidate',()=>{
 const {evidence,identified}=sample({live:[ram(8,8,24)]});
 assert.equal(evidence.trainers[0].movementCandidate,null);
 assert.equal(identified.movingCandidates,0);
});
test('RAM item flag contradicting trainer blocks movement candidate',()=>{
 const {evidence,identified}=sample({live:[{...ram(),isItem:true}]});
 assert.equal(evidence.trainers[0].movementCandidate,null);
 assert.equal(identified.movingCandidates,0);
});
test('duplicate RAM ordinal is ambiguous not a movement candidate',()=>{
 const e=ram();
 const {evidence,identified}=sample({live:[e,{...e}]});
 assert.equal(evidence.trainers[0].observedInRam,null);
 assert.equal(evidence.trainers[0].movementCandidate,null);
 assert.equal(identified.movingCandidates,0);
});
test('removed object cannot become moving actor candidate',()=>{
 const {evidence,identified}=sample({removedFromMap:true});
 assert.equal(evidence.trainers[0].movementCandidate,null);
 assert.equal(identified.movingCandidates,0);
});
test('unverified ROM, RAM or position never certifies moving actor',()=>{
 for(const opts of [
  {romIdentityMatched:false},{spritesVerified:false},
  {positionVerified:false}
 ]){
  const {evidence,identified}=sample(opts);
  assert.equal(identified.verified,false);
  assert.equal(identified.movingCandidates,0);
  if(opts.romIdentityMatched===false)assert.equal(evidence.verified,false);
 }
});
