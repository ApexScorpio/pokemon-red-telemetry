'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseRomBattleEvidence}=require('../romBattleEvidence');
const mk=(len)=>Array(len).fill('00');
const set=(a,i,val)=>{a[i]=val.toString(16).padStart(2,'0').toUpperCase()};
const set16=(a,i,n)=>{set(a,i,n>>>8);set(a,i+1,n&255)};
function fixtures(){
 const combatBlock=mk(255),playerBlock=mk(30),modifierBlock=mk(280);
 set(combatBlock,5,25); set16(combatBlock,6,35);set(combatBlock,19,15);set16(combatBlock,20,38);
 [27,19,35,25].forEach((v,i)=>set16(combatBlock,22+i*2,v));
 [84,45,0,0].forEach((v,i)=>set(combatBlock,13+i,v));
 set(playerBlock,0,10);set16(playerBlock,1,40);set(playerBlock,14,20);set16(playerBlock,15,60);
 [34,32,40,28].forEach((v,i)=>set16(playerBlock,17+i*2,v));
 [33,45,0,0].forEach((v,i)=>set(playerBlock,8+i,v));
 for(const i of [250,251,252,253,254,255,270,271,272,273,274,275])set(modifierBlock,i,7);
 return {combatBlock,playerBlock,modifierBlock,battleFlag:1,romMatched:true,mapSnapshotVerified:true};
}
test('preserves observed RAM data without imputing estimates',()=>{
 const x=parseRomBattleEvidence(fixtures());
 assert.equal(x.verified,true);assert.equal(x.enemy.hp,35);assert.equal(x.enemy.level,15);
 assert.equal(x.enemy.maxHp,38);assert.equal(x.enemy.attack,27);
 assert.equal(x.player.hp,40);assert.equal(x.player.level,20);
 assert.equal(x.actualCatchRate,0);
 assert.equal(x.actualCatchRateVerified,true);
 assert.equal(x.captureInputs.actualCatchRateFromRam,0);
 assert.equal(x.captureInputs.statusFromRam,'NONE');
 assert.equal(x.captureInputs.legalThrowVerified,false);
 assert.equal(x.exactTurnMathReady,false);assert.equal(x.atomicSnapshotVerified,false);
});
test('rejects missing, truncated and nonhex blocks',()=>{
 const d=fixtures();assert.equal(parseRomBattleEvidence({...d,playerBlock:null}).verified,false);
 assert.equal(parseRomBattleEvidence({...d,combatBlock:d.combatBlock.slice(0,254)}).verified,false);
 const bad=fixtures();bad.modifierBlock[270]='ZZ';assert.equal(parseRomBattleEvidence(bad).verified,false);
});
test('rejects bogus HP/levels and unvalidated stat stages',()=>{
 const d=fixtures();set16(d.combatBlock,6,40);assert.equal(parseRomBattleEvidence(d).verified,false);
 const b=fixtures();set(b.playerBlock,14,0);assert.equal(parseRomBattleEvidence(b).verified,false);
 const c=fixtures();set(c.modifierBlock,270,0);assert.equal(parseRomBattleEvidence(c).verified,false);
});
test('refuses ROM/ram map mismatch and an unknown fight flag',()=>{
 const d=fixtures();
 assert.equal(parseRomBattleEvidence({...d,mapSnapshotVerified:false}).verified,false);
 assert.equal(parseRomBattleEvidence({...d,battleFlag:null}).verified,false);
});
test('does not mistake ROM identity for atomic turn proof',()=>{
 const d=fixtures();
 const x=parseRomBattleEvidence({...d,romMatched:true,battleFlag:2});
 assert.equal(x.romMatched,true);assert.equal(x.battleType,'Trainer');
 assert.equal(x.exactTurnMathReady,false);assert.equal(x.atomicSnapshotVerified,false);
});

test('Lê D007 taxa de captura EFETIVA, sem confundir com CFEC base',()=>{
 const d=fixtures();
 set(d.combatBlock,12,45); // CFEC, taxa da ficha
 set(d.combatBlock,39,175); // D007, ajustada pelo motor
 set(d.combatBlock,9,0x20); // CFE9, congelado
 const x=parseRomBattleEvidence(d);
 assert.equal(x.verified,true);
 assert.equal(x.enemy.baseCatchRate,45);
 assert.equal(x.actualCatchRate,175);
 assert.equal(x.catchStatusFromRam,'FRZ');
 assert.equal(x.captureInputs.actualCatchRateFromRam,175);
 assert.equal(x.captureInputs.hpFromRam,35);
 assert.equal(x.captureInputs.maxHpFromRam,38);
 assert.equal(x.atomicSnapshotVerified,false);
});
test('Adormecido, envenenado, queimado e paralisado são descodificados a partir da RAM',()=>{
 const expected=[[1,'SLP'],[7,'SLP'],[8,'PSN'],[16,'BRN'],[32,'FRZ'],[64,'PAR']];
 for(const [byte,status] of expected){
  const d=fixtures();set(d.combatBlock,9,byte);
  assert.equal(parseRomBattleEvidence(d).catchStatusFromRam,status);
 }
});
test('Estados incompatíveis ou bytes RAM não aceites são recusados',()=>{
 const d=fixtures();set(d.combatBlock,9,0x30);
 assert.equal(parseRomBattleEvidence(d).verified,false);
 const b=fixtures();b.combatBlock[39]='GG';
 assert.equal(parseRomBattleEvidence(b).verified,false);
});
test('Captura indisponível em combate de treinador e quando o alvo está desmaiado',()=>{
 const d=fixtures();set(d.combatBlock,39,200);
 const trainer=parseRomBattleEvidence({...d,battleFlag:2});
 assert.equal(trainer.verified,true);
 assert.equal(trainer.actualCatchRateVerified,false);
 assert.equal(trainer.actualCatchRate,null);
 assert.equal(trainer.captureInputs,null);
 const fainted=fixtures();set16(fainted.combatBlock,6,0);
 assert.equal(parseRomBattleEvidence(fainted).captureInputs,null);
});
