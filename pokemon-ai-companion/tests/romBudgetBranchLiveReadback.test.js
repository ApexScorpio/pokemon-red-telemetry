'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const {KNOWN}=require('../romComprehensiveAudit');

const {
 collectBudgetBranchLiveReadback
}=require('../romBudgetBranchLiveReadback');

const SHA=KNOWN.red;

function sample(){
 const first=Array(512).fill('00');
 const second=Array(33).fill('00');

 for(const [address,value] of [
  [0xc21e,'11'],
  [0xc22e,'22'],
  [0xc23e,'33']
 ]){
  first[address-0xc100]=value;
  second[address-0xc21e]=value;
 }

 const scope={host:'192.0.2.1',port:55355,generation:7};

 const evidence={
  verified:true,
  romSha256:SHA,
  mapId:31,
  runtimeBudgetConditionRamSources:{
   reason:'PATH_BUDGET_CONDITION_RAM_DEPENDENCIES',
   pathsResolved:false,
   candidateSources:[
    0xc21e,0xc22e,0xc23e
   ].map(address=>({
    address,
    runtimeRamReadObserved:false,
    liveValueKnown:false
   }))
  }
 };

 return {first,second,scope,evidence};
}

async function collect(overrides={}){
 const s=sample();
 let calls=0;

 const result=await collectBudgetBranchLiveReadback({
  evidence:s.evidence,
  romSha256:SHA,
  mapId:31,
  firstSpriteBlock:s.first,
  eligible:true,
  getTargetScope:()=>s.scope,
  readMemoryBlock:async(address,length)=>{
   calls++;
   assert.equal(address,'C21E');
   assert.equal(length,33);
   return s.second;
  },
  ...overrides
 });

 return {result,calls};
}

test('accepts exactly three doubly matched real-byte candidates',async()=>{
 const {result,calls}=await collect();

 assert.equal(result.verified,true);
 assert.equal(calls,1);
 assert.equal(result.values.length,3);
 assert.deepEqual(
  result.values.map(r=>[r.address,r.value]),
  [[0xc21e,17],[0xc22e,34],[0xc23e,51]]
 );
 assert.equal(result.twoReadSamplesConfirmed,true);
 assert.equal(result.atomicSnapshotVerified,false);
 assert.equal(result.scriptExecutionObserved,false);
 assert.equal(result.gameEventCompleted,false);
});

test('rejects changed RAM values',async()=>{
 const s=sample();
 s.second[16]='FE';

 const {result}=await collect({
  readMemoryBlock:async()=>s.second
 });

 assert.equal(result.verified,false);
 assert.equal(result.values.length,0);
});

test('rejects target generation changes',async()=>{
 const s=sample();
 let generation=7;

 const {result}=await collect({
  getTargetScope:()=>({
   ...s.scope,generation:generation++
  })
 });

 assert.equal(result.verified,false);
 assert.equal(result.values.length,0);
});

test('rejects unverified ROM and map mismatch without UDP',async()=>{
 const s=sample();

 for(const inputs of [
  {romSha256:'0'.repeat(64)},
  {mapId:212},
  {evidence:{...s.evidence,verified:false}},
  {eligible:false}
 ]){
  const {result,calls}=await collect(inputs);
  assert.equal(result.verified,false);
  assert.equal(calls,0);
 }
});

test('rejects stale, missing and invalid first samples',async()=>{
 const {result,calls}=await collect({
  firstSpriteBlock:Array(512).fill('GG')
 });

 assert.equal(result.verified,false);
 assert.equal(calls,0);
});

test('fails closed on incomplete second block and exceptions',async()=>{
 for(const readMemoryBlock of [
  async()=>['00'],
  async()=>{throw Error('UDP unavailable');}
 ]){
  const {result}=await collect({readMemoryBlock});

  assert.equal(result.verified,false);
  assert.equal(result.values.length,0);
 }
});

test('source integration keeps final map and target guards',()=>{
 const client=fs.readFileSync(
  path.join(__dirname,'..','retroarchClient.js'),'utf8'
 );

 const app=fs.readFileSync(
  path.join(__dirname,'..','public','app.js'),'utf8'
 );

 assert.ok(client.includes(
  'collectBudgetBranchLiveReadback({'
 ));
 assert.ok(client.includes(
  'publicationPositionWindow.verified===true'
 ));
 assert.ok(client.includes(
  'this.latestState.romBudgetBranchRamReadback='
 ));
 assert.ok(client.includes(
  "'romBudgetBranchRamReadback'"
 ));
 assert.ok(app.includes('mapBudgetRamLiveT221'));
 assert.ok(app.includes('mapBudgetRamLiveT221.romSha256===runtimeSha'));
 assert.ok(app.includes('mapBudgetRamLiveT221.mapId===advice.mapId'));
 assert.ok(app.includes('mapBudgetRamLiveT221.observedAt===state.lastUpdate'));
 assert.ok(app.includes('mapBudgetRamLiveT221.gameEventCompleted===false'));
});