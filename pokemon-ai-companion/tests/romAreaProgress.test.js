'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeAreaProgress}=require('../romAreaProgress');
test('estados diferentes: oculto recolhido, objeto removido e treinador desconhecido',()=>{
 const area={
  verified:true,mapId:15,
  items:[{removedFromMap:true},{removedFromMap:false},{removedFromMap:null}],
  trainers:[{defeated:null},{defeated:null}]
 };
 const hidden={verified:true,source:'ROM+RAM',items:[
  {isCollected:true},{isCollected:false}
 ]};
 const p=makeAreaProgress(area,hidden,{matched:true});
 assert.equal(p.hiddenItems.obtainedConfirmed,1);
 assert.equal(p.hiddenItems.stillAvailableConfirmed,1);
 assert.equal(p.visibleItemObjects.removedFromMapConfirmed,1);
 assert.equal(p.visibleItemObjects.notRemovedConfirmed,1);
 assert.equal(p.visibleItemObjects.unknownFlag,1);
 assert.equal(p.visibleItemObjects.collectedConfirmed,null);
 assert.equal(p.trainers.defeatedConfirmed,null);
 assert.equal(p.trainers.statusUnknown,2);
 assert.equal(p.remainingConfirmed,1);
});
test('rom sem correspondência: não contar eventos nem itens como concluídos',()=>{
 const r=makeAreaProgress({verified:true,items:[],trainers:[]},
   {verified:true,items:[]},{matched:false});
 assert.equal(r.verified,false);
 assert.equal(r.remainingConfirmed,null);
});
