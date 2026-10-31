'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildRomAreaEvidence}=require('../romAreaEvidence');
const {matchLiveActorsToAuditedRom}=require('../romLiveActorIdentity');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const item=(x=4,y=3)=>({kind:'item',x,y,spriteId:61,trainerClassOrItemId:17});
const trainer=(x=5,y=3)=>({kind:'trainer',x,y,spriteId:5,trainerClassOrItemId:212,trainerNumberOrLevel:2});
const npc=(x=6,y=3)=>({kind:'npc',x,y,spriteId:8});
const sprite=(spriteIndex,x,y,pictureId,isItem=false,isTrainer=false)=>({spriteIndex,x,y,pictureId,isItem,isTrainer});
const romMap=()=>({valid:true,mapId:15,objects:{objects:[item(),trainer(),npc()]}});
const sprites=()=>[sprite(1,4,3,61,true),sprite(2,5,3,5,false,true),sprite(3,6,3,8)];
const produce=(entities=sprites(),map=romMap(),options={})=>
 buildRomAreaEvidence(map,entities,{17:'Potion'},{romIdentityMatched:true,spritesVerified:true,...options});
test('item exact ordinal tile picture and kind observed, never collected',()=>{
 const r=produce();assert.equal(r.items[0].observedInRam,true);
 assert.equal(r.items[0].visibilitySource,'RAM_SPRITE_ORDINAL_X_Y_PICTURE_KIND_EXATOS');
 assert.equal(r.items[0].collected,null);
});
test('trainer exact ordinal tile picture and kind observed, never defeated',()=>{
 const r=produce();assert.equal(r.trainers[0].observedInRam,true);assert.equal(r.trainers[0].defeated,null);
});
test('NPC exact ordinal tile picture and kind observed',()=>{
 assert.equal(produce().npcs[0].observedInRam,true);
});
test('trainer one tile away with same picture does not prove presence',()=>{
 const l=sprites();l[1].x=6;const r=produce(l);
 assert.equal(r.trainers[0].observedInRam,false);
 assert.match(r.trainers[0].visibilitySource,/NÃO_PROVA_CONCLUSÃO/);
});
test('item adjacent same picture never proves presence',()=>{
 const l=sprites();l[0].y=4;assert.equal(produce(l).items[0].observedInRam,false);
});
test('missing ordinal cannot be replaced by tile match',()=>{
 const l=sprites();delete l[0].spriteIndex;assert.equal(produce(l).items[0].observedInRam,false);
});
test('different ordinal cannot be replaced by tile match',()=>{
 const l=sprites();l[0].spriteIndex=8;assert.equal(produce(l).items[0].observedInRam,false);
});
test('different picture fails exact matching',()=>{
 const l=sprites();l[1].pictureId=6;assert.equal(produce(l).trainers[0].observedInRam,false);
});
test('different actor kind fails exact matching',()=>{
 const l=sprites();l[1].isTrainer=false;assert.equal(produce(l).trainers[0].observedInRam,false);
});
test('duplicate RAM sprite slot is ambiguous and not inferred collected',()=>{
 const l=sprites();l.push({...l[0]});const r=produce(l);
 assert.equal(r.items[0].observedInRam,null);
 assert.equal(r.items[0].visibilitySource,'RAM_SPRITE_ORDINAL_DUPLICADO_AMBIGUO');
 assert.equal(r.items[0].collected,null);
});
test('identical picture items require distinct ordinal and exact tile',()=>{
 const map={valid:true,mapId:15,objects:{objects:[item(4,3),item(5,3)]}};
 const l=[sprite(1,4,3,61,true),sprite(2,5,3,61,true)];
 assert.deepEqual(produce(l,map).items.map(i=>i.observedInRam),[true,true]);
 const swap=[{...l[0],spriteIndex:2},{...l[1],spriteIndex:1}];
 assert.deepEqual(produce(swap,map).items.map(i=>i.observedInRam),[false,false]);
});
test('unverified RAM/ROM and downstream matcher fail closed',()=>{
 const noRam=produce(sprites(),romMap(),{spritesVerified:false});
 assert.equal(noRam.items[0].observedInRam,null);
 assert.equal(produce(sprites(),romMap(),{romIdentityMatched:false}).verified,false);
 const l=sprites();l[1].x=6;const area=produce(l);
 const result=matchLiveActorsToAuditedRom({entities:l,romAreaEvidence:area,
  mapId:15,romSha256:AUDITED_ROM_SHA256.RED,romIdentityMatched:true,
  spritesVerified:true,positionVerified:true});
 assert.equal(result.verified,true);assert.equal(result.identifiedItems,1);
 assert.equal(result.identifiedTrainers,0);assert.equal(result.gameplayVictoryCertified,false);
});
