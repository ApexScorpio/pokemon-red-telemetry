'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {matchLiveActorsToAuditedRom}=require('../romLiveActorIdentity');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const SHA=AUDITED_ROM_SHA256.RED;
const item={mapId:15,objectOrdinal:1,kind:'item',
 x:4,y:3,pictureId:61,itemId:17,itemName:'Potion',
 source:'OBJETO_DEFINIDO_NA_ROM_COM_CRC32_CORRESPONDENTE',
 existsInRom:true,observedInRam:true,removedFromMap:null};
const trainer={mapId:15,objectOrdinal:2,kind:'trainer',
 x:5,y:3,pictureId:5,trainerClassId:212,trainerNumber:2,
 trainerClassName:'Bug Catcher',
 source:'OBJETO_DEFINIDO_NA_ROM_COM_CRC32_CORRESPONDENTE',
 existsInRom:true,observedInRam:true,removedFromMap:null};
const sprite=(i,x,y,pictureId,isItem,isTrainer)=>({
 spriteIndex:i,x,y,pictureId,isItem,isTrainer,
 name:'generic RAM sprite'});
const original=[
 sprite(1,4,3,61,true,false),
 sprite(2,5,3,5,false,true)
];
const good=()=>({
 entities:original.map(o=>({...o})),
 romAreaEvidence:{verified:true,mapId:15,items:[{...item}],
  trainers:[{...trainer}]},
 mapId:15,romSha256:SHA,romIdentityMatched:true,
 spritesVerified:true,positionVerified:true
});
test('exact RAM sprite ordinal and ROM object identifies item without claiming pickup',()=>{
 const r=matchLiveActorsToAuditedRom(good());
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.identifiedItems,1);assert.equal(r.identifiedTrainers,1);
 assert.equal(r.entities[0].itemId,17);
 assert.equal(r.entities[0].itemName,'Potion');
 assert.equal(r.entities[0].romObjectOrdinal,1);
 assert.equal(r.entities[0].romActorIdentityVerified,true);
 assert.equal(r.entities[0].isCollected,null);
 assert.equal(r.entities[0].collectionCertified,false);
 assert.equal(r.gameplayCollectionCertified,false);
});
test('trainer requires ROM identity and cannot gain invented victory',()=>{
 const r=matchLiveActorsToAuditedRom(good());
 const e=r.entities[1];
 assert.equal(e.romActorIdentityVerified,true);
 assert.equal(e.trainerClassId,212);
 assert.equal(e.trainerNumber,2);
 assert.equal(e.trainerName,'Bug Catcher');
 assert.equal(e.name,'⚔️ Bug Catcher');
 assert.equal(e.isDefeated,null);
 assert.equal(e.victoryCertified,false);
 assert.equal(r.gameplayVictoryCertified,false);
});
test('nearby item cannot label a different RAM item (old radius 2 error)',()=>{
 const x=good();x.entities[0].x=5;
 const r=matchLiveActorsToAuditedRom(x);
 assert.equal(r.verified,true);
 assert.equal(r.identifiedItems,0);
 assert.equal(r.entities[0].name,'generic RAM sprite');
 assert.equal(r.entities[0].romActorIdentityVerified,false);
});
test('nearby unrelated NPC cannot be promoted to trainer (old radius 4 error)',()=>{
 const x=good();
 x.entities[1]=sprite(3,6,3,5,false,false);
 const r=matchLiveActorsToAuditedRom(x);
 assert.equal(r.verified,true);
 assert.equal(r.identifiedTrainers,0);
 assert.equal(r.entities[1].isTrainer,false);
 assert.equal(r.entities[1].name,'generic RAM sprite');
});
test('picture mismatch or ordinal mismatch never invents object identity',()=>{
 for(const change of [
  e=>e.pictureId=62,e=>e.spriteIndex=3,e=>e.y=9
 ]){
  const x=good();change(x.entities[0]);
  const r=matchLiveActorsToAuditedRom(x);
  assert.equal(r.verified,true);
  assert.equal(r.identifiedItems,0);
 }
});
test('ROM observation explicitly false or ROM removal true denies identity',()=>{
 for(const change of [
  r=>r.observedInRam=false,
  r=>r.observedInRam=null,
  r=>r.removedFromMap=true
 ]){
  const x=good();change(x.romAreaEvidence.items[0]);
  const r=matchLiveActorsToAuditedRom(x);
  assert.equal(r.verified,true);
  assert.equal(r.identifiedItems,0);
 }
});
test('same RAM sprite cannot be identified twice',()=>{
 const x=good();x.entities.push({...x.entities[0]});
 const r=matchLiveActorsToAuditedRom(x);
 assert.equal(r.verified,true);
 assert.equal(r.identifiedItems,1);
 assert.equal(r.entities[2].romActorIdentityVerified,false);
});
test('unverified SHA, map, sprites or position fails closed',()=>{
 const changes=[
  x=>x.romIdentityMatched=false,
  x=>x.romSha256='0'.repeat(64),
  x=>x.mapId=16,
  x=>x.spritesVerified=false,
  x=>x.positionVerified=false,
  x=>x.romAreaEvidence.verified=false,
  x=>x.romAreaEvidence.mapId=16
 ];
 for(const change of changes){
  const x=good();change(x);
  const r=matchLiveActorsToAuditedRom(x);
  assert.equal(r.verified,false);
  assert.equal(r.identifiedItems,0);
  assert.equal(r.identifiedTrainers,0);
  assert.equal(r.entities[0].romActorIdentityVerified,false);
 }
});
test('duplicate ROM object ordinals or malformed actor data fail closed',()=>{
 for(const change of [
  x=>x.romAreaEvidence.trainers[0].objectOrdinal=1,
  x=>x.romAreaEvidence.items[0].source='MANUAL_REFERENCE',
  x=>x.romAreaEvidence.items[0].pictureId=null
 ]){
  const x=good();change(x);
  const r=matchLiveActorsToAuditedRom(x);
  assert.equal(r.verified,false);
  assert.equal(r.entities[0].romActorIdentityVerified,false);
 }
});
test('client integrates ROM identity matching, removing both proximity heuristics',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const client=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 assert.match(client,/const identifiedActors=matchLiveActorsToAuditedRom\(\{/);
 assert.match(client,/this\.latestState\.mapEntities=identifiedActors\.entities/);
 assert.match(client,/romLiveActorIdentification=\{/);
 assert.doesNotMatch(client,/Math\.abs\(it\.x - ent\.x\) <= 2/);
 assert.doesNotMatch(client,/dist <= 4 && dist < bestDist/);
});

test('actual ROM area evidence producer to live identity consumer contract',()=>{
 const {buildRomAreaEvidence}=require('../romAreaEvidence');
 const sourceMap={valid:true,mapId:15,objects:{objects:[
  {kind:'item',x:4,y:3,spriteId:61,trainerClassOrItemId:17},
  {kind:'trainer',x:5,y:3,spriteId:5,
   trainerClassOrItemId:212,trainerNumberOrLevel:2}
 ]}};
 const sample=original.map(e=>({...e}));
 const source=buildRomAreaEvidence(sourceMap,sample,{17:'Potion'},
  {romIdentityMatched:true,spritesVerified:true});
 assert.equal(source.verified,true);
 assert.equal(source.items[0].observedInRam,true);
 assert.equal(source.trainers[0].observedInRam,true);
 const r=matchLiveActorsToAuditedRom({...good(),entities:sample,
   romAreaEvidence:source});
 assert.equal(r.verified,true);
 assert.equal(r.identifiedItems,1);
 assert.equal(r.identifiedTrainers,1);
 assert.equal(r.entities[0].romActorIdentityVerified,true);
 assert.equal(r.entities[1].romActorIdentityVerified,true);
 assert.equal(r.entities[0].isCollected,null);
 assert.equal(r.entities[1].isDefeated,null);
});
test('ROM evidence with no validated sprites cannot identify RAM actors',()=>{
 const {buildRomAreaEvidence}=require('../romAreaEvidence');
 const map={valid:true,mapId:15,objects:{objects:[
  {kind:'item',x:4,y:3,spriteId:61,trainerClassOrItemId:17}
 ]}};
 const p=buildRomAreaEvidence(map,original,{17:'Potion'},
   {romIdentityMatched:true,spritesVerified:false});
 assert.equal(p.verified,true);
 assert.equal(p.items[0].observedInRam,null);
 const r=matchLiveActorsToAuditedRom({...good(),
   romAreaEvidence:p});
 assert.equal(r.identifiedItems,0);
 assert.equal(r.gameplayCollectionCertified,false);
});
