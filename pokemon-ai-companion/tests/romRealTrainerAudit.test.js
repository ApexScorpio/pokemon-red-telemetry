'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectWorld}=require('../romWorldData');
const {trainerFlagsForCurrentMap}=require('../romTrainerEvents');
const CASES=[
 ['Pokemon Red.gb','5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'],
 ['Pokemon Blue.gb','2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'],
 ['Pokemon Green International v1.2.1.gb','aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']
];
for(const [filename,expectedSha] of CASES){
 test('auditoria real ROM: '+filename,{skip:!process.env.POKEMON_ROM_DIR},()=>{
   const rom=fs.readFileSync(path.join(process.env.POKEMON_ROM_DIR,filename));
   assert.equal(crypto.createHash('sha256').update(rom).digest('hex'),expectedSha);
   const world=inspectWorld(rom);
   assert.equal(world.maps.valid,true);
   assert.equal(world.maps.trainerEventsVerified,310);
   const profile={hash:{sha256:expectedSha},world};
   let human=0,linked=0,normal=0;
   const flags=Array(320).fill('00');
   for(const map of world.maps.data){
     if(!map.valid)continue;
     const people=map.objects.objects.filter(o=>o.kind==='trainer'&&
       o.trainerClassOrItemId>=201);
     human+=people.length;
     normal+=map.trainerEvents.length;
     const result=trainerFlagsForCurrentMap(profile,map,flags);
     if(result.verified)linked+=result.entries.length;
   }
   assert.equal(human,334);
   assert.equal(normal,310);
   assert.equal(linked,332);
   const route6=world.maps.data[17];
   const actual=trainerFlagsForCurrentMap(profile,route6,flags);
   assert.deepEqual(actual.entries.map(x=>x.eventBitIndex),
     [1041,1042,1043,1044,1045,1046]);
   // Os scripts especiais da S.S. Anne e Game Corner não incluem
   // cabeçalhos normais de treinador: não inventar vitória ou bit.
   for(const mapId of [96,135]){
     const unresolved=trainerFlagsForCurrentMap(profile,world.maps.data[mapId],flags);
     assert.equal(unresolved.verified,false);
   }
 });
}
