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
   const rom=require('../romComprehensiveAudit').readRom(process.env[key]);
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
test('metabloco 2D requer bytes exatos e SHA-256; nunca inferir colisão',()=>{
 const crypto=require('node:crypto');
 const pp=structuredClone(p);const data=Buffer.from([1,2,3,4,5,6]);
 Object.assign(pp.world.maps.data[0],{
  widthBlocks:3,heightBlocks:2,blockDataBase64:data.toString('base64'),
  blockSha256:crypto.createHash('sha256').update(data).digest('hex')});
 const good=staticMapGuide(pp,13).layout.blockGrid;
 assert.equal(good.verified,true);assert.equal(good.bytes,6);
 const corrupt=structuredClone(pp);corrupt.world.maps.data[0].blockSha256='0'.repeat(64);
 assert.equal(staticMapGuide(corrupt,13).layout.blockGrid.verified,false);
});

test('22 UNUSED_MAP reference slots are not misreported as undecoded playable areas',()=>{
 const {REFERENCE_UNUSED_IDS}=require('../romAreaGuide');
 assert.equal(REFERENCE_UNUSED_IDS.length,22);
 const reserved=new Set(REFERENCE_UNUSED_IDS);
 const synthetic=structuredClone(p);
 synthetic.world.maps.data=Array.from({length:248},(_,id)=>({
   mapId:id,valid:!reserved.has(id),mapBank:1,
   objects:{warps:[],signs:[],objects:[]}
 }));
 synthetic.world.wildEncounters.data=Array.from({length:248},(_,id)=>({
   mapId:id,grass:{rateByte:0,slots:[]},water:{rateByte:0,slots:[]}
 }));
 const report=mapGuideIndex(synthetic);
 assert.equal(report.normalHeadersValidated,226);
 assert.equal(report.reservedIdsWithoutHeader,22);
 assert.equal(report.unresolvedNonReservedIds,0);
 for(const id of reserved){
  const entry=report.maps[id];
  assert.equal(entry.verified,false);
  assert.equal(entry.status,'RESERVED_ID_NO_NORMAL_ROM_HEADER');
  assert.equal(entry.referenceUnusedSlot,true);
 }
});

test('binary map-object schema exposes real item/trainer/wild IDs and normalized warp bytes',()=>{
 const q=structuredClone(p);
 q.world.maps.data[0].objects={
  warps:[{x:5,y:5,destinationMap:37,destinationWarp:0},
   {x:9,y:8,destinationMap:255,destinationWarp:1}],
  signs:[{x:1,y:2,textId:4}],
  objects:[
   {spriteId:11,x:4,y:4,textId:129,kind:'item',trainerClassOrItemId:204},
   {spriteId:12,x:5,y:6,textId:65,kind:'trainer',
    trainerClassOrItemId:203,trainerNumberOrLevel:4},
   {spriteId:13,x:7,y:8,textId:66,kind:'wildPokemon',
    wildSpeciesInternalId:150,wildLevel:70}
  ]
 };
 q.world.maps.data[0].trainerEvents=[{objectOrdinal:2,eventBitIndex:91,source:'ROM_TEST'}];
 q.world.maps.data[0].staticEncounterEvents=[{objectOrdinal:3,eventBitIndex:92,source:'ROM_TEST'}];
 const guide=staticMapGuide(q,13);
 assert.equal(guide.verified,true);
 assert.equal(guide.visibleItems[0].itemId,204);
 assert.equal(guide.visibleItems[0].ordinal,1);
 assert.equal(guide.trainers[0].trainerClassId,203);
 assert.equal(guide.trainers[0].trainerNumber,4);
 assert.equal(guide.trainers[0].ordinal,2);
 assert.equal(guide.trainers[0].eventFlagIndex,91);
 assert.equal(guide.trainers[0].defeated,null);
 assert.equal(guide.staticPokemon[0].speciesInternalId,150);
 assert.equal(guide.staticPokemon[0].level,70);
 assert.equal(guide.staticPokemon[0].eventFlagIndex,92);
 assert.equal(guide.staticPokemon[0].caughtFromThisEvent,null);
 assert.deepEqual(guide.warps.map(w=>[w.map,w.warp]),[[37,0],[255,1]]);
 assert.equal(guide.warps[1].destinationMode,'LAST_MAP_FROM_RAM');
});
