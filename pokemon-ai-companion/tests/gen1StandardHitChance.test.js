'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {standardHitChance} = require('../gen1StandardHitChance');
const ratios = [
  [25,100],[28,100],[33,100],[40,100],[50,100],[66,100],
  [1,1],[15,10],[2,1],[25,10],[3,1],[35,10],[4,1]
].map(([numerator,denominator])=>({numerator,denominator}));
const evidence = { exactRomSha256Verified:true, liveRamSnapshotVerified:true,
  standardHitTestAppliesVerified:true, romSha256:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b' };
const calc = (accuracyByteFromRom, accuracyStageFromRam=7, evasionStageFromRam=7, ev=evidence) =>
  standardHitChance({accuracyByteFromRom,accuracyStageFromRam,evasionStageFromRam,
    statModifierRatiosFromRom:ratios,evidence:ev});
test('precisão 100% codificada como byte 255 falha 1/256 no teste padrão',()=>{
  const r=calc(255); assert.equal(r.thresholdByte,255);
  assert.equal(r.hitOutOf256,255); assert.equal(r.missOutOf256,1);
  assert.equal(r.hitPercent,99.609375);
});
test('85% nominal codificado como byte 216 atinge 216/256',()=>{
  const r=calc(216); assert.equal(r.hitOutOf256,216);
  assert.equal(r.hitPercent,84.375);
});
test('evasion +1 da vítima usa o índice refletido 14-8',()=>{
  assert.equal(calc(216,7,8).thresholdByte,142);
});
test('arredondamentos acontecem depois de cada rácio, não no fim',()=>{
  assert.equal(calc(216,6,8).thresholdByte,93);
});
test('saturação final e mínimo 1 como no motor Gen I',()=>{
  assert.equal(calc(216,13,1).thresholdByte,255);
  assert.equal(calc(0,7,7).thresholdByte,1);
});
test('recusa falta de prova sobre a ROM, RAM ou aplicabilidade',()=>{
  for (const field of ['exactRomSha256Verified','liveRamSnapshotVerified','standardHitTestAppliesVerified']) {
    assert.equal(calc(255,7,7,{...evidence,[field]:false}).verified,false);
  }
});
test('recusa rácios inválidos e estágios fora de 1..13',()=>{
  assert.throws(()=>calc(255,0,7), RangeError);
  assert.throws(()=>calc(255,7,14), RangeError);
  assert.throws(()=>standardHitChance({accuracyByteFromRom:255,accuracyStageFromRam:7,
    evasionStageFromRam:7,statModifierRatiosFromRom:ratios.slice(1), evidence}),RangeError);
});
