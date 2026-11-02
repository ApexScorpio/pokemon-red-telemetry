'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const {interpretHandler}=require('../romScriptSemantics');
const {
 groupMapRootIndexedJumpRequirements,
 mapScriptRootEvidence
}=require('../romMapScriptRootSemantics');
const {KNOWN}=require('../romComprehensiveAudit');

const OFFSET=0x18020;
const BANK=Math.floor(OFFSET/0x4000);

function fixture(valid=true){
 const rom=Buffer.alloc(1048576);

 rom.set([
  0x21,0x85,0x58,
  0xfa,0x4a,0xd6,
  0x87,0x5f,
  0x16,0x00,
  0x19,0x2a,
  valid?0x66:0x00,
  0x6f,0x11,0x00,0x00,
  0xd5,0xe9
 ],OFFSET);

 for(let i=0;i<128;i++){
  const physical=BANK*0x4000+
   (0x5885+i*2-0x4000);

  rom[physical]=0x19;
  rom[physical+1]=0x32;
 }

 return rom;
}

test('indexed pointer requirement is conditional, not observed',()=>{
 const result=interpretHandler({
  rom:fixture(),fileOffset:OFFSET,
  entryKind:'MAP_SCRIPT_ROOT'
 });

 assert.equal(result.verified,true);
 assert.equal(result.effects.length,0);
 assert.equal(result.observedExecution,false);
 assert.equal(result.eventCompleted,null);
 assert.equal(
  result.unresolved.filter(u=>
   u.reason==='INDIRECT_MEMORY_UNKNOWN'
  ).length,1
 );

 assert.equal(result.indexedJumpRequirements.length,1);

 const r=result.indexedJumpRequirements[0];

 assert.equal(r.sourceAddress,0xd64a);
 assert.equal(r.baseCpuAddress,0x5885);
 assert.equal(r.assumedBank,BANK);
 assert.equal(r.pointerCandidateCount,128);
 assert.equal(r.targetCandidateCount,1);
 assert.equal(r.fixedRomCandidates,128);
 assert.equal(r.outsideRomCandidates,0);
 assert.equal(r.runtimeRamReadObserved,false);
 assert.equal(r.actualBankSelectionVerified,false);
 assert.equal(r.indirectJumpObserved,false);
 assert.equal(r.gameplayExecutionObserved,false);
 assert.equal(r.gameEventCompleted,false);
});

test('different instruction pattern does not invent a table',()=>{
 const result=interpretHandler({
  rom:fixture(false),fileOffset:OFFSET,
  entryKind:'MAP_SCRIPT_ROOT'
 });

 assert.equal(result.verified,true);
 assert.deepEqual(result.indexedJumpRequirements,[]);
});

test('groups are counted and invalid records rejected',()=>{
 const r={
  reason:'LIVE_RAM_REQUIRED_FOR_INDEXED_ROM_JUMP_TABLE',
  sourceAddress:0xd64a,
  instructionOffset:0x3d9f,
  baseCpuAddress:0x5885,
  assumedBank:23,
  pointerCandidateCount:128,
  targetCandidateCount:97,
  fixedRomCandidates:53,
  switchableRomCandidates:42,
  outsideRomCandidates:33,
  runtimeRamReadObserved:false,
  actualBankSelectionVerified:false,
  indirectJumpObserved:false,
  gameplayExecutionObserved:false,
  gameEventCompleted:false
 };

 const out=groupMapRootIndexedJumpRequirements([
  r,{...r},{...r,sourceAddress:0xda39},
  null,{...r,pointerCandidateCount:127},
  {...r,actualBankSelectionVerified:true}
 ]);

 assert.equal(out.length,2);
 assert.equal(
  out.find(x=>x.sourceAddress===0xd64a)
   .conditionalPathRequirements,2
 );
 assert.equal(
  out.find(x=>x.sourceAddress===0xda39)
   .conditionalPathRequirements,1
 );
 assert.deepEqual(groupMapRootIndexedJumpRequirements(null),[]);
});

test('map evidence is copied and protected by ROM identity',()=>{
 const requirement={
  reason:'LIVE_RAM_REQUIRED_FOR_INDEXED_ROM_JUMP_TABLE',
  sourceAddress:0xd64a,
  instructionOffset:0x3d9f,
  baseCpuAddress:0x5885,
  assumedBank:23,
  pointerCandidateCount:128,
  targetCandidateCount:97,
  fixedRomCandidates:53,
  switchableRomCandidates:42,
  outsideRomCandidates:33,
  runtimeRamReadObserved:false,
  actualBankSelectionVerified:false,
  indirectJumpObserved:false,
  gameplayExecutionObserved:false,
  gameEventCompleted:false,
  conditionalPathRequirements:1
 };

 const root={
  rootIndex:0,fileOffset:382907,bank:23,
  cpuAddress:0x57bb,effectCount:0,effects:[],
  unresolvedCount:2,
  unresolvedReasonCounts:{INDIRECT_MEMORY_UNKNOWN:2},
  unresolvedSamples:[],unresolvedSamplesBounded:false,
  completeBoundedAnalysis:false,
  runtimeRamRequirements:[],
  runtimeIndexedJumpRequirements:[requirement],
  preconditions:['MAP_SCRIPT_ROOT_INVOKED'],
  rootInvokedInCurrentPlay:false,
  actualBankSelectionVerified:false,
  observedExecution:false
 };

 const catalogue={
  verified:true,
  source:'SHA_VERIFIED_MAP_SCRIPT_ROOT_ABSTRACT_EXECUTION_V1',
  romSha256:KNOWN.red,
  rows:Array.from({length:226},(_,index)=>({
   mapId:index===225?233:index,rootIndex:0
  })),
  roots:[root],
  rootInvocationObserved:false,
  gameplayCompleted:false,
  fullMapScriptSemanticsCertified:false
 };

 const result=mapScriptRootEvidence({
  catalogue,romSha256:KNOWN.red,mapId:233
 });

 assert.equal(result.verified,true);
 assert.equal(result.runtimeIndexedJumpRequirements.length,1);
 assert.equal(
  result.runtimeIndexedJumpRequirements[0].sourceAddress,
  0xd64a
 );

 result.runtimeIndexedJumpRequirements[0].sourceAddress=0;

 assert.equal(
  root.runtimeIndexedJumpRequirements[0].sourceAddress,
  0xd64a
 );

 assert.equal(mapScriptRootEvidence({
  catalogue,romSha256:KNOWN.blue,mapId:233
 }),null);
});

test('UI keeps original map, ROM and non-execution guards',()=>{
 const app=fs.readFileSync(
  path.join(__dirname,'..','public','app.js'),'utf8'
 );

 assert.ok(app.includes('mapRootT190.romSha256===runtimeSha'));
 assert.ok(app.includes('mapRootT190.mapId===advice.mapId'));
 assert.ok(app.includes('mapRootIndexedT206'));
 assert.ok(app.includes('r.runtimeRamReadObserved!==false'));
 assert.ok(app.includes('r.actualBankSelectionVerified!==false'));
 assert.ok(app.includes('r.indirectJumpObserved!==false'));
 assert.ok(app.includes('r.gameplayExecutionObserved!==false'));
 assert.ok(app.includes('r.gameEventCompleted!==false'));
});