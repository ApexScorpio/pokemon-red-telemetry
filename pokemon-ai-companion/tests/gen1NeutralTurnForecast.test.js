'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {neutralTurnForecast}=require('../gen1NeutralTurnForecast');
const ratios=[[25,100],[28,100],[33,100],[40,100],[50,100],[66,100],[1,1],
  [15,10],[2,1],[25,10],[3,1],[35,10],[4,1]]
  .map(([numerator,denominator])=>({numerator,denominator}));
const e={exactRomSha256Verified:true,liveRamSnapshotVerified:true,
 standardHitTestAppliesVerified:true,criticalHitTestAppliesVerified:true,
 neutralDamagePathVerified:true,neutralTurnFullyApplicableVerified:true,
 criticalAndNormalDamageInputsVerified:true,
 romSha256:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'};
const input={accuracyByteFromRom:255,accuracyStageFromRam:7,evasionStageFromRam:7,
 statModifierRatiosFromRom:ratios,baseSpeedFromRom:100,movePowerByteFromRom:40,
 highCriticalFromRom:false,focusEnergyActiveFromRam:false,
 nonCriticalVars:{effectiveLevelByte:20,scaledAttackByte:40,scaledDefenseByte:40},
 criticalVars:{effectiveLevelByte:40,scaledAttackByte:40,scaledDefenseByte:40},
 targetHpFromRam:10,evidence:e};
test('agregação contém falha por 1/256 e densidade total 1',()=>{
 const r=neutralTurnForecast(input); assert.equal(r.verified,true);
 assert.equal(r.hitProbability,255/256);assert.equal(r.criticalProbabilityGivenHit,50/256);
 assert.ok(Math.abs(r.distributionSum-1)<1e-12);
 assert.equal(r.distribution.find(x=>x.damage===0).probability,1/256);
});
test('min/max do turno e KO global respeitam críticos',()=>{
 const r=neutralTurnForecast(input);
 assert.equal(r.minDamageIfHit,8);assert.equal(r.maxDamageIfHit,16);
 assert.equal(r.nonCriticalDamage.max,10);assert.equal(r.criticalDamage.max,16);
 const pNormalKO=1/39; const pCritKO=1;
 const expected=(255/256)*((206/256)*pNormalKO+(50/256)*pCritKO);
 assert.ok(Math.abs(r.knockoutProbability-expected)<1e-12);
});
test('sem identidade confirmada, não oferece resultado do turno',()=>{
 assert.equal(neutralTurnForecast({...input,evidence:{...e,liveRamSnapshotVerified:false}}).verified,false);
 assert.equal(neutralTurnForecast({...input,evidence:{...e,neutralTurnFullyApplicableVerified:false}}).verified,false);
 assert.equal(neutralTurnForecast({...input,criticalVars:null}).verified,false);
});
