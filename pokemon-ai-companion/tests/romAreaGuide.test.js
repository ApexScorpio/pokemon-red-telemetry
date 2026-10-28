'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {staticMapGuide,mapGuideIndex}=require('../romAreaGuide');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const weights=[51,51,39,25,25,25,13,13,11,3];
const p={hash:{sha256:sha},unknownLayout:false,
 species:Array.from({length:190},(_,i)=>({internalId:i+1,dex:i+1,name:'MON'+(i+1)})),
 trainerParties:{verified:false},world:{maps:{valid:true,data:[{mapId:13,valid:true,mapBank:21,
  widthTiles:20,heightTiles:72,objects:{warps:[{map:1,x:2,y:3}],signs:[],
  objects:[{kind:'item',x:4,y:5,ordinal:1,metadata:[10]},
   {kind:'trainer',x:3,y:6,ordinal:2,metadata:[230,5]}]}}]},
  wildEncounters:{valid:true,data:[{mapId:13,grass:{rateByte:25,slots:weights.map((weight,i)=>({slot:i,weight,internalId:36,level:i<5?3:5}))},water:{rateByte:0,slots:[]}}]},
  hiddenItemScripts:{valid:true,items:[{mapId:13,x:7,y:8,itemId:12}]}}};
test('full map entry includes static items, trainer, hidden item and verified conditional RNG',()=>{
 const g=staticMapGuide(p,13);assert.equal(g.verified,true);
 assert.equal(g.visibleItems[0].itemId,10);assert.equal(g.visibleItems[0].obtained,null);
 assert.equal(g.hiddenItems[0].itemId,12);assert.equal(g.trainers[0].defeated,null);
 assert.equal(g.encounters.terrain[0].conditionalRngCheck.percent,25/256*100);
 assert.equal(g.encounters.terrain[0].speciesAndLevels.reduce((n,r)=>n+r.weight,0),256);
 assert.equal(g.encounters.terrain[0].chancePerStepVerified,false);
 assert.equal(g.allContentsKnown,false);
});
test('unknown identity/map has no false recommendation',()=>{
 assert.equal(staticMapGuide({...p,hash:{sha256:'0'.repeat(64)}},13).verified,false);
 assert.equal(staticMapGuide(p,200).verified,false);
 assert.equal(staticMapGuide(p,999).verified,false);
});
test('wrong encounter slots are flagged without fabricating probabilities',()=>{
 const corrupt=structuredClone(p);corrupt.world.wildEncounters.data[0].grass.slots[0].weight=1;
 assert.equal(staticMapGuide(corrupt,13).encounters.verified,false);
});
test('map catalogue index is generated without inventing absent map data',()=>{
 const out=mapGuideIndex(p);assert.equal(out.verified,true);
 assert.equal(out.maps.length,1);
 assert.equal(out.maps[0].mapId,13);
});

for(const [name,key,expectedSha] of [
 ['red','POKEMON_RED_ROM','5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'],
 ['blue','POKEMON_BLUE_ROM','2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'],
 ['green','POKEMON_GREEN_ROM','aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']]) {
 test('ROM real '+name+': Route 2 has map items and conditional encounter distribution',
  {skip:!process.env[key]||!process.env.POKEGUIDE_INVENTORY_JSON},()=>{
   const fs=require('node:fs'),crypto=require('node:crypto');
   const rom=fs.readFileSync(process.env[key]);
   assert.equal(crypto.createHash('sha256').update(rom).digest('hex'),expectedSha);
   const audit=JSON.parse(fs.readFileSync(process.env.POKEGUIDE_INVENTORY_JSON,'utf8')).variants[name];
   const g=staticMapGuide({hash:{sha256:expectedSha},unknownLayout:false,
     species:audit.catalogue.species,trainerParties:{verified:false},
     world:{maps:{valid:true,data:audit.catalogue.maps},
       wildEncounters:{valid:true,data:audit.catalogue.wildEncounters}}},13);
   assert.equal(g.verified,true);
   assert.equal(g.encounters.terrain[0].conditionalRngCheck.numerator,25);
   assert.equal(g.encounters.terrain[0].conditionalRngCheck.denominator,256);
   assert.equal(g.visibleItems.length,2);
   assert.equal(g.encounters.terrain[0].speciesAndLevels.reduce((sum,x)=>sum+x.weight,0),256);
  });
}