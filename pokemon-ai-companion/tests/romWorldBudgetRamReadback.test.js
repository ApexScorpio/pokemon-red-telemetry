'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const {KNOWN}=require('../romComprehensiveAudit');

const {
 selectBudgetWindow,
 collectWorldBudgetRamReadback
}=require('../romWorldBudgetRamReadback');

function fixture(){
 const block=Array(512).fill('00');
 const scope={host:'192.0.2.5',port:55355,generation:3};

 const candidates=[
  [0xc100,10],
  [0xc200,120],
  [0xc20e,110],
  [0xc21e,80],
  [0xc22e,40]
 ].map(([address,conditionalStoppedPaths])=>({
  address,
  conditionalStoppedPaths,
  runtimeRamReadObserved:false,
  liveValueKnown:false
 }));

 for(const c of candidates){
  block[c.address-0xc100]=
   (c.address&255).toString(16).padStart(2,'0');
 }

 const evidence={
  verified:true,
  romSha256:KNOWN.red,
  mapId:43,
  runtimeBudgetConditionRamSources:{
   reason:'PATH_BUDGET_CONDITION_RAM_DEPENDENCIES',
   source:'ROM_ABSTRACT_CONDITION_HISTORY',
   pathBudgetStops:128,
   pathsResolved:false,
   distinctCandidateRamSources:5,
   candidateSources:candidates
  }
 };

 return {block,scope,evidence};
}

async function collect(overrides={}){
 const f=fixture();
 let calls=0;

 const result=await collectWorldBudgetRamReadback({
  evidence:f.evidence,
  romSha256:KNOWN.red,
  mapId:43,
  eligible:true,
  firstSpriteBlock:f.block,
  getTargetScope:()=>f.scope,
  readMemoryBlock:async(start,length)=>{
   calls++;
   assert.ok(length>=1&&length<=128);

   const at=parseInt(start,16);

   return f.block.slice(
    at-0xc100,
    at-0xc100+length
   );
  },
  ...overrides
 });

 return {result,calls};
}

test('selects a compact high-evidence RAM range',()=>{
 const selected=selectBudgetWindow(
  fixture().evidence
 );

 assert.ok(selected);
 assert.ok(selected.length>=1);
 assert.ok(selected.length<=128);
 assert.equal(selected.start,0xc200);
 assert.deepEqual(
  selected.sources.map(x=>x.address),
  [0xc200,0xc20e,0xc21e,0xc22e]
 );
 assert.equal(selected.sourcesNotSelected,1);
});

test('reads once and corroborates every selected byte',async()=>{
 const {result,calls}=await collect();

 assert.equal(calls,1);
 assert.equal(result.verified,true);
 assert.equal(result.extraReadBytes,47);
 assert.equal(result.values.length,4);
 assert.ok(
  result.values.every(x=>
   x.repeatedReadMatched&&
   x.firstValue===x.secondValue
  )
 );
 assert.equal(result.atomicSnapshotVerified,false);
 assert.equal(result.scriptExecutionObserved,false);
 assert.equal(result.gameEventCompleted,false);
});

test('preserves T221 maps without an additional read',async()=>{
 for(const mapId of [31,34,36]){
  const f=fixture();

  const {result,calls}=await collect({
   mapId,
   evidence:{...f.evidence,mapId}
  });

  assert.equal(result.verified,false);
  assert.equal(calls,0);
 }
});

test('invalid map and ROM identity never cause UDP',async()=>{
 const f=fixture();

 for(const values of [
  {eligible:false},
  {romSha256:'0'.repeat(64)},
  {mapId:44},
  {evidence:{...f.evidence,verified:false}}
 ]){
  const {result,calls}=await collect(values);

  assert.equal(result.verified,false);
  assert.equal(calls,0);
 }
});

test('rejects changing RAM between samples',async()=>{
 const f=fixture();

 const {result,calls}=await collect({
  readMemoryBlock:async(start,length)=>{
   const at=parseInt(start,16);
   const bytes=f.block.slice(
    at-0xc100,at-0xc100+length
   );

   bytes[0]='FE';
   return bytes;
  }
 });

 assert.equal(calls,0);
 assert.equal(result.verified,false);
 assert.equal(result.values.length,0);
});

test('rejects a target generation change',async()=>{
 const f=fixture();
 let generation=3;

 const {result}=await collect({
  getTargetScope:()=>({
   ...f.scope,
   generation:generation++
  })
 });

 assert.equal(result.verified,false);
});

test('rejects incomplete read and reader exception',async()=>{
 for(const reader of [
  async()=>[],
  async()=>{throw Error('UDP failed');}
 ]){
  const {result}=await collect({
   readMemoryBlock:reader
  });

  assert.equal(result.verified,false);
  assert.deepEqual(result.values,[]);
 }
});

test('rejects invalid first sample without UDP',async()=>{
 const {result,calls}=await collect({
  firstSpriteBlock:Array(512).fill('GG')
 });

 assert.equal(result.verified,false);
 assert.equal(calls,0);
});

test('integration keeps final publication and session guards',()=>{
 const client=fs.readFileSync(
  path.join(__dirname,'..','retroarchClient.js'),'utf8'
 );

 const app=fs.readFileSync(
  path.join(__dirname,'..','public','app.js'),'utf8'
 );

 assert.ok(client.includes(
  'collectWorldBudgetRamReadback({'
 ));
 assert.ok(client.includes(
  'publicationPositionWindow.verified===true'
 ));
 assert.ok(client.includes(
  'this.latestState.romWorldBudgetRamReadback='
 ));
 assert.ok(client.includes(
  "'romWorldBudgetRamReadback'"
 ));
 assert.ok(app.includes('worldBudgetRamT231'));
 assert.ok(app.includes(
  'worldBudgetRamT231.romSha256===runtimeSha'
 ));
 assert.ok(app.includes(
  'worldBudgetRamT231.mapId===advice.mapId'
 ));
 assert.ok(app.includes(
  'worldBudgetRamT231.observedAt===state.lastUpdate'
 ));
 assert.ok(app.includes(
  'worldBudgetRamT231.gameEventCompleted===false'
 ));
});