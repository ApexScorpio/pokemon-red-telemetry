'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {trainerFlagsForCurrentMap}=require('../romTrainerEvents');
const {buildRomAreaEvidence}=require('../romAreaEvidence');
const {makeAreaProgress}=require('../romAreaProgress');
const ROM_SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const profile={hash:{sha256:ROM_SHA}};
const map={
  valid:true,mapId:17,objects:{objects:Array.from({length:6},(_,i)=>({
    kind:'trainer',x:i,y:12,spriteId:6,
    trainerClassOrItemId:1,trainerNumberOrLevel:i+1
  }))}
};
test('Route 6: seis bits concretos extraídos dos cabeçalhos auditados',()=>{
 const flags=Array(320).fill('00');
 // Marcamos como desativados pelos scripts os combates dos treinadores 0 e 5.
 for(const event of [1041,1046]){
  const byte=event>>3,bit=event&7;
  flags[byte]=(parseInt(flags[byte],16)|(1<<bit)).toString(16).padStart(2,'0');
 }
 const r=trainerFlagsForCurrentMap(profile,map,flags);
 assert.equal(r.verified,true);
 assert.deepEqual(r.entries.map(x=>x.eventFlagSet),[true,false,false,false,false,true]);
 assert.ok(r.entries.every(x=>x.defeated===null));
 assert.deepEqual(r.entries.map(x=>x.eventBitIndex),[1041,1042,1043,1044,1045,1046]);
 const evidence=buildRomAreaEvidence(map,[],{},{
  romIdentityMatched:true,spritesVerified:false,trainerFlags:r
 });
 const summary=makeAreaProgress(evidence,{verified:false},{matched:true});
 assert.equal(summary.trainers.eventGatesClosed,2);
 assert.equal(summary.trainers.defeatedConfirmed,null);
 assert.equal(summary.trainers.eventGatesOpen,4);
 assert.equal(summary.trainers.statusUnknown,0);
});
test('recusar jogo, mapa ou RAM que não constam das associações auditadas',()=>{
 const flags=Array(320).fill('00');
 assert.equal(trainerFlagsForCurrentMap(null,map,flags).verified,false);
 assert.equal(trainerFlagsForCurrentMap(profile,{...map,mapId:99},flags).verified,false);
 assert.equal(trainerFlagsForCurrentMap(profile,map,flags.slice(2)).verified,false);
 assert.equal(trainerFlagsForCurrentMap(profile,{...map,objects:{objects:[{kind:'trainer'}]}},flags).verified,false);
});
