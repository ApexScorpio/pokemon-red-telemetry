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
    trainerClassOrItemId:201,trainerNumberOrLevel:i+1
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
 assert.equal(trainerFlagsForCurrentMap(profile,{...map,mapId:0},flags).verified,false);
 assert.equal(trainerFlagsForCurrentMap(profile,map,flags.slice(2)).verified,false);
 assert.equal(trainerFlagsForCurrentMap(profile,{...map,objects:{objects:[{kind:'trainer'}]}},flags).verified,false);
});


test('Route 24: Rocket especial e seis treinadores normais têm flags válidas',()=>{
 const flags=Array(320).fill('00'),objects=Array.from({length:7},()=>({kind:'trainer'}));
 const result=trainerFlagsForCurrentMap(profile,{valid:true,mapId:35,objects:{objects}},flags);
 assert.equal(result.verified,true);
 assert.equal(result.fullyMapped,true);
 assert.equal(result.unknownTrainerCount,0);
 assert.deepEqual(result.entries.map(x=>x.objectOrdinal),[2,3,4,5,6,7,1]);
 assert.deepEqual(result.entries.map(x=>x.eventBitIndex),[1346,1347,1348,1349,1350,1351,1345]);
 assert.ok(result.entries.every(x=>x.defeated===null));
});


test('perfil completo da ROM e atlas auditado: conflitos de bits são rejeitados',()=>{
 const flags=Array(320).fill('00');
 const dynamic={...map,trainerEvents:[
   {objectOrdinal:1,eventBitIndex:1041},
   {objectOrdinal:2,eventBitIndex:1042}
 ]};
 const fullProfile={...profile,world:{maps:{
   trainerEventsVerified:310,data:{17:{mapId:17}}
 }}};
 const ok=trainerFlagsForCurrentMap(fullProfile,dynamic,flags);
 assert.equal(ok.verified,true);
 assert.equal(ok.entries.length,6);
 assert.equal(ok.entries.find(x=>x.objectOrdinal===6).eventBitIndex,1046);
 assert.match(ok.source,/ATLAS_SHA256_COMPARADOS/);

 const conflicting={...dynamic,trainerEvents:[
   {objectOrdinal:1,eventBitIndex:1049}
 ]};
 const bad=trainerFlagsForCurrentMap(fullProfile,conflicting,flags);
 assert.equal(bad.verified,false);
 assert.equal(bad.source,'CONFLITO_ATLAS_VS_CABECALHO_ROM');
});

test('ordinais duplicados na tabela dinâmica nunca são aceites',()=>{
 const flags=Array(320).fill('00');
 const fullProfile={...profile,world:{maps:{
   trainerEventsVerified:310,data:{17:{mapId:17}}
 }}};
 const dup={...map,trainerEvents:[
   {objectOrdinal:1,eventBitIndex:1041},
   {objectOrdinal:1,eventBitIndex:1042}
 ]};
 assert.equal(trainerFlagsForCurrentMap(fullProfile,dup,flags).source,
   'ROM_CABEÇALHO_INVALIDO_OU_DUPLICADO');
});

test('atlas não confunde encontro fixo com treinador humano',()=>{
 const flags=Array(320).fill('00');
 const fixed={kind:'wildPokemon',trainerClassOrItemId:73,wildSpeciesInternalId:73};
 const mapMoltres={valid:true,mapId:194,objects:{objects:[
   ...Array.from({length:5},()=>({kind:'trainer',trainerClassOrItemId:201})),
   fixed
 ]}};
 const r=trainerFlagsForCurrentMap(profile,mapMoltres,flags);
 assert.equal(r.verified,true);
 assert.equal(r.entries.length,5);
 assert.equal(r.entries.some(x=>x.objectOrdinal===6),false);
});
