'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {captureOpportunities}=require('../romCaptureOpportunities');
const data={mapId:16,grass:{rateByte:15,slots:[
 {dex:43,speciesName:'ODDISH',level:13,rollWeight:51},
 {dex:43,speciesName:'ODDISH',level:15,rollWeight:51},
 {dex:16,speciesName:'PIDGEY',level:13,rollWeight:154}
]},water:{rateByte:0,slots:[]}};
test('cruza espécies, níveis e peso dos slots com Pokédex RAM',()=>{
 const r=captureOpportunities(data,[16],[16,43],{romMatched:true,partyRamVerified:true});
 assert.equal(r.verified,true);
 assert.equal(r.missingSpecies,1);
 const oddish=r.zones[0].species.find(s=>s.dex===43);
 assert.deepEqual(oddish.levels,[13,15]);
 assert.equal(oddish.conditionalChancePercent,39.84);
 assert.equal(oddish.alreadySeen,true);
 assert.equal(oddish.alreadyCaught,false);
});
test('não deduz capturas quando ROM ou Pokédex não está comprovada',()=>{
 assert.equal(captureOpportunities(data,[16],[16,43],{romMatched:false,partyRamVerified:true}).verified,false);
 assert.equal(captureOpportunities(data,[16],[16,43],{romMatched:true,partyRamVerified:false}).verified,false);
});


test('apresenta probabilidades exatas por espécie E por nível, sem converter a probabilidade por passo',()=>{
 const r=captureOpportunities(data,[],[],{romMatched:true,partyRamVerified:true});
 assert.equal(r.verified,true);
 const oddish=r.zones[0].species.find(s=>s.dex===43);
 assert.equal(oddish.conditionalChanceOutOf256,102);
 assert.deepEqual(oddish.byLevel.map(x=>[x.level,x.ways,x.outOf]),[[13,51,256],[15,51,256]]);
 assert.equal(r.zones[0].species.reduce((s,x)=>s+x.conditionalChanceOutOf256,0),256);
});

test('não apresenta percentagens de slots que não totalizam 256 na ROM',()=>{
 const invalid={...data,grass:{...data.grass,slots:[...data.grass.slots.slice(1)]}};
 const r=captureOpportunities(invalid,[],[],{romMatched:true,partyRamVerified:true});
 assert.equal(r.verified,false);
});
