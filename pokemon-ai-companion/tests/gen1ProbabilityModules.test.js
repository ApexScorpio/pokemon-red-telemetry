'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const {criticalChance,neutralDamageDistribution,neutralKnockoutOdds}=require('../gen1CombatProbabilities');
const {captureProbability}=require('../gen1CaptureProbability');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const e={romSha256:sha,exactRomSha256Verified:true,liveRamSnapshotVerified:true,
  criticalHitTestAppliesVerified:true,neutralDamagePathVerified:true,
  ordinaryBallEffectVerified:true,legalThrowVerified:true};
const crit=(baseSpeedFromRom,highCriticalFromRom=false,focusEnergyActiveFromRam=false,powerByteFromRom=40,ev=e)=>
  criticalChance({baseSpeedFromRom,highCriticalFromRom,focusEnergyActiveFromRam,powerByteFromRom,evidence:ev});
const dmg=(b,c,level=20,power=40)=>neutralDamageDistribution({effectiveLevelByte:level,
    movePowerByte:power,scaledAttackByte:b,scaledDefenseByte:c,evidence:e});
const cap=(ball,actualCatchRateFromRam,hpFromRam,maxHpFromRam,statusFromRam='NONE',ev=e)=>
  captureProbability({ball,actualCatchRateFromRam,hpFromRam,maxHpFromRam,statusFromRam,evidence:ev});

test('regular crit speed 100 => 50/256, high crit => 255/256',()=>{
  assert.equal(crit(100).criticalOutOf256,50);
  assert.equal(crit(100,true).criticalOutOf256,255);
});
test('Gen I Focus Energy bug divides base chance by 4, high crit not ordinary',()=>{
  assert.equal(crit(100,false,true).criticalOutOf256,12);
  assert.equal(crit(100,true,true).criticalOutOf256,100);
});
test('power zero returns no critical, invalid evidence refuses',()=>{
  assert.equal(crit(100,false,false,0).criticalOutOf256,0);
  assert.equal(crit(100,false,false,40,{...e,exactRomSha256Verified:false}).verified,false);
});
test('neutral damage floor and 39 damage rolls; max 999 cap',()=>{
  const x=dmg(40,40);
  assert.equal(x.preRandomDamage,10);
  assert.equal(x.minDamage,8);assert.equal(x.maxDamage,10);
  assert.equal(x.outcomes.reduce((s,p)=>s+p.ways,0),39);
  assert.equal(dmg(255,1,100,255).preRandomDamage,999);
});
test('KO odds conditional on hit aggregate 39 weighted rolls',()=>{
  const x=dmg(40,40); const y=neutralKnockoutOdds({distribution:x,targetHpFromRam:10});
  assert.equal(y.ways,1);assert.equal(y.outOf,39);
  assert.equal(neutralKnockoutOdds({distribution:x,targetHpFromRam:100}).ways,0);
});
test('unverified neutral/type path refuses and zero defense invalid',()=>{
  assert.equal(neutralDamageDistribution({effectiveLevelByte:20,movePowerByte:40,
    scaledAttackByte:40,scaledDefenseByte:40,evidence:{...e,neutralDamagePathVerified:false}}).verified,false);
  assert.throws(()=>dmg(40,0),RangeError);
});
test('Master Ball is 100% after legal capturable routine validated',()=>{
  assert.equal(cap('MASTER_BALL',3,20,40).probability,1);
});
test('at HP low, W>255; status/ball conditioned catch chance exact',()=>{
  let x=cap('POKE_BALL',3,1,100);
  assert.ok(x.w>255);assert.equal(x.probability,4/256);
  x=cap('POKE_BALL',3,1,100,'SLP'); assert.equal(x.probability,29/256);
});
test('Great Ball rand1 range inclusive 0..200, Ultra inclusive 0..150',()=>{
  const a=cap('GREAT_BALL',3,1,100), b=cap('ULTRA_BALL',3,1,100);
  assert.equal(a.probability,4/201);assert.equal(b.probability,4/151);
});
test('captures with second RNG include Rand2 == X; w=255 deterministic second RNG',()=>{
  const x=cap('POKE_BALL',120,60,60);
  assert.equal(x.w,85);
  assert.equal(x.x,85);
  assert.equal(x.rand2SuccessOutOf256,86);
  assert.equal(x.probability,121*86/256/256);
});
test('refuse if battle not verified, invalid catch or status',()=>{
  assert.equal(cap('POKE_BALL',120,60,60,'NONE',{...e,legalThrowVerified:false}).verified,false);
  assert.equal(cap('POKE_BALL',120,60,60,'CONFUSION').verified,false);
  assert.throws(()=>cap('POKE_BALL',300,60,60),RangeError);
  assert.throws(()=>cap('POKE_BALL',100,61,60),RangeError);
});
