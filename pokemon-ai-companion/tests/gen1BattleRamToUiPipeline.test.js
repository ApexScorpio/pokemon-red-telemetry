'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseRomBattleEvidence}=require('../romBattleEvidence');
const {verifyBattleWindow}=require('../romBattleSnapshotConsistency');
const {enrichKnownEconomyProfile}=require('../romLiveResolver');
const {buildLiveBattlePreview}=require('../gen1LiveBattlePreview');
// Frames HEX sintéticos: servem para testar integração (não emulador ao vivo).
const variants=[
 ['5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b','9F7FDD53'],
 ['2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d','D6DA8A1A'],
 ['aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db','3C2DD8AE']
];
const hex=n=>n.toString(16).padStart(2,'0').toUpperCase();
function fixture(index=0){
 const [sha,crc]=variants[index];
 const profile={hash:{sha256:sha,crc32:crc},bytes:1048576,
   bytesRead:1048576,moveNames:Array(165).fill('GOLPE'),
   species:Array.from({length:190},()=>({stats:{speed:60}}))};
 enrichKnownEconomyProfile(profile);
 const combatBlock=Array(255).fill('00');
 const playerBlock=Array(30).fill('00');
 const modifierBlock=Array(280).fill('00');
 // CFE5 enemy species/HP/status/2 types/catch/moves/lvl/stats/PP
 combatBlock[5]=hex(19);combatBlock[7]=hex(25);
 combatBlock[10]=hex(0);combatBlock[11]=hex(0);
 combatBlock[12]=hex(45);combatBlock[13]=hex(1);
 combatBlock[19]=hex(20);combatBlock[21]=hex(50);
 combatBlock[23]=hex(60);combatBlock[25]=hex(60);
 combatBlock[27]=hex(50);combatBlock[29]=hex(50);
 combatBlock[30]=hex(30);combatBlock[39]=hex(45);
 // D014 player species/HP/status/2 types/moves/lvl/stats/PP
 playerBlock[0]=hex(1);playerBlock[2]=hex(90);
 playerBlock[8]=hex(1);playerBlock[9]=hex(52);
 playerBlock[14]=hex(30);playerBlock[16]=hex(100);
 playerBlock[18]=hex(90);playerBlock[20]=hex(70);
 playerBlock[22]=hex(60);playerBlock[24]=hex(70);
 playerBlock[25]=hex(35);playerBlock[26]=hex(20);
 for(const i of [250,251,252,253,254,255,270,271,272,273,274,275])
   modifierBlock[i]='07';
 const opts={combatBlock,playerBlock,modifierBlock,battleFlag:1,mapId:13};
 const reread={rereadEnemy:combatBlock.slice(5,45),
   rereadPlayer:playerBlock.slice(0,29),
   rereadStages:modifierBlock.slice(250,276),
   rereadFlag:['01'],rereadMapId:['0D']};
 return {profile,opts,reread};
}
function pipeline(i,change){
 const x=fixture(i);
 if(change)change(x);
 const evidence=parseRomBattleEvidence({...x.opts,
   romMatched:true,mapSnapshotVerified:true,captureLayoutVerified:true});
 const window=verifyBattleWindow({...x.opts,...x.reread});
 evidence.consistentWindowVerified=window.verified;
 const preview=buildLiveBattlePreview({romProfile:x.profile,battleEvidence:evidence,
   battleWindow:window,battleType:'Wild'});
 return {evidence,window,preview};
}
test('3 versões: blocos RAM validados atravessam o motor até ao resultado da interface',()=>{
 for(let i=0;i<3;i++){
  const {evidence,window,preview}=pipeline(i);
  assert.equal(evidence.verified,true);
  assert.equal(window.verified,true);
  assert.equal(window.atomicSnapshotVerified,false);
  assert.equal(preview.conditional,true);
  assert.equal(preview.verified,false);
  assert.equal(preview.moves.length,2);
  assert.equal(preview.moves[0].pp,35);
  assert.equal(preview.moves[0].powerByte,40);
  assert.ok(preview.moves[0].damage.min>0);
  assert.ok(preview.moves[1].damage.min>0); // Ember, sem calcular burn
  assert.equal(preview.moves[1].secondaryEffectNotModelled,true);
  assert.ok(preview.enemyThreats.length===1);
  assert.ok(preview.captureOdds.ultraball>=0);
 }
});
test('mudança de HP na janela descarta toda a previsão',()=>{
 const r=pipeline(0,x=>{x.reread.rereadEnemy[2]='01'});
 assert.equal(r.window.verified,false);
 assert.equal(r.preview.conditional,false);
 assert.equal(r.preview.moves.length,0);
});
test('divergência dos estágios RAM impede qualquer valor do turno',()=>{
 const r=pipeline(1,x=>{x.reread.rereadStages[0]='08'});
 assert.equal(r.window.verified,false);
 assert.equal(r.preview.captureOdds,null);
});
test('batalha fora da janela e mapa sem validação não produzem previsão',()=>{
 const x=fixture(2);
 const evidence=parseRomBattleEvidence({...x.opts,
   romMatched:true,mapSnapshotVerified:false,captureLayoutVerified:true});
 const window=verifyBattleWindow({...x.opts,...x.reread});
 evidence.consistentWindowVerified=window.verified;
 assert.equal(evidence.verified,false);
 assert.equal(buildLiveBattlePreview({
   romProfile:x.profile,battleEvidence:evidence,battleWindow:window,
   battleType:'Wild'}).conditional,false);
});
test('desconexão da ROM ativa impede dados mesmo com leitura RAM idêntica',()=>{
 const r=pipeline(0,x=>{x.profile.hash.sha256='0'.repeat(64)});
 assert.equal(r.evidence.verified,true);
 assert.equal(r.preview.conditional,false);
});
