'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildRomAreaEvidence}=require('../romAreaEvidence');

const map={valid:true,mapId:6,objects:{objects:[
  {kind:'item',x:4,y:7,spriteId:61,trainerClassOrItemId:17},
  {kind:'trainer',x:10,y:5,spriteId:7,trainerClassOrItemId:12,trainerNumberOrLevel:2},
  {kind:'npc',x:9,y:8,spriteId:8}
]}};
const live=[
  {x:4,y:7,pictureId:61,isItem:true},
  {x:10,y:5,pictureId:7,isTrainer:true},
  {x:9,y:8,pictureId:8,isItem:false,isTrainer:false}
];

test('objeto item da ROM visto na RAM não significa já apanhado',()=>{
 const r=buildRomAreaEvidence(map,live,{17:'Potion'},
   {romIdentityMatched:true,spritesVerified:true});
 assert.equal(r.verified,true);
 assert.equal(r.items[0].itemId,17);
 assert.equal(r.items[0].itemName,'Potion');
 assert.equal(r.items[0].observedInRam,true);
 assert.equal(r.items[0].collected,null);
 assert.equal(r.trainers[0].defeated,null);
 assert.equal(r.trainers[0].trainerClassId,12);
 assert.equal(r.trainers[0].trainerNumber,2);
 assert.equal(r.npcs.length,1);
});

test('se faltar sprite na RAM, NÃO afirmar recolha/derrota',()=>{
 const r=buildRomAreaEvidence(map,[],{17:'Potion'},
   {romIdentityMatched:true,spritesVerified:true});
 assert.equal(r.items[0].observedInRam,false);
 assert.equal(r.items[0].collected,null);
 assert.equal(r.trainers[0].defeated,null);
 assert.match(r.items[0].visibilitySource,/NÃO_PROVA_CONCLUSÃO/);
});

test('não associar outros NPCs por mera proximidade',()=>{
 const others=[{x:4,y:7,pictureId:8,isItem:false,isTrainer:false},
   {x:11,y:5,pictureId:6,isTrainer:true}];
 const r=buildRomAreaEvidence(map,others,{},{
   romIdentityMatched:true,spritesVerified:true});
 assert.equal(r.items[0].observedInRam,false);
 assert.equal(r.trainers[0].observedInRam,false);
});

test('sem perfil CRC32 e RAM validada não afirmar objetos ou presença',()=>{
 const unmatched=buildRomAreaEvidence(map,live,{},{
   romIdentityMatched:false,spritesVerified:true});
 assert.equal(unmatched.verified,false);
 const noRam=buildRomAreaEvidence(map,live,{},{
   romIdentityMatched:true,spritesVerified:false});
 assert.equal(noRam.verified,true);
 assert.equal(noRam.items[0].observedInRam,null);
 const noMap=buildRomAreaEvidence(null,live,{},{
   romIdentityMatched:true,spritesVerified:true});
 assert.equal(noMap.verified,false);
});
