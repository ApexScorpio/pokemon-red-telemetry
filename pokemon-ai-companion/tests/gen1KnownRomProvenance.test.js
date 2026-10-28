'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {AUDITED_ROM_SHA256,isKnownAuditedRomSha}=require('../romKnownSha256');
const {captureProbability}=require('../gen1CaptureProbability');
const {standardHitChance}=require('../gen1StandardHitChance');
const {criticalChance,neutralDamageDistribution}=require('../gen1CombatProbabilities');
const {wildEncounterCheckOdds}=require('../gen1WildEncounterCheck');
const known=Object.values(AUDITED_ROM_SHA256);
const allFlags=sha=>({
 romSha256:sha,exactRomSha256Verified:true,identifiedRomSha256Verified:true,
 liveRamSnapshotVerified:true,ordinaryBallEffectVerified:true,legalThrowVerified:true,
 standardHitTestAppliesVerified:true,criticalHitTestAppliesVerified:true,
 neutralDamagePathVerified:true,encounterTableFromSameRomVerified:true,
 preEncounterChecksPassedVerified:true,encounterMediumResolvedVerified:true,
 slotRngUniformModelAppliesVerified:true
});
const ratios=Array.from({length:13},()=>({numerator:1,denominator:1}));
function modules(evidence){
 return {
  master:captureProbability({ball:'MASTER_BALL',evidence}),
  normalBall:captureProbability({ball:'POKE_BALL',actualCatchRateFromRam:45,
    hpFromRam:10,maxHpFromRam:30,statusFromRam:'NONE',evidence}),
  accuracy:standardHitChance({accuracyByteFromRom:255,accuracyStageFromRam:7,
    evasionStageFromRam:7,statModifierRatiosFromRom:ratios,evidence}),
  critical:criticalChance({baseSpeedFromRom:100,powerByteFromRom:40,
    highCriticalFromRom:false,focusEnergyActiveFromRam:false,evidence}),
  damage:neutralDamageDistribution({effectiveLevelByte:20,movePowerByte:40,
    scaledAttackByte:40,scaledDefenseByte:40,evidence}),
  encounter:wildEncounterCheckOdds({rateByteFromRom:0,slotsFromRom:[],
    repelStepsFromRam:0,firstPartyLevelFromRam:10,evidence})
 };
}
test('a lista SHA-256 contém exatamente Red, Blue e Green International',()=>{
 assert.deepEqual(Object.keys(AUDITED_ROM_SHA256),[
   'RED','BLUE','GREEN_INTERNATIONAL_1_2_1']);
 assert.equal(new Set(known).size,3);
 known.forEach(h=>assert.match(h,/^[a-f0-9]{64}$/));
});
test('cada módulo aceita as três identidades previamente auditadas',()=>{
 for(const sha of known){
   assert.equal(isKnownAuditedRomSha(sha),true);
   assert.equal(isKnownAuditedRomSha(sha.toUpperCase()),true);
   for(const [name,result] of Object.entries(modules(allFlags(sha))))
     assert.equal(result.verified,true,`${name} sha=${sha}`);
 }
});
test('falso SHA-256 com formato válido é recusado em todos os 6 ramos',()=>{
 const sha='0'.repeat(64);
 assert.equal(isKnownAuditedRomSha(sha),false);
 for(const [name,result] of Object.entries(modules(allFlags(sha))))
   assert.equal(result.verified,false,name);
});
test('SHA-256 ausente, malformado e não-string são recusados',()=>{
 for(const sha of [undefined,null,1,'not-a-sha','X'.repeat(64)]){
   assert.equal(isKnownAuditedRomSha(sha),false);
   for(const [name,result] of Object.entries(modules(allFlags(sha))))
     assert.equal(result.verified,false,name);
 }
});
test('mesmo SHA aprovado não ignora RAM não comprovada',()=>{
 for(const sha of known){
   for(const [name,result] of Object.entries(modules({...allFlags(sha),
     liveRamSnapshotVerified:false})))
     assert.equal(result.verified,false,name);
 }
});
test('o guarda SHA não substitui identidade do emulador nem prova frame atómico',()=>{
 assert.equal(typeof isKnownAuditedRomSha,'function');
 assert.equal(known.length,3);
});
