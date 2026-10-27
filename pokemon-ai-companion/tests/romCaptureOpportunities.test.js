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
