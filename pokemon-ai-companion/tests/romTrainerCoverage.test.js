'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditTrainerCoverage,currentMapTrainerCoverage}=require('../romTrainerCoverage');
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function objects(n){return {objects:Array.from({length:n},(_,i)=>({
 kind:'trainer',trainerClassOrItemId:201,trainerNumberOrLevel:i+1,x:i,y:8
}))};}
test('Route 6 auditada, outro mapa desconhecido sinalizado',()=>{
 const profile={hash:{sha256:SHA},world:{maps:{data:[
  {valid:true,mapId:17,objects:objects(6)},
  {valid:true,mapId:0,objects:objects(1)},
  {valid:true,mapId:1,objects:{objects:[]}}
 ]}}};
 const result=auditTrainerCoverage(profile);
 assert.equal(result.verified,true);
 assert.equal(result.mapsWithTrainers,2);
 assert.equal(result.mapsFullyMapped,1);
 assert.equal(result.humanTrainerObjects,7);
 assert.equal(result.trainerEventLinksMapped,6);
 assert.equal(result.trainerEventLinksUnknown,1);
 assert.equal(currentMapTrainerCoverage(result,17).fullCoverage,true);
 assert.deepEqual(currentMapTrainerCoverage(result,0).missing.map(x=>x.objectOrdinal),[1]);
});
test('não auditar mapas não descodificados nem inventar ligações',()=>{
 assert.equal(auditTrainerCoverage(null).verified,false);
 const result=auditTrainerCoverage({hash:{sha256:'0'.repeat(64)},world:{
  maps:{data:[{valid:true,mapId:17,objects:objects(6)}]}
 }});
 assert.equal(result.trainerEventLinksMapped,0);
 assert.equal(result.trainerEventLinksUnknown,6);
});
