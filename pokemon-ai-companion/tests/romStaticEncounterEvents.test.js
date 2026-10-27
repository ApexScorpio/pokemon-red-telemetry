'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {inspectWorld}=require('../romWorldData');
const {stationaryPokemonEvents}=require('../romStaticEncounterEvents');
const ROMS=[
 ['Pokemon Red.gb','5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'],
 ['Pokemon Blue.gb','2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'],
 ['Pokemon Green International v1.2.1.gb','aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']
];
const expected={83:[1121,1122,1123,1124,1125,1126,1127,1128,1129],162:[2522],194:[1342],227:[2241]};
for(const [filename,sha] of ROMS){
 test('encontros fixos da ROM real: '+filename,{skip:!process.env.POKEMON_ROM_DIR},()=>{
   const bytes=fs.readFileSync(path.join(process.env.POKEMON_ROM_DIR,filename));
   assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sha);
   const world=inspectWorld(bytes);
   assert.equal(world.maps.staticEncountersVerified,12);
   assert.equal(world.maps.staticEncounterMapsVerified,4);
   assert.equal(world.maps.trainerEventsVerified,310);
   const profile={hash:{sha256:sha},world};
   for(const [id,events] of Object.entries(expected)){
     const m=world.maps.data[Number(id)];
     assert.deepEqual(m.staticEncounterEvents.map(x=>x.eventBitIndex),events);
     for(const e of m.staticEncounterEvents){
       const p=m.objects.objects[e.objectOrdinal-1];
       assert.equal(p.kind,'wildPokemon');
       assert.equal(p.wildSpeciesInternalId,e.speciesInternalId);
     }
     const flags=Array(320).fill('00');
     const last=events.at(-1);
     flags[last>>3]=(1<<(last&7)).toString(16).padStart(2,'0');
     const found=stationaryPokemonEvents(profile,m,flags);
     assert.equal(found.verified,true);
     assert.equal(found.entries.at(-1).encounterGateClosed,true);
     assert.ok(found.entries.every(e=>e.captured===null));
   }
 });
}
test('um Pokémon fixo NÃO é treinador; o bit não prova captura',()=>{
 const flag=Array(320).fill('00');
 flag[1129>>3]=(1<<(1129&7)).toString(16).padStart(2,'0');
 const profile={hash:{sha256:ROMS[0][1]}};
 const objects=Array.from({length:9},(_,i)=>({
   kind:'trainer',trainerClassOrItemId:[6,6,6,141,6,6,141,6,75][i],
   trainerNumberOrLevel:i===8?50:(i===3||i===6)?43:40
 }));
 const oldJson={valid:true,mapId:83,objects:{objects}};
 const current=stationaryPokemonEvents(profile,oldJson,flag);
 assert.equal(current.verified,true);
 assert.equal(current.entries.length,9);
 assert.equal(current.entries[8].eventFlagSet,true);
 assert.equal(current.entries[8].captured,null);
 assert.equal(stationaryPokemonEvents({hash:{sha256:'0'.repeat(64)}},oldJson,flag).verified,false);
});
