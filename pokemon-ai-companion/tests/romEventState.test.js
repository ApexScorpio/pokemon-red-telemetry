'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {decodeToggleables,decodeHiddenItems,decodeHiddenCoins,fromKnownRom}=require('../romEventState');
const {buildRomAreaEvidence}=require('../romAreaEvidence');
const HASHES=[
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
];
test('as 54 coordenadas extraídas da ROM são iguais nestas três versões auditadas',()=>{
 for(const sha256 of HASHES){
  const coords=fromKnownRom({hash:{sha256}});
  assert.equal(coords.length,54);
  assert.deepEqual(coords[53],{hiddenIndex:53,mapId:15,y:3,x:40});
  assert.deepEqual(coords[0],{hiddenIndex:0,mapId:51,y:18,x:1});
 }
 assert.equal(fromKnownRom({hash:{sha256:'0'.repeat(64)}}),null);
});
test('Route 4 item oculto (40,3) é obtido pela flag RAM de índice 53',()=>{
 const flags=Array(14).fill('00');
 flags[6]='20'; // bit 53
 const got=decodeHiddenItems({hash:{sha256:HASHES[0]}},15,flags);
 assert.equal(got.verified,true);
 assert.equal(got.items.length,1);
 assert.equal(got.items[0].x,40);
 assert.equal(got.items[0].y,3);
 assert.equal(got.items[0].isCollected,true);
 assert.equal(got.items[0].itemId,3); // ROM HiddenEventScript: Great Ball
 const named=decodeHiddenItems({hash:{sha256:HASHES[0]}},15,flags,{3:'Great Ball'});
 assert.equal(named.items[0].itemName,'Great Ball');
 assert.equal(named.items[0].itemNameSource,'ID_EXTRAÍDO_DA_ROM_NOME_DE_REFERÊNCIA');
 flags[6]='00';
 assert.equal(decodeHiddenItems({hash:{sha256:HASHES[0]}},15,flags).items[0].isCollected,false);
});
test('lista RAM D5CE associa o índice do objeto ao bit de D5A6, não à mochila',()=>{
 const flags=Array(32).fill('00');flags[1]='08';
 const raw=Array(34).fill('00');
 raw[0]='02';raw[1]='0B';raw[2]='05';raw[3]='0C';raw[4]='FF';
 const out=decodeToggleables(flags,raw);
 assert.equal(out.verified,true);
 assert.deepEqual(out.entries.map(x=>x.removedFromMap),[true,false]);
 assert.equal(out.entries[0].globalFlagIndex,11);
 assert.equal(decodeToggleables(flags.slice(1),raw).verified,false);
});
test('um objeto removido NÃO prova captura, recolha nem vitória',()=>{
 const flags=Array(32).fill('00');flags[1]='08';
 const raw=Array(34).fill('00');raw[0]='01';raw[1]='0B';raw[2]='FF';
 const toggleables=decodeToggleables(flags,raw);
 const fakeMap={valid:true,mapId:15,objects:{objects:[
  {kind:'item',x:40,y:3,spriteId:61,trainerClassOrItemId:4}
 ]}};
 const out=buildRomAreaEvidence(fakeMap,[],{},{
   romIdentityMatched:true,spritesVerified:true,toggleables
 });
 assert.equal(out.verified,true);
 assert.equal(out.items[0].removedFromMap,true);
 assert.equal(out.items[0].collected,null);
 assert.equal(out.items[0].defeated,null);
 assert.equal(out.items[0].observedInRam,false);
});


test('os três cartuchos comprovam os IDs dos objetos escondidos, não nomes manuais',()=>{
 const flags=Array(14).fill('00');
 for(const sha256 of HASHES){
  const forest=decodeHiddenItems({hash:{sha256}},51,flags);
  assert.equal(forest.verified,true);
  assert.deepEqual(forest.items.map(x=>x.itemId),[20,11]); // Potion, Antidote
  const mtMoon=decodeHiddenItems({hash:{sha256}},61,flags);
  assert.deepEqual(mtMoon.items.map(x=>x.itemId),[10,80]); // Moon Stone, Ether
 }
});

test('12 moedas ocultas do Game Corner: quantidade ROM e bitmap RAM independentes',()=>{
 for(const sha256 of HASHES){
  const flags=Array(2).fill('00');
  flags[1]='08'; // bit 11, última moeda
  const result=decodeHiddenCoins({hash:{sha256}},135,flags);
  assert.equal(result.verified,true);
  assert.equal(result.coins.length,12);
  assert.deepEqual(result.coins.map(x=>x.coinAmount),[
    10,10,20,10,10,20,10,10,10,40,100,10
  ]);
  assert.equal(result.coins.filter(x=>x.isCollected).length,1);
  assert.equal(result.coins[11].isCollected,true);
  assert.equal(result.coins[0].isCollected,false);
  assert.equal(decodeHiddenCoins({hash:{sha256}},15,flags).coins.length,0);
 }
 assert.equal(decodeHiddenCoins({hash:{sha256:'0'.repeat(64)}},135,['00','00']).verified,false);
 assert.equal(decodeHiddenCoins({hash:{sha256:HASHES[0]}},135,['00']).verified,false);
});
