'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {trainerFlagsForCurrentMap,GUARDED_SPECIAL_BATTLES,
 NON_BATTLE_CONTEXT_EVENTS}=require('../romTrainerEvents');
const {buildRomAreaEvidence}=require('../romAreaEvidence');
const {makeAreaProgress}=require('../romAreaProgress');
const SHA=[
 {file:'Pokemon Red.gb',hash:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'},
 {file:'Pokemon Blue.gb',hash:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'},
 {file:'Pokemon Green International v1.2.1.gb',hash:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'}
];
const profile={hash:{sha256:SHA[0].hash}};
function flags(...ids){
 const hex=Array(320).fill('00');
 for(const event of ids)hex[event>>3]=(parseInt(hex[event>>3],16)|(1<<(event&7)))
    .toString(16).padStart(2,'0');
 return hex;
}
function objectMap(mapId,ordinals){
 const total=Math.max(...ordinals,1);
 const objects=Array.from({length:total},()=>({kind:'npc'}));
 for(const ordinal of ordinals)objects[ordinal-1]={
   kind:'trainer',trainerClassOrItemId:230,trainerNumberOrLevel:1,x:6,y:8
 };
 return {valid:true,mapId,objects:{objects}};
}
test('Cerulean rival: script de vitória só declara vitória quando bit 152 está ativo',()=>{
 const map=objectMap(3,[2]);
 const before=trainerFlagsForCurrentMap(profile,map,flags());
 const after=trainerFlagsForCurrentMap(profile,map,flags(152));
 assert.equal(before.verified,true);
 assert.equal(before.entries[0].eventBitIndex,152);
 assert.equal(before.entries[0].victoryRecorded,false);
 assert.equal(before.entries[0].defeated,null);
 assert.equal(after.entries[0].victoryRecorded,true);
 assert.equal(after.entries[0].defeated,true);
 assert.equal(buildRomAreaEvidence(map,[],{},{
   romIdentityMatched:true,trainerFlags:after
 }).trainers[0].defeated,true);
});
test('Route24 Rocket: bit 1345 independente dos seis treinadores Nugget Bridge',()=>{
 const map=objectMap(35,[1,2,3,4,5,6,7]);
 const result=trainerFlagsForCurrentMap(profile,map,flags(1345));
 assert.equal(result.verified,true);
 assert.equal(result.unknownTrainerCount,0);
 assert.equal(result.entries.find(e=>e.objectOrdinal===1).defeated,true);
 assert.equal(result.entries.filter(e=>e.defeated===true).length,1);
});
test('Oak Lab: bit 35 confirma confronto, não vitória contra o rival',()=>{
 const map=objectMap(40,[1]);
 const result=trainerFlagsForCurrentMap(profile,map,flags(35));
 assert.equal(result.verified,true);
 assert.equal(result.entries[0].battleWasPlayed,true);
 assert.equal(result.entries[0].victoryRecorded,null);
 assert.equal(result.entries[0].defeated,null);
});
test('Silph Co 11F: bit 1935 pertence a Giovanni, não aos dois Rockets',()=>{
 const map=objectMap(235,[3,4,5]);
 const result=trainerFlagsForCurrentMap(profile,map,flags(1935));
 assert.equal(result.verified,true);
 const boss=result.entries.find(e=>e.objectOrdinal===3);
 assert.equal(boss.eventBitIndex,1935);
 assert.equal(boss.defeated,true);
 const evidence=buildRomAreaEvidence(map,[],{},{
   romIdentityMatched:true,trainerFlags:result
 });
 const progress=makeAreaProgress(evidence,{verified:false},{matched:true});
 assert.equal(progress.trainers.scriptedVictoriesConfirmed,1);
 assert.equal(progress.trainers.defeatedConfirmed,null);
});
test('Game Corner/SS Anne: progresso de cenário nunca se converte em vitória',()=>{
 for(const [mapId,ordinal,flag] of [[96,2,1506],[135,11,441]]){
   const result=trainerFlagsForCurrentMap(profile,objectMap(mapId,[ordinal]),flags(flag));
   assert.equal(result.verified,false);
   assert.equal(result.entries.length,0);
   assert.equal(result.contextEvents.length,1);
   assert.equal(result.contextEvents[0].eventFlagSet,true);
   assert.equal(result.contextEvents[0].confirmsBattleVictory,false);
 }
});
test('ROM desconhecida não herda flags nem vitórias de Red, Blue e Green',()=>{
 const result=trainerFlagsForCurrentMap({hash:{sha256:'0'.repeat(64)}},
   objectMap(3,[2]),flags(152));
 assert.equal(result.verified,false);
 assert.equal(result.entries.length,0);
});
test('dados compilados das três ROMs: SET event bit é único no banco do mapa',{
 skip:!process.env.POKEMON_ROM_DIR
},()=>{
 const known=[
  [3,2,152,230],[35,1,1345,230],[40,1,35,225],
  [135,11,441,230],[235,3,1935,229]
 ];
 for(const rom of SHA){
  const raw=fs.readFileSync(path.join(process.env.POKEMON_ROM_DIR,rom.file));
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),rom.hash);
  for(const [mapId,ordinal,bitId] of known){
   const bank=raw[0xC23D+mapId],cpu=raw.readUInt16LE(0x1AE+2*mapId);
   const header=bank*0x4000+cpu-0x4000;
   const script=bank*0x4000+raw.readUInt16LE(header+7)-0x4000;
   const byte=0xD747+(bitId>>3);
   const signature=Buffer.from([0x21,byte&255,byte>>8,0xCB,0xC6+8*(bitId&7)]);
   let count=0,found=0;
   for(let p=script;p<(bank+1)*0x4000-signature.length;p++)
    if(raw.subarray(p,p+signature.length).equals(signature)){found=p;count++;}
   assert.equal(count,1,'assinatura SetEvent ambígua: '+rom.file+' map '+mapId);
   assert.ok(found>script);
  }
 }
});
