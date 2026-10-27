'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {typedDamageDistribution}=require('../gen1TypeDamage');
const evidence={romSha256:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 exactRomSha256Verified:true,liveRamSnapshotVerified:true,neutralDamagePathVerified:true,
 typeChartRomVerified:true,attackerDefenderTypesRamVerified:true,standardTypedDamagePathVerified:true};
// Tabela sintética de testes, sem alegar que representa a ROM em execução.
const r=[{attackType:7,defenderType:10,multiplier:20},
 {attackType:7,defenderType:11,multiplier:5},
 {attackType:7,defenderType:12,multiplier:0}];
const run=(attackerTypesFromRam,defenderTypesFromRam, ev=evidence)=>(
 typedDamageDistribution({effectiveLevelByte:20,movePowerByte:40,
 scaledAttackByte:40,scaledDefenseByte:40,moveTypeIdFromRom:7,
 attackerTypesFromRam,defenderTypesFromRam,orderedTypeRulesFromRom:r,evidence:ev}));
test('STAB exact: neutral 10 -> 15, 2x -> 30',()=>{
 const x=run([7,7],[10,10]);assert.equal(x.damageBeforeRandom,30);
 assert.equal(x.stab,true);assert.equal(x.appliedTypeRules.length,1);
});
test('weakness and resistance sequential floor cancel; order and duplicated types',()=>{
 const x=run([7,9],[10,11]);assert.equal(x.damageBeforeRandom,15);
 assert.deepEqual(x.appliedTypeRules.map(y=>y.multiplier),[20,5]);
});
test('Gen I zero type effectiveness causes 0 damage',()=>{
 const x=run([8,9],[12,12]);assert.equal(x.missedFromZeroDamage,true);
 assert.equal(x.minDamage,0);assert.equal(x.maxDamage,0);
});
test('unverified type table refuses rather than assuming modern rules',()=>{
 assert.equal(run([7,7],[10,10],{...evidence,typeChartRomVerified:false}).verified,false);
 assert.throws(()=>typedDamageDistribution({effectiveLevelByte:20,movePowerByte:40,
 scaledAttackByte:40,scaledDefenseByte:40,moveTypeIdFromRom:7,
 attackerTypesFromRam:[7,7],defenderTypesFromRam:[10,10],
 orderedTypeRulesFromRom:[{attackType:7,defenderType:10,multiplier:30}],evidence}),RangeError);
});
