'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {getLiveAdvice,getLiveAdviceContextKey}=require('../aiAdvisor');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const RED=AUDITED_ROM_SHA256.RED,BLUE=AUDITED_ROM_SHA256.BLUE;
const sample=(trainer='CTX1',sha=RED,mapId=15)=>({
 connected:true,isSimulation:false,lastUpdate:new Date().toISOString(),
 memoryReadStatus:{verified:true},inBattle:false,trainerName:trainer,
 romRuntimeIdentity:{matched:true,profileSha256:sha,reportedCRC32:'9F7FDD53'},
 mapId,mapName:'Route 4',coords:{x:8,y:9},
 party:[{name:'PIKACHU',level:20,hp:50,maxHp:50,moves:[]}],
 badges:[],inventory:[],money:100
});
async function withFakeApi(callback){
 const previous=global.fetch;let requests=0;
 global.fetch=async()=>({
  ok:true,json:async()=>({
   choices:[{message:{content:'Answer '+(++requests)}}]
  })
 });
 try{await callback(()=>requests);}
 finally{global.fetch=previous;}
}
test('identical ROM and runtime state reuse cached advice',async()=>{
 await withFakeApi(async count=>{
  const s=sample('SAME');s.adviceRuntimeScope='host:A|gen:1';
  assert.equal(await getLiveAdvice(s),'Answer 1');
  assert.equal(await getLiveAdvice(s),'Answer 1');
  assert.equal(count(),1);
 });
});
test('ROM and map changes require fresh AI context',async()=>{
 await withFakeApi(async count=>{
  await getLiveAdvice(sample('ROMMAP',RED,15));
  await getLiveAdvice(sample('ROMMAP',BLUE,15));
  await getLiveAdvice(sample('ROMMAP',BLUE,16));
  assert.equal(count(),3);
 });
});
test('team HP and inventory changes cannot inherit cached answer',async()=>{
 await withFakeApi(async count=>{
  const s=sample('HPINV');await getLiveAdvice(s);
  s.party[0].hp=10;await getLiveAdvice(s);
  s.inventory.push({id:1,name:'Potion',qty:2});await getLiveAdvice(s);
  assert.equal(count(),3);
 });
});
test('target generation enters cache key, missing ROM identity rejects it',()=>{
 const a=sample('GEN'),b=sample('GEN');
 a.adviceRuntimeScope='host:A|gen:1';
 b.adviceRuntimeScope='host:A|gen:2';
 assert.notEqual(getLiveAdviceContextKey(a),getLiveAdviceContextKey(b));
 b.romRuntimeIdentity.matched=false;
 assert.equal(getLiveAdviceContextKey(b),null);
});
