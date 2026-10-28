'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildLiveBattlePreview,accuracyConditional,captureConditional,
 typedDamageConditional,criticalConditionalWithoutFocus}=require('../gen1LiveBattlePreview');
const {standardHitChance}=require('../gen1StandardHitChance');
const {captureProbability}=require('../gen1CaptureProbability');
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const ratios=[[25,100],[28,100],[33,100],[40,100],[50,100],[66,100],
 [1,1],[15,10],[2,1],[25,10],[3,1],[35,10],[4,1]]
 .map(([numerator,denominator])=>({numerator,denominator}));
const rules=[{attackType:0,defenderType:8,multiplier:0},
 {attackType:20,defenderType:22,multiplier:20},
 {attackType:20,defenderType:21,multiplier:5},
 ...Array.from({length:79},(_,i)=>({attackType:1,defenderType:2,multiplier:20}))];
function scenario(){
 const moveStats=Array(165).fill(null);
 moveStats[0]={id:1,effectByte:0,powerByte:40,typeByte:0,accuracyByte:255};
 moveStats[4]={id:5,effectByte:0,powerByte:80,typeByte:0,accuracyByte:216};
 moveStats[51]={id:52,effectByte:4,powerByte:40,typeByte:20,accuracyByte:255};
 const species=Array(190).fill(null);
 species[0]={stats:{speed:50}};
 species[1]={stats:{speed:35}};
 const romProfile={hash:{sha256:SHA},moveStats,moveNames:['POUND'],
   species,typeMatchupsStatus:{verified:true},typeMatchups:rules,
   battleRuleTables:{verified:true,statModifierRatiosFromRom:ratios,
     highCriticalMoveIdsFromRom:[2,75,152,163]},
   battleCaptureLayout:{verified:true}};
 const battleEvidence={verified:true,consistentWindowVerified:true,
   battleType:'Wild',
   stages:{player:[7,7,7,7,7,7],enemy:[7,7,7,7,7,7]},
   player:{speciesId:1,level:30,attack:90,defense:70,special:70,
     hp:90,typeIds:[0,0],status:'NONE',
     moves:[1,5,52,0],pp:[35,12,20,0]},
   enemy:{speciesId:2,level:20,attack:60,defense:60,special:40,
     hp:25,typeIds:[0,0],status:'NONE',
     moves:[1,0,0,0],pp:[30,0,0,0]},
   actualCatchRateVerified:true,
   captureInputs:{actualCatchRateFromRam:45,hpFromRam:25,
     maxHpFromRam:50,statusFromRam:'NONE'}};
 return {romProfile,battleEvidence,battleWindow:{verified:true},battleType:'Wild'};
}
test('golpes RAM: previsão condicional de dano, crítico e KO não crítico',()=>{
 const r=buildLiveBattlePreview(scenario());
 assert.equal(r.verified,false);assert.equal(r.conditional,true);
 assert.equal(r.runtimeSha256Verified,false);assert.equal(r.atomicSnapshotVerified,false);
 assert.equal(r.moves.length,3);assert.equal(r.moves[1].pp,12);
 assert.equal(r.moves[0].hitOutOf256,255);
 assert.equal(r.moves[1].hitOutOf256,216);
 assert.ok(r.moves[0].damage.min>0);
 assert.ok(r.moves[0].damage.max>=r.moves[0].damage.min);
 assert.ok(r.moves[0].damage.koGivenNormalHitPercent>=0);
 assert.ok(r.moves[0].criticalPercentWithoutFocus>0);
 assert.ok(r.conditionalBestMove);assert.equal(r.enemyThreats.length,1);
 assert.equal(r.moves[2].damage,null);
 assert.ok(r.captureOdds.pokeball>=0&&r.captureOdds.pokeball<=100);
});
test('recusa SHA desconhecido, janela incoerente e HP zero',()=>{
 const a=scenario();a.romProfile.hash.sha256='0'.repeat(64);
 assert.equal(buildLiveBattlePreview(a).conditional,false);
 const b=scenario();b.battleWindow.verified=false;
 assert.equal(buildLiveBattlePreview(b).moves.length,0);
 const c=scenario();c.battleEvidence.enemy.hp=0;
 assert.equal(buildLiveBattlePreview(c).moves[0].damage,null);
});
test('o dano é condicionado por STAB, tipo, imunidade e arredondamentos',()=>{
 const base={level:20,power:40,moveType:0,
   attackerTypes:[0,0],defenderTypes:[0,0],
   attack:40,defense:40,attackerStages:[7,7,7,7,7,7],
   defenderStages:[7,7,7,7,7,7],attackerStatus:'NONE',
   orderedRules:rules,targetHp:10};
 const normal=typedDamageConditional(base);
 assert.equal(normal.stab,true);assert.equal(normal.maxDamage,15);
 const immune=typedDamageConditional({...base,defenderTypes:[8,8]});
 assert.equal(immune.maxDamage,0);
 assert.equal(immune.knockoutGivenNormalHitPercent,0);
});
test('stat stages não neutros e burn físico recusam cálculo de dano',()=>{
 const a=scenario();a.battleEvidence.stages.player[0]=8;
 assert.equal(buildLiveBattlePreview(a).moves[0].damage,null);
 const b=scenario();b.battleEvidence.player.status='BRN';
 assert.equal(buildLiveBattlePreview(b).moves[0].damage,null);
});
test('scaled stats: se A ou D >255, ambos são divididos por 4',()=>{
 const a={level:50,power:40,moveType:0,
   attackerTypes:[0,0],defenderTypes:[0,0],attack:300,defense:180,
   attackerStages:[7,7,7,7,7,7],defenderStages:[7,7,7,7,7,7],
   attackerStatus:'NONE',orderedRules:rules,targetHp:20};
 assert.equal(typedDamageConditional(a).scaledStats,true);
});
test('motor condicional de precisão conserva a tabela Gen I do módulo verificado',()=>{
 const x=accuracyConditional(216,7,7,ratios);
 const y=standardHitChance({accuracyByteFromRom:216,
   accuracyStageFromRam:7,evasionStageFromRam:7,
   statModifierRatiosFromRom:ratios,evidence:{
    romSha256:SHA,exactRomSha256Verified:true,liveRamSnapshotVerified:true,
    standardHitTestAppliesVerified:true}});
 assert.equal(x.hitOutOf256,y.hitOutOf256);
});
test('fórmula condicional de captura conserva a probabilidade da rotina normal',()=>{
 const input=scenario().battleEvidence.captureInputs;
 const a=captureConditional({...input,ball:'POKE_BALL'});
 const b=captureProbability({...input,ball:'POKE_BALL',evidence:{
    romSha256:SHA,exactRomSha256Verified:true,liveRamSnapshotVerified:true,
    ordinaryBallEffectVerified:true,legalThrowVerified:true}});
 assert.equal(a,b.percent);
});
test('treinador não tem percentagem de captura; efeito especial sem previsão de dano',()=>{
 const a=scenario();a.battleType='Trainer';a.battleEvidence.battleType='Trainer';
 const r=buildLiveBattlePreview(a);
 assert.equal(r.captureOdds,null);
 assert.equal(r.moves[2].hitPercent,null);
});
test('crítico base: valores só sem Focus Energy, sem chamar probabilidade real',()=>{
 const x=criticalConditionalWithoutFocus(100,40,false);
 const y=criticalConditionalWithoutFocus(100,40,true);
 assert.equal(x.outOf256,50);assert.equal(y.outOf256,255);
 assert.equal(criticalConditionalWithoutFocus(100,0,false).outOf256,0);
});
