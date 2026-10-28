'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const {findGen1EncounterWeights}=require('../romEncounterWeights');
const HEX='320065028c04a506be08d70ae40cf10efc10ff12';
const SHA='cc7c8d55c379dd3bfcefd538aff7db3b479a9df12c5013469e8af40e4f1b6009';
const expected=[51,51,39,25,25,25,13,13,11,3];
function sample(offset=0x12000){
 const b=Buffer.alloc(0x20000);
 Buffer.from(HEX,'hex').copy(b,offset);
 return b;
}
test('10 pesos e limiares são derivados de 20 bytes ROM, somando 256',()=>{
 const data=findGen1EncounterWeights(sample());
 assert.equal(data.verified,true);
 assert.equal(data.offset,0x12000);
 assert.deepEqual(data.weights,expected);
 assert.equal(data.thresholdsInclusive.at(-1),255);
 assert.equal(data.weights.reduce((a,b)=>a+b,0),256);
});
test('a ROM pode mudar pesos finais, se os limiares continuarem válidos',()=>{
 const bytes=sample();bytes[0x12000+12]=229; // slot7 passa 14, slot8 12
 const data=findGen1EncounterWeights(bytes);
 assert.equal(data.verified,true);
 assert.equal(data.weights[6],14);
 assert.equal(data.weights[7],12);
});
test('tabela ambígua, truncada ou inválida é recusada',()=>{
 const a=sample();Buffer.from(HEX,'hex').copy(a,0x14000);
 assert.equal(findGen1EncounterWeights(a).verified,false);
 const b=sample();b[0x12000+19]=17;
 assert.equal(findGen1EncounterWeights(b).verified,false);
 assert.equal(findGen1EncounterWeights(null).verified,false);
 assert.equal(findGen1EncounterWeights(Buffer.alloc(0x4000)).verified,false);
});
for (const [name,env,sha] of [
 ['Red','POKEMON_RED_ROM','5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'],
 ['Blue','POKEMON_BLUE_ROM','2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'],
 ['Green International','POKEMON_GREEN_ROM','aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']
]){
 test(name+' real ROM WildMonEncounterSlotChances',{skip:!process.env[env]?'ROM não disponível neste ambiente':false},()=>{
  const b=fs.readFileSync(process.env[env]);
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),sha);
  const result=findGen1EncounterWeights(b);
  assert.equal(result.verified,true);
  assert.equal(result.offset,0x13918);
  assert.equal(result.rawHex,HEX);
  assert.deepEqual(result.weights,expected);
  assert.equal(crypto.createHash('sha256').update(b.subarray(result.offset,result.offset+20)).digest('hex'),SHA);
 });
}
