'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const {findGen1TypeMatchups}=require('../romTypeMatchups');
const ROMS=[
 ['Red','POKEMON_RED_ROM','5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'],
 ['Blue','POKEMON_BLUE_ROM','2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'],
 ['Green International v1.2.1','POKEMON_GREEN_ROM','aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']
];
const tableSha='e55fa25d775c0020e2d36313983584cfbb250b9d0007a9c3cbf24a199a65aba4';
for(const [name,key,sha] of ROMS){
 test('TypeEffects ROM real '+name,{skip:!process.env[key]?'Ficheiro ROM não fornecido por variável de ambiente':false},()=>{
  const bytes=fs.readFileSync(process.env[key]);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sha);
  const table=findGen1TypeMatchups(bytes);
  assert.equal(table.verified,true);
  assert.equal(table.offset,0x3E474);
  assert.equal(table.bank,15);
  assert.equal(table.recordCount,82);
  const raw=bytes.subarray(table.offset,table.offset+247);
  assert.equal(raw.at(-1),255);
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),tableSha);
  const rows=table.orderedTypeRulesFromRom;
  const factor=(attack,defense)=>rows.find(r=>
    r.attackType===attack&&r.defenderType===defense)?.multiplier;
  assert.equal(factor(8,24),0);  // Ghost -> Psychic, bug da Gen I.
  assert.equal(factor(0,8),0);   // Normal -> Ghost.
  assert.equal(factor(7,3),20);  // Bug -> Poison.
  assert.equal(factor(3,7),20);  // Poison -> Bug.
  assert.equal(factor(20,25),20);// Fire -> Ice.
  assert.equal(new Set(rows.map(r=>r.attackType+':'+r.defenderType)).size,82);
 });
}
test('recusa ROM inválida e TypeEffects ausente',()=>{
 assert.equal(findGen1TypeMatchups(null).verified,false);
 assert.equal(findGen1TypeMatchups(Buffer.alloc(0x4000)).verified,false);
});
test('recusa TypeEffects ambígua ou sem terminador',()=>{
 const data=Buffer.alloc(0x80000);
 const start=0x34000;
 const head=[[21,20,20],[20,22,20],[20,25,20],[22,21,20],
   [23,21,20],[21,5,20],[4,2,0]];
 const seen=new Set(head.map(row=>row[0]+':'+row[1]));
 const rows=[...head];
 for(const a of [21,20,22,23,4,0,8,7,3,25,24,2,5,26,1]){
  for(const b of [20,22,25,21,2,5,4,7,8,24,3,23,1,26,0]){
   if(rows.length===82)break;
   if(seen.has(a+':'+b))continue;
   rows.push([a,b,20]);seen.add(a+':'+b);
  }
 }
 for(let i=0;i<82;i++)Buffer.from(rows[i]).copy(data,start+i*3);
 data[start+246]=255;
 assert.equal(findGen1TypeMatchups(data).verified,true);
 const broken=Buffer.from(data);
 broken[start+246]=0;
 assert.equal(findGen1TypeMatchups(broken).verified,false);
 data.copy(data,0x44000,start,start+247);
 assert.equal(findGen1TypeMatchups(data).verified,false);
});
