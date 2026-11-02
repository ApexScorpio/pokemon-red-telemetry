'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const {KNOWN}=require('../romComprehensiveAudit');

const {selectSymbolicWramTargets}=
 require('../romSymbolicWramLiveTargets');

function fixture(byte=0xff){
 const playerBlock=Array(530).fill('00');
 playerBlock[0xd369-0xd158]=
  byte.toString(16).padStart(2,'0');

 const loopIterations=0;
 const finalBC=4;

 const requirement={
  reason:'LIVE_RAM_REQUIRED_FOR_SYMBOLIC_WRAM_WRITE_TARGET',
  sourceAddress:0xd369,
  instructionOffset:0x19d40,
  sourceAddend:6,
  baseCpuAddress:0xc6e8,
  symbolicMultiplier:3,
  loopIterations,
  fixedAddend:3,
  finalBC,
  candidateCount:256,
  candidateMin:0xc6ef,
  candidateMax:0xc9ec,
  memoryRegion:'WRAM',
  targetValue:null,
  conditionalPathRequirements:2,
  runtimeRamReadObserved:false,
  targetAddressObserved:false,
  memoryWriteObserved:false,
  gameplayExecutionObserved:false,
  gameEventCompleted:false
 };

 const evidence={
  verified:true,
  mapId:209,
  romSha256:KNOWN.red,
  runtimeSymbolicWriteRequirements:[requirement]
 };

 return {playerBlock,evidence};
}

function resolve(changes={}){
 const f=fixture();

 return selectSymbolicWramTargets({
  ...f,
  romSha256:KNOWN.red,
  mapId:209,
  eligible:true,
  ...changes
 });
}

test('resolves the ROM formula using the D369 sample',()=>{
 const result=resolve();

 assert.equal(result.verified,true);
 assert.equal(result.candidateTargets.length,1);
 assert.equal(result.additionalUdpRequests,0);

 const row=result.candidateTargets[0];

 assert.equal(row.sourceByte,255);
 assert.equal(row.candidateAddress,0xc6fe);
 assert.equal(row.targetAddressObserved,false);
 assert.equal(row.memoryWriteObserved,false);
 assert.equal(row.gameEventCompleted,false);
});

test('rejects missing publication eligibility',()=>{
 const result=resolve({eligible:false});

 assert.equal(result.verified,false);
 assert.deepEqual(result.candidateTargets,[]);
});

test('rejects wrong ROM and map',()=>{
 for(const changes of [
  {romSha256:KNOWN.blue},
  {mapId:207}
 ]){
  const result=resolve(changes);
  assert.equal(result.verified,false);
 }
});

test('rejects incomplete or invalid D369 samples',()=>{
 const bad=fixture();
 bad.playerBlock[0xd369-0xd158]='GG';

 for(const playerBlock of [
  bad.playerBlock,
  Array(529).fill('00'),
  null
 ]){
  assert.equal(
   resolve({playerBlock}).verified,
   false
  );
 }
});

test('rejects malformed ROM symbolic requirements',()=>{
 for(const change of [
  {sourceAddress:0xd368},
  {sourceAddend:5},
  {symbolicMultiplier:99},
  {memoryRegion:'VRAM'},
  {candidateCount:128},
  {memoryWriteObserved:true}
 ]){
  const f=fixture();
  Object.assign(
   f.evidence.runtimeSymbolicWriteRequirements[0],
   change
  );

  const result=selectSymbolicWramTargets({
   ...f,
   romSha256:KNOWN.red,
   mapId:209,
   eligible:true
  });

  assert.equal(result.verified,false);
 }
});

test('supports another verified multiplier',()=>{
 const f=fixture(2);
 const r=f.evidence.runtimeSymbolicWriteRequirements[0];

 r.loopIterations=1;
 r.symbolicMultiplier=4;
 r.candidateMin=0xc6ef;
 r.candidateMax=0xcaeb;

 const result=selectSymbolicWramTargets({
  ...f,
  romSha256:KNOWN.red,
  mapId:209,
  eligible:true
 });

 assert.equal(result.verified,true);
 assert.equal(
  result.candidateTargets[0].candidateAddress,
  0xc70f
 );
});

test('never accepts a candidate outside WRAM',()=>{
 const f=fixture();
 const r=f.evidence.runtimeSymbolicWriteRequirements[0];

 r.candidateMin=0xd000;
 r.candidateMax=0xd100;

 const result=selectSymbolicWramTargets({
  ...f,
  romSha256:KNOWN.red,
  mapId:209,
  eligible:true
 });

 assert.equal(result.verified,false);
});

test('integration preserves source and final safety gates',()=>{
 const root=path.join(__dirname,'..');

 const client=fs.readFileSync(
  path.join(root,'retroarchClient.js'),'utf8'
 );

 const app=fs.readFileSync(
  path.join(root,'public','app.js'),'utf8'
 );

 assert.ok(client.includes(
  'selectSymbolicWramTargets({'
 ));

 assert.ok(client.includes(
  'playerBlock:blockPlayerParty'
 ));

 assert.ok(client.includes(
  'publicationPositionWindow.verified===true'
 ));

 assert.ok(client.includes(
  'this.latestState.romSymbolicWramTargetSelection='
 ));

 assert.ok(app.includes('symbolicWramT236'));
 assert.ok(app.includes('memoryWriteObserved===false'));
});