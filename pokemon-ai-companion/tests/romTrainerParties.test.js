'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {parseTrainerParties,parseTrainerClassNames,fallbackForKnownProfile,getTrainerParty}=require('../romTrainerParties');
const SHA={
 red:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 blue:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 green:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
};
const FILENAMES={
 red:'Pokemon Red.gb',
 blue:'Pokemon Blue.gb',
 green:'Pokemon Green International v1.2.1.gb'
};
function auditedProfile(){
 const species=Array.from({length:190},(_,i)=>({internalId:i+1,name:'SPECIES '+(i+1),dex:0}));
 species[168]={internalId:169,name:'GEODUDE',dex:74};
 species[33]={internalId:34,name:'ONIX',dex:95};
 species[26]={internalId:27,name:'STARYU',dex:120};
 species[151]={internalId:152,name:'STARMIE',dex:121};
 return {hash:{sha256:SHA.red},species};
}
test('atlas alternativo exige SHA-256 específico e contém 47 classes e 415 equipas',()=>{
 const profile=auditedProfile();
 const table=fallbackForKnownProfile(profile);
 assert.equal(table.verified,true);
 assert.equal(table.classCount,47);
 assert.equal(table.teamCount,415);
 assert.equal(table.rosters.length,47);
 assert.equal(fallbackForKnownProfile({hash:{sha256:'0'.repeat(64)}}),null);
 assert.deepEqual(table.rosters[33][0],[[169,12],[34,14]]);
 assert.deepEqual(table.rosters[34][0],[[27,18],[152,21]]);
});
test('o Companion devolve equipa de Brock e Misty sem inferir vitórias',()=>{
 const profile=auditedProfile();
 const brock=getTrainerParty(profile,234,1);
 const misty=getTrainerParty(profile,235,1);
 assert.equal(brock.className,'BROCK');
 assert.equal(misty.className,'MISTY');
 assert.deepEqual(brock.team.map(x=>[x.name,x.level]),
   [['GEODUDE',12],['ONIX',14]]);
 assert.deepEqual(misty.team.map(x=>[x.name,x.level]),
   [['STARYU',18],['STARMIE',21]]);
 assert.equal(getTrainerParty(profile,200,1),null);
 assert.equal(getTrainerParty(profile,234,99),null);
 assert.equal(getTrainerParty({hash:{sha256:'0'.repeat(64)}},234,1),null);
});
for(const [version,file] of Object.entries(FILENAMES)){
 test('a ROM '+version+' produz 415 equipas a partir dos seus bytes',{
   skip:!process.env.POKEMON_ROM_DIR
 },()=>{
  const bytes=fs.readFileSync(path.join(process.env.POKEMON_ROM_DIR,file));
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash,SHA[version]);
  const result=parseTrainerParties(bytes);
  assert.equal(result.verified,true);
  assert.equal(result.classCount,47);
  assert.equal(result.teamCount,415);
  assert.equal(result.pointerTableFileOffset,0x39d3b);
  assert.deepEqual(result.rosters[33][0],[[169,12],[34,14]]);
  assert.deepEqual(result.rosters[34][0],[[27,18],[152,21]]);
  const named=parseTrainerClassNames(bytes);
  assert.equal(named.verified,true);
  assert.equal(named.names.length,47);
  assert.equal(named.names[33],'BROCK');
  assert.equal(named.names[34],'MISTY');
  assert.equal(result.classNames[33],'BROCK');
  assert.equal(result.classNames[34],'MISTY');
  assert.deepEqual(result.rosters,fallbackForKnownProfile({hash:{sha256:hash}}).rosters);
 });
}
test('a equipa do rival é dependente do inicial e não é assumida por número do objeto',()=>{
 const p=auditedProfile();
 for(const trainerClassId of [225,242,243]){
  const result=getTrainerParty(p,trainerClassId,1);
  assert.equal(result.variantDependent,true);
  assert.equal(result.team,null);
  assert.match(result.source,/VARIANTE/);
 }
});

test('uma ROM truncada não pode produzir formações',()=>{
 assert.equal(parseTrainerParties(Buffer.alloc(200)).verified,false);
 assert.equal(parseTrainerParties(Buffer.alloc(2*16384)).verified,false);
});