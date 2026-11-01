'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const {
 groupMapRootRuntimeRequirements,
 mapScriptRootEvidence
}=require('../romMapScriptRootSemantics');

const {KNOWN}=require('../romComprehensiveAudit');

const requirement=index=>({
 sourceAddress:0xffb8,
 instructionOffset:0x3e90,
 bankRegisterAddress:0x2000,
 controller:'MBC3',
 reason:'LIVE_RAM_BYTE_REQUIRED_FOR_SYMBOLIC_BANK_WRITE',
 physicalCandidateCount:63,
 conditions:[{sample:index}]
});

test('30 FFB8 requirements retain exact count in one group',()=>{
 const groups=groupMapRootRuntimeRequirements(
  Array.from({length:30},(_,i)=>requirement(i))
 );

 assert.equal(groups.length,1);

 const r=groups[0];

 assert.equal(r.sourceAddress,0xffb8);
 assert.equal(r.instructionOffset,0x3e90);
 assert.equal(r.bankRegisterAddress,0x2000);
 assert.equal(r.physicalCandidateCount,63);
 assert.equal(r.conditionalPathRequirements,30);
 assert.equal(r.runtimeRamReadObserved,false);
 assert.equal(r.selectedBank,null);
 assert.equal(r.bankRegisterWriteObserved,false);
 assert.equal(r.gameplayExecutionObserved,false);
 assert.equal(r.gameEventCompleted,false);
});

test('distinct physical sites and bank counts never merge',()=>{
 const groups=groupMapRootRuntimeRequirements([
  requirement(1),
  {...requirement(2),instructionOffset:0x3e77},
  {...requirement(3),physicalCandidateCount:62}
 ]);

 assert.equal(groups.length,3);

 assert.equal(
  groups.reduce((sum,r)=>sum+r.conditionalPathRequirements,0),
  3
 );
});

test('null and unsupported memory sources fail closed',()=>{
 const groups=groupMapRootRuntimeRequirements([
  null,
  undefined,
  {},
  {...requirement(1),sourceAddress:-1},
  {...requirement(2),sourceAddress:0x2000},
  {...requirement(3),sourceAddress:0xff20},
  {...requirement(4),bankRegisterAddress:0x8000},
  {...requirement(5),controller:'UNKNOWN'},
  {...requirement(6),reason:'UNVERIFIED'}
 ]);

 assert.deepEqual(groups,[]);
 assert.deepEqual(groupMapRootRuntimeRequirements(null),[]);
});

test('map evidence copies grouped requirements without inventing runtime state',()=>{
 const original=groupMapRootRuntimeRequirements(
  Array.from({length:30},(_,i)=>requirement(i))
 );

 const root={
  rootIndex:0,
  fileOffset:0x12000,
  bank:4,
  cpuAddress:0x4000,
  effects:[],
  effectCount:0,
  unresolvedCount:30,
  unresolvedReasonCounts:{
   UNRESOLVED_MEMORY_OR_BANK_WRITE:30
  },
  unresolvedSamples:[],
  unresolvedSamplesBounded:true,
  completeBoundedAnalysis:false,
  preconditions:['MAP_SCRIPT_ROOT_INVOKED'],
  runtimeRamRequirements:original,
  rootInvokedInCurrentPlay:false,
  actualBankSelectionVerified:false,
  observedExecution:false
 };

 const catalogue={
  verified:true,
  source:'SHA_VERIFIED_MAP_SCRIPT_ROOT_ABSTRACT_EXECUTION_V1',
  romSha256:KNOWN.red,
  rows:Array.from({length:226},(_,mapId)=>({
   mapId,rootIndex:0
  })),
  roots:[root],
  rootInvocationObserved:false,
  gameplayCompleted:false,
  fullMapScriptSemanticsCertified:false
 };

 const evidence=mapScriptRootEvidence({
  catalogue,
  romSha256:KNOWN.red,
  mapId:34
 });

 assert.equal(evidence.verified,true);
 assert.equal(evidence.runtimeRamRequirements.length,1);

 assert.equal(
  evidence.runtimeRamRequirements[0].conditionalPathRequirements,
  30
 );

 assert.equal(evidence.actualBankSelectionVerified,false);
 assert.equal(evidence.gameplayCompleted,false);

 assert.equal(mapScriptRootEvidence({
  catalogue,
  romSha256:KNOWN.blue,
  mapId:34
 }),null);

 evidence.runtimeRamRequirements[0].selectedBank=5;

 assert.equal(
  root.runtimeRamRequirements[0].selectedBank,
  null
 );
});

test('UI preserves ROM identity and non-execution guards',()=>{
 const app=fs.readFileSync(
  path.join(__dirname,'..','public','app.js'),
  'utf8'
 );

 assert.ok(app.includes('const mapRootRamGroupsT198='));
 assert.ok(app.includes('mapRootT190.romSha256===runtimeSha'));
 assert.ok(app.includes('mapRootT190.gameplayCompleted===false'));
 assert.ok(app.includes('r.runtimeRamReadObserved!==false'));
 assert.ok(app.includes('r.bankRegisterWriteObserved!==false'));
 assert.ok(app.includes('r.selectedBank!==null'));
 assert.ok(app.includes('diagnostico manual FFB8'));
});