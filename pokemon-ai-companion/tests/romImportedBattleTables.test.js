'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {enrichKnownEconomyProfile}=require('../romLiveResolver');
const SHA=[
'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'];
const CRC=['9F7FDD53','D6DA8A1A','3C2DD8AE'];
const fixture=i=>({hash:{sha256:SHA[i],crc32:CRC[i]},
 bytes:1048576,bytesRead:1048576,moveNames:Array(165).fill('MOVE'),
 species:Array(190).fill(null)});
test('três perfis: 165 golpes e 82 pares de tipos derivados sem ROM binária',()=>{
 for(let i=0;i<3;i++){
  const profile=enrichKnownEconomyProfile(fixture(i));
  assert.equal(profile.moveStats.length,165);
  assert.equal(profile.moveStats[0].powerByte,40);
  assert.equal(profile.moveStats[4].accuracyByte,216);
  assert.equal(profile.moveStats[0].basePp,null);
  assert.equal(profile.typeMatchups.length,82);
  assert.equal(profile.battleRuleTables.statModifierRatiosFromRom.length,13);
  assert.equal(profile.battleCaptureLayout.actualCatchRateAddress,0xd007);
  assert.equal(profile.battleCaptureLayout.runtimeRomSha256Proven,false);
 }
});
test('hash/CRC/tamanho alheios nunca enriquecem o combate',()=>{
 for(const mutate of [p=>p.hash.sha256='0'.repeat(64),
  p=>p.hash.crc32='00000000',p=>p.bytes=524288]){
  const p=fixture(0);mutate(p);
  assert.equal(enrichKnownEconomyProfile(p).moveStats,undefined);
 }
});
test('preserva dados já auditados no ficheiro ROM local',()=>{
 const p=fixture(0);
 p.moveStats=Array(165).fill({source:'ORIGINAL'});
 p.typeMatchups=[{source:'ORIGINAL'}];
 p.typeMatchupsStatus={verified:true};
 p.battleRuleTables={verified:true,source:'ORIGINAL'};
 p.battleCaptureLayout={verified:true,source:'ORIGINAL'};
 enrichKnownEconomyProfile(p);
 assert.equal(p.moveStats[0].source,'ORIGINAL');
 assert.equal(p.typeMatchups[0].source,'ORIGINAL');
 assert.equal(p.battleRuleTables.source,'ORIGINAL');
 assert.equal(p.battleCaptureLayout.source,'ORIGINAL');
});
