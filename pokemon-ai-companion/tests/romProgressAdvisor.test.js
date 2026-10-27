'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {milestones,nextPartyAlerts,daycareAdvice}=require('../romProgressAdvisor');
const {expAtLevel}=require('../gen1EngineMath');
function fixture(){
 const species=Array.from({length:190},(_,i)=>({
  internalId:i+1,name:'SPECIES '+(i+1),learnset:[],evolutions:[],stats:{growthRateId:0}
 }));
 species[113]={internalId:114,name:'BEEDRILL',stats:{growthRateId:0},
  learnset:[{level:16,moveId:116},{level:20,moveId:41}],evolutions:[]};
 species[147]={internalId:148,name:'ABRA',stats:{growthRateId:3},
  learnset:[],evolutions:[{method:1,args:[16,38]}]};
 species[37].name='KADABRA';
 species[166].name='NIDORINO';
 species[166].evolutions=[{method:2,args:[10,1,7]}];
 species[6].name='NIDOKING';
 species[37].evolutions=[{method:3,args:[1,149]}];
 species[148].name='ALAKAZAM';
 const growth={id:3,origin:'ROM: GrowthRateTable (4 bytes por grupo)',
  numerator:6,denominator:5,squaredCoefficient:-15,linearCoefficient:100,constantToSubtract:140};
 const names=Array(165).fill(null);names[40]='TWINEEDLE';
 return {species,moveNames:names,growthRates:Array.from({length:6},(_,i)=>i===3?growth:null)};
}
test('Beedrill nível 18 alerta para Twineedle nível 20 sem fabricar opções de substituição',()=>{
 const p=fixture(),result=nextPartyAlerts(p,[{speciesId:114,level:18,partyIndex:0}]);
 assert.equal(result.verified,true);
 assert.equal(result.alerts[0].nextMilestone.name,'TWINEEDLE');
 assert.equal(result.alerts[0].nextMilestone.moveId,41);
 assert.equal(result.alerts[0].urgent,true);
});
test('Abra na creche: levantamento calculado dois níveis antes do 16',()=>{
 const p=fixture(),exp=expAtLevel(p.growthRates[3],11);
 const d=daycareAdvice(p,{speciesId:148,depositedLevel:11,experience:exp});
 assert.equal(d.verified,true);
 assert.equal(d.currentLevel,11);
 assert.equal(d.nextMilestone.level,16);
 assert.equal(d.pickupAtLevel,14);
 assert.ok(d.stepsUntilPickupEstimate>0);
});
test('Gen I: 3 parâmetros para pedra e 2 para evolução por troca',()=>{
 const p=fixture();
 const stone=milestones(p,167)[0],trade=milestones(p,38)[0];
 assert.equal(stone.kind,'EVOLUTION_ITEM');
 assert.equal(stone.itemId,10);
 assert.equal(stone.minimumLevel,1);
 assert.equal(stone.evolveToInternalId,7);
 assert.equal(stone.name,'NIDOKING');
 assert.equal(trade.kind,'EVOLUTION_TRADE');
 assert.equal(trade.minimumLevel,1);
 assert.equal(trade.evolveToInternalId,149);
 assert.equal(trade.name,'ALAKAZAM');
});
test('não calcula marcos quando CRC da ROM não tem perfil correspondente',()=>{
 const r=nextPartyAlerts(null,[{speciesId:114,level:18}]);
 assert.equal(r.verified,false);
 const daycare=daycareAdvice(null,{speciesId:148,depositedLevel:11,experience:1000});
 assert.equal(daycare.verified,false);
});