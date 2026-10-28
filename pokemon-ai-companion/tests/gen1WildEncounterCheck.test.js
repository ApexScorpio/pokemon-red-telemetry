'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const {wildEncounterCheckOdds,SLOT_WEIGHTS}=require('../gen1WildEncounterCheck');
const evidence={identifiedRomSha256Verified:true,
  romSha256:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
  encounterTableFromSameRomVerified:true,liveRamSnapshotVerified:true,
  preEncounterChecksPassedVerified:true,encounterMediumResolvedVerified:true,
  slotRngUniformModelAppliesVerified:true};
const slots=SLOT_WEIGHTS.map((rollWeight,i)=>({
  slot:i,rollWeight,internalId:i%2?112:36,level:i+1}));
const run=(other={})=>wildEncounterCheckOdds({
  rateByteFromRom:25,slotsFromRom:slots,repelStepsFromRam:0,
  firstPartyLevelFromRam:5,evidence,...other});
test('without Repel: rate 25/256 and full 256 slot weights',()=>{
 const r=run();assert.equal(r.verified,true);
 assert.equal(r.encounterAccepted.probability,25/256);
 assert.equal(r.blockedByRepel.probability,0);
 assert.ok(Math.abs(r.conditionalSpeciesLevel.reduce((n,s)=>
   n+s.probabilityPerEligibleCheck.probability,0)-25/256)<1e-15);
});
test('Repel active: exact count of weighted slot/RNG pairs',()=>{
 const r=run({repelStepsFromRam:2,firstPartyLevelFromRam:5});
 const weight=25+13+11+25+13+3;
 assert.equal(r.acceptedSlotWeightsOutOf256,weight);
 assert.equal(r.encounterAccepted.probability,25*weight/65536);
 assert.equal(r.blockedByRepel.probability,25*(256-weight)/65536);
 assert.equal(r.noAcceptedEncounter.probability,1-25*weight/65536);
});
test('the last Repel step returns before the RNG check',()=>{
 const r=run({repelStepsFromRam:1});
 assert.equal(r.repelWearsOffWithoutEncounter,true);
 assert.equal(r.encounterRngCheck.probability,0);
 assert.equal(r.encounterAccepted.probability,0);
 assert.equal(r.noAcceptedEncounter.probability,1);
});
test('first party Pokemon level, not highest or first living, controls Repel',()=>{
 const r=run({repelStepsFromRam:3,firstPartyLevelFromRam:100});
 assert.equal(r.acceptedSlotWeightsOutOf256,0);
 assert.equal(r.encounterAccepted.probability,0);
});
test('rejects corrupted table, no evidence and impossible rate-zero slots',()=>{
 assert.equal(run({rateByteFromRom:0,slotsFromRom:[]}).encounterAccepted.probability,0);
 assert.equal(run({rateByteFromRom:0}).verified,false);
 assert.equal(run({slotsFromRom:slots.slice(1)}).verified,false);
 assert.equal(run({slotsFromRom:[{...slots[0],rollWeight:50},...slots.slice(1)]}).verified,false);
 assert.equal(run({evidence:{...evidence,liveRamSnapshotVerified:false}}).verified,false);
});
const ROMS=[
 ['Red','POKEMON_RED_ROM','5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'],
 ['Blue','POKEMON_BLUE_ROM','2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'],
 ['Green','POKEMON_GREEN_ROM','aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']
];
for(const [name,key,sha] of ROMS){
 test('real ROM '+name+' / Route 2 / Repel level 5',{
   skip:!process.env[key]?'Set '+key+' to local .gb to execute':false
 },()=>{
   const b=fs.readFileSync(process.env[key]);
   assert.equal(crypto.createHash('sha256').update(b).digest('hex'),sha);
   const ptr=b.readUInt16LE(0xCEEB+13*2);
   const offset=3*0x4000+ptr-0x4000;
   const rate=b[offset];
   const wildSlots=SLOT_WEIGHTS.map((rollWeight,i)=>({
     slot:i,rollWeight,level:b[offset+1+i*2],
     internalId:b[offset+2+i*2]
   }));
   const e={...evidence,romSha256:sha};
   const baseline=run({rateByteFromRom:rate,slotsFromRom:wildSlots,evidence:e});
   assert.equal(rate,25);assert.equal(baseline.verified,true);
   assert.equal(baseline.encounterAccepted.probability,25/256);
   const repel=run({rateByteFromRom:rate,slotsFromRom:wildSlots,
     repelStepsFromRam:3,firstPartyLevelFromRam:5,evidence:e});
   assert.equal(repel.acceptedSlotWeightsOutOf256,41);
   assert.equal(repel.encounterAccepted.probability,25*41/65536);
   const caterOrWeedle=wildSlots.filter(s=>s.internalId===(name==='Red'?112:123));
   assert.equal(caterOrWeedle.reduce((n,s)=>n+s.rollWeight,0),39);
 });
}