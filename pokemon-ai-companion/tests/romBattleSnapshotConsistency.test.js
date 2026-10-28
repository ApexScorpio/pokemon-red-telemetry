'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyBattleWindow}=require('../romBattleSnapshotConsistency');
const fill=n=>Array(n).fill('00');
function sample(){
 const combatBlock=fill(255),playerBlock=fill(30),modifierBlock=fill(280);
 combatBlock[5]='19';playerBlock[0]='0A';modifierBlock[250]='07';modifierBlock[270]='07';
 return {combatBlock,playerBlock,modifierBlock,battleFlag:1,mapId:13,
  rereadEnemy:combatBlock.slice(5,45),rereadPlayer:playerBlock.slice(0,29),
  rereadStages:modifierBlock.slice(250,276),rereadFlag:['01'],rereadMapId:['0D']};
}
test('duas leituras idênticas são consistentes, não atómicas',()=>{
 const a=verifyBattleWindow(sample());assert.equal(a.verified,true);
 assert.equal(a.atomicSnapshotVerified,false);
 assert.equal(Object.values(a.checks).every(Boolean),true);
});
test('mudança HP/catch rate no bloco inimigo suspende a leitura',()=>{
 const x=sample();x.rereadEnemy[1]='10';assert.equal(verifyBattleWindow(x).verified,false);
 const y=sample();y.rereadEnemy[34]='AA';assert.equal(verifyBattleWindow(y).verified,false);
});
test('mudança nos estágios, jogador, mapa ou flag suspende resultados',()=>{
 for(const key of ['rereadPlayer','rereadStages','rereadFlag','rereadMapId']){
  const x=sample();x[key]=[...x[key]];x[key][0]='FF';
  assert.equal(verifyBattleWindow(x).verified,false,key);
 }
});
test('ausência, truncagem ou corrupção das leituras recusa',()=>{
 const a=sample();a.rereadEnemy=null;assert.equal(verifyBattleWindow(a).verified,false);
 const b=sample();b.rereadStages=['00'];assert.equal(verifyBattleWindow(b).verified,false);
 const c=sample();c.rereadMapId=['GG'];assert.equal(verifyBattleWindow(c).verified,false);
});
test('comparação de hexadecimal não depende de maiúsculas',()=>{
 const a=sample();a.rereadEnemy[0]='19';a.combatBlock[5]='19';
 assert.equal(verifyBattleWindow(a).verified,true);
});
