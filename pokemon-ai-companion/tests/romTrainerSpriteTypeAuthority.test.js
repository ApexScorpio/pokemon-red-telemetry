'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildRomAreaEvidence}=require('../romAreaEvidence');
const {matchLiveActorsToAuditedRom}=require('../romLiveActorIdentity');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const SHA=AUDITED_ROM_SHA256.RED;
const trainer=(spriteId=23)=>({
 kind:'trainer',x:7,y:8,spriteId,
 trainerClassOrItemId:212,trainerNumberOrLevel:1
});
const npc=(spriteId=23)=>({kind:'npc',x:7,y:8,spriteId});
const item=()=>({kind:'item',x:7,y:8,spriteId:61,trainerClassOrItemId:17});
const live=(pictureId=23)=>({
 spriteIndex:1,x:7,y:8,pictureId,isItem:false,isTrainer:false,
 type:'boss',name:'Graphic appearance only',icon:'👔'
});
const run=(romObject=trainer(),ram=live(),opts={})=>{
 const entries=Array.isArray(ram)?ram:[ram];
 const source={valid:true,mapId:15,objects:{objects:[romObject]}};
 const area=buildRomAreaEvidence(source,entries,{17:'Potion'},{
  romIdentityMatched:true,spritesVerified:true});
 const result=matchLiveActorsToAuditedRom({
  entities:entries,romAreaEvidence:area,mapId:15,romSha256:SHA,
  romIdentityMatched:true,spritesVerified:true,positionVerified:true,
  ...opts
 });
 return {area,result};
};
test('boss sprite with ROM trainer object is identified as trainer',()=>{
 const {area,result}=run();
 assert.equal(area.trainers[0].observedInRam,true);
 assert.equal(result.identifiedTrainers,1);
 assert.equal(result.entities[0].isTrainer,true);
 assert.equal(result.entities[0].type,'trainer');
 assert.equal(result.entities[0].icon,'⚔️');
 assert.equal(result.entities[0].isDefeated,null);
});
test('graphic NPC can be ROM trainer with exact physical evidence',()=>{
 const e={...live(10),type:'npc'};
 const {result}=run(trainer(10),e);
 assert.equal(result.identifiedTrainers,1);
 assert.equal(result.entities[0].romActorIdentityVerified,true);
});
test('unknown sprite graphic can still identify ROM trainer exactly',()=>{
 const e={...live(99),type:'npc',isTrainer:false};
 const {result}=run(trainer(99),e);
 assert.equal(result.identifiedTrainers,1);
});
test('rival graphic can have ROM trainer semantics',()=>{
 const e={...live(2),type:'rival'};
 assert.equal(run(trainer(2),e).result.identifiedTrainers,1);
});
test('NPC with boss graphic is not promoted to a trainer',()=>{
 const {area,result}=run(npc(),live());
 assert.equal(area.npcs[0].observedInRam,true);
 assert.equal(result.identifiedTrainers,0);
 assert.equal(result.entities[0].type,'boss');
});
test('NPC with false trainer graphic classification remains NPC evidence',()=>{
 const e={...live(),type:'trainer',isTrainer:true};
 const {area,result}=run(npc(),e);
 assert.equal(area.npcs[0].observedInRam,true);
 assert.equal(result.identifiedTrainers,0);
});
test('wrong RAM sprite ordinal cannot become ROM trainer',()=>{
 const e={...live(),spriteIndex:2};
 const {area,result}=run(trainer(),e);
 assert.equal(area.trainers[0].observedInRam,false);
 assert.equal(result.identifiedTrainers,0);
});
test('wrong RAM coordinates cannot become ROM trainer',()=>{
 const e={...live(),y:9};
 const {area,result}=run(trainer(),e);
 assert.equal(area.trainers[0].observedInRam,false);
 assert.equal(result.identifiedTrainers,0);
});
test('wrong picture ID cannot become ROM trainer',()=>{
 const e={...live(10)};
 assert.equal(run(trainer(23),e).result.identifiedTrainers,0);
});
test('RAM item marker contradicting ROM trainer is rejected',()=>{
 const e={...live(),isItem:true,type:'item'};
 const {area,result}=run(trainer(),e);
 assert.equal(area.trainers[0].observedInRam,false);
 assert.equal(result.identifiedTrainers,0);
});
test('ROM item still requires RAM item appearance and exact slot',()=>{
 const e={...live(61),isItem:true,type:'item'};
 const {result}=run(item(),e);
 assert.equal(result.identifiedItems,1);
 assert.equal(result.identifiedTrainers,0);
 assert.equal(result.entities[0].type,'item');
 assert.equal(result.entities[0].collectionCertified,false);
});
test('duplicate sprite slots and unknown RAM verification never certify trainer',()=>{
 const e=live();
 const duplicate=run(trainer(),[e,{...e}]);
 assert.equal(duplicate.area.trainers[0].observedInRam,null);
 assert.equal(duplicate.result.identifiedTrainers,0);
 const unavailable=run(trainer(),e,{spritesVerified:false});
 assert.equal(unavailable.result.verified,false);
 assert.equal(unavailable.result.identifiedTrainers,0);
});
