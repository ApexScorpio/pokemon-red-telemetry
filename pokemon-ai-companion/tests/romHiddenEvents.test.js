'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {extractHiddenItemsFromRom}=require('../romHiddenEvents');
const {decodeHiddenItems}=require('../romEventState');
const FIXTURES=[
 ['Pokemon Red.gb','5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b','6688','766b8'],
 ['Pokemon Blue.gb','2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d','6689','766b9'],
 ['Pokemon Green International v1.2.1.gb','aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db','668a','766ba']
];
test('não aceitar ficheiro sem as tabelas ROM exigidas',()=>{
 assert.equal(extractHiddenItemsFromRom(Buffer.alloc(32768)).valid,false);
 assert.equal(extractHiddenItemsFromRom(Buffer.from([0,1,2])).valid,false);
});
for(const [name,sha256,handlerHex,coordHex] of FIXTURES){
 test('54 itens e respetivos IDs da ROM real '+name,{skip:!process.env.POKEMON_ROM_DIR},()=>{
  const rom=fs.readFileSync(path.join(process.env.POKEMON_ROM_DIR,name));
  assert.equal(crypto.createHash('sha256').update(rom).digest('hex'),sha256);
  const parsed=extractHiddenItemsFromRom(rom);
  assert.equal(parsed.valid,true,parsed.reason);
  assert.equal(parsed.items.length,54);
  assert.equal(parsed.totalEvents,217);
  assert.equal(parsed.eventMapTable.fileOffset,0x46a40);
  assert.equal(parsed.coordinateTable.fileOffset,parseInt(coordHex,16));
  assert.equal(parsed.hiddenItemHandler.cpuAddress,parseInt(handlerHex,16));
  assert.equal(parsed.hiddenCoins.valid,true);
  assert.equal(parsed.hiddenCoins.coins.length,12);
  assert.equal(parsed.hiddenCoins.fortyCoinBranchVerified,true,
    'O ramo cp 40 -> 20 deve existir no executável da ROM');
  assert.equal(parsed.hiddenCoins.coins[9].coinAmount,40);
  assert.equal(parsed.hiddenCoins.coins[9].actualAwardIfClaimed,20);
  assert.deepEqual(parsed.hiddenCoins.coins.map(x=>x.coinAmount),
    [10,10,20,10,10,20,10,10,10,40,100,10]);
  assert.deepEqual(parsed.items[53],{hiddenIndex:53,mapId:15,y:3,x:40,itemId:3});
  const profile={hash:{sha256},world:{hiddenItemScripts:parsed}};
  const flags=Array(14).fill('00');
  flags[6]='20';
  const got=decodeHiddenItems(profile,15,flags,{3:'Great Ball'});
  assert.equal(got.verified,true);
  assert.equal(got.items[0].itemId,3);
  assert.equal(got.items[0].itemName,'Great Ball');
  assert.equal(got.items[0].isCollected,true);
  flags[6]='00';
  assert.equal(decodeHiddenItems(profile,15,flags).items[0].isCollected,false);
  const changed=Buffer.from(rom);
  changed[parsed.coordinateTable.fileOffset+53*3+1]=0xff;
  assert.equal(extractHiddenItemsFromRom(changed).valid,false);
 });
}
test('tabela de novos perfis deve corresponder ao SHA do próprio perfil',()=>{
 const sha='8'.repeat(64);
 const records=Array.from({length:54},(_,i)=>({hiddenIndex:i,mapId:15,y:1,x:i,itemId:10}));
 const flags=Array(14).fill('00');
 const profile={hash:{sha256:sha},world:{hiddenItemScripts:{valid:true,sha256:sha,items:records}}};
 assert.equal(decodeHiddenItems(profile,15,flags).verified,true);
 profile.world.hiddenItemScripts.sha256='9'.repeat(64);
 assert.equal(decodeHiddenItems(profile,15,flags).verified,false);
});
