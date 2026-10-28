'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildLiveBattlePreview,accuracyConditional,captureConditional}=
 require('../gen1LiveBattlePreview');
const {standardHitChance}=require('../gen1StandardHitChance');
const {captureProbability}=require('../gen1CaptureProbability');
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const ratios=[[25,100],[28,100],[33,100],[40,100],[50,100],[66,100],
 [1,1],[15,10],[2,1],[25,10],[3,1],[35,10],[4,1]]
 .map(([numerator,denominator])=>({numerator,denominator}));
function fixture(){
 const moveStats=Array(165).fill(null);
 // Golpes #1 e #5: bytes verdadeiros iguais nas três ROMs em 0x38000.
 moveStats[0]={id:1,effectByte:0,powerByte:40,accuracyByte:255};
 moveStats[4]={id:5,effectByte:0,powerByte:80,accuracyByte:216};
 const romProfile={hash:{sha256:SHA},moveStats,moveNames:['POUND'],
   battleRuleTables:{verified:true,statModifierRatiosFromRom:ratios},
   battleCaptureLayout:{verified:true}};
 const battleEvidence={verified:true,consistentWindowVerified:true,
   battleType:'Wild',stages:{player:[7,7,7,7,7,7],enemy:[7,7,7,7,7,7]},
   player:{moves:[1,5,0,0],pp:[35,12,0,0]},enemy:{hp:19},
   actualCatchRateVerified:true,captureInputs:{
     actualCatchRateFromRam:45,hpFromRam:19,maxHpFromRam:45,
     statusFromRam:'NONE'}};
 return {romProfile,battleEvidence,battleWindow:{verified:true},
   battleType:'Wild'};
}
test('pré-visualização de dois golpes do BattleMon sem alegar prova SHA runtime',()=>{
 const x=buildLiveBattlePreview(fixture());
 assert.equal(x.verified,false);assert.equal(x.conditional,true);
 assert.equal(x.runtimeSha256Verified,false);assert.equal(x.atomicSnapshotVerified,false);
 assert.equal(x.moves.length,2);assert.equal(x.moves[1].pp,12);
 assert.equal(x.moves[0].hitOutOf256,255);
 assert.equal(x.moves[1].hitOutOf256,216);
 assert.ok(x.captureOdds.pokeball>=0&&x.captureOdds.pokeball<=100);
});
test('recusa ROM fora da lista auditada e janela RAM alterada',()=>{
 const a=fixture();a.romProfile.hash.sha256='0'.repeat(64);
 assert.equal(buildLiveBattlePreview(a).conditional,false);
 const b=fixture();b.battleWindow.verified=false;
 assert.equal(buildLiveBattlePreview(b).moves.length,0);
});
test('efeito especial não pode herdar chance de MoveHitTest normal',()=>{
 const x=fixture();x.romProfile.moveStats[4].effectByte=29;
 assert.equal(buildLiveBattlePreview(x).moves[1].hitPercent,null);
});
test('precisão condicional bate certo com motor de precisão guardado',()=>{
 const args={accuracyByteFromRom:216,accuracyStageFromRam:7,
 evasionStageFromRam:7,statModifierRatiosFromRom:ratios};
 const conditional=accuracyConditional(216,7,7,ratios);
 const strict=standardHitChance({...args,evidence:{
  romSha256:SHA,exactRomSha256Verified:true,liveRamSnapshotVerified:true,
  standardHitTestAppliesVerified:true}});
 assert.equal(conditional.hitOutOf256,strict.hitOutOf256);
});
test('captura condicional bate com motor estrito, mas não valida lançamento',()=>{
 const input=fixture().battleEvidence.captureInputs;
 const conditional=captureConditional({...input,ball:'POKE_BALL'});
 const strict=captureProbability({...input,ball:'POKE_BALL',evidence:{
  romSha256:SHA,exactRomSha256Verified:true,liveRamSnapshotVerified:true,
  ordinaryBallEffectVerified:true,legalThrowVerified:true}});
 assert.equal(conditional,strict.percent);
});
test('batalhas de treinador nunca expõem captura',()=>{
 const x=fixture();x.battleType='Trainer';x.battleEvidence.battleType='Trainer';
 assert.equal(buildLiveBattlePreview(x).captureOdds,null);
});
