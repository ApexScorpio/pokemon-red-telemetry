'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const {KNOWN}=
 require('../romComprehensiveAudit');

const {
 readExistingSource,
 selectIndexedJumpLiveWords
}=require('../romIndexedJumpLiveSelection');

function fixture(withByte=true){
 const words=Buffer.alloc(256);

 // 0x83 selects pointer index 3.
 words.writeUInt16LE(0x4567,6);

 const table={
  source:'VERIFIED_ROM_INDEXED_TABLE_WORDS_128_V1',
  sourceAddress:0xda39,
  instructionOffset:0x3d9f,
  assumedBank:6,
  baseCpuAddress:0x5800,
  pointerPositions:128,
  inputBytePossibilities:256,
  pointerIndexFormula:'SOURCE_BYTE_AND_0X7F',
  targetWordsLittleEndianHex:words.toString('hex'),
  bankSelectionObserved:false,
  runtimeSourceByteObserved:false,
  indirectJumpObserved:false,
  instructionTargetsProven:false,
  gameEventCompleted:false
 };

 const requirement={
  reason:'LIVE_RAM_REQUIRED_FOR_INDEXED_ROM_JUMP_TABLE',
  sourceAddress:0xda39,
  instructionOffset:0x3d9f,
  assumedBank:6,
  baseCpuAddress:0x5800,
  runtimeRamReadObserved:false,
  actualBankSelectionVerified:false,
  indirectJumpObserved:false,
  gameplayExecutionObserved:false,
  gameEventCompleted:false
 };

 return {
  blocks:{
   player:Array(530).fill('00'),
   world:Array(784).fill('00'),
   sprites:Array(512).fill('00'),
   nearBoxDA39:withByte?['83']:null
  },
  evidence:{
   verified:true,
   romSha256:KNOWN.red,
   mapId:209,
   indexedRomTableWords:[table],
   runtimeIndexedJumpRequirements:[requirement]
  }
 };
}

function select(changes={},withByte=true){
 const f=fixture(withByte);

 return selectIndexedJumpLiveWords({
  ...f,
  romSha256:KNOWN.red,
  mapId:209,
  eligible:true,
  ...changes
 });
}

test('DA39 byte selects exact ROM word',()=>{
 const result=select();

 assert.equal(result.verified,true);
 assert.equal(result.selections.length,1);
 assert.equal(result.additionalUdpRequests,1);

 const row=result.selections[0];

 assert.equal(row.sourceAddress,0xda39);
 assert.equal(row.sourceRamByte,0x83);
 assert.equal(row.sourceReadBlock,'EXTRA_DA39');
 assert.equal(row.pointerIndex,3);
 assert.equal(row.rawTargetCpu,0x4567);
 assert.equal(row.indirectJumpObserved,false);
 assert.equal(row.gameEventCompleted,false);
});

test('missing DA39 sample fails closed',()=>{
 const result=select({},false);

 assert.equal(result.verified,false);
 assert.deepEqual(result.selections,[]);
});

test('DA39 cannot substitute a neighboring address',()=>{
 assert.equal(
  readExistingSource({
   nearBoxDA39:['83']
  },0xda38),
  null
 );

 assert.equal(
  readExistingSource({
   nearBoxDA39:['83']
  },0xda3a),
  null
 );
});

test('bad DA39 lengths and values are refused',()=>{
 for(const nearBoxDA39 of [
  [],['83','01'],['GG'],[131],null
 ]){
  const f=fixture();

  f.blocks.nearBoxDA39=nearBoxDA39;

  const result=selectIndexedJumpLiveWords({
   ...f,
   romSha256:KNOWN.red,
   mapId:209,
   eligible:true
  });

  assert.equal(result.verified,false);
 }
});

test('wrong ROM, map and eligibility are refused',()=>{
 for(const changes of [
  {romSha256:KNOWN.blue},
  {mapId:207},
  {eligible:false}
 ]){
  const result=select(changes);

  assert.equal(result.verified,false);
  assert.deepEqual(result.selections,[]);
 }
});

test('existing T234 block remains zero-extra-read',()=>{
 const f=fixture();

 const original=f.evidence.indexedRomTableWords[0];
 const requirement=f.evidence.runtimeIndexedJumpRequirements[0];

 original.sourceAddress=0xd643;
 requirement.sourceAddress=0xd643;

 f.blocks.world[0xd643-0xd5a0]='83';

 const result=selectIndexedJumpLiveWords({
  ...f,
  romSha256:KNOWN.red,
  mapId:209,
  eligible:true
 });

 assert.equal(result.verified,true);
 assert.equal(result.additionalUdpRequests,0);
 assert.equal(
  result.selections[0].sourceReadBlock,
  'WORLD_D5A0'
 );
});

test('client still uses final publication guard',()=>{
 const root=path.join(__dirname,'..');

 const client=fs.readFileSync(
  path.join(root,'retroarchClient.js'),'utf8'
 );

 const ui=fs.readFileSync(
  path.join(root,'public','app.js'),'utf8'
 );

 assert.ok(client.includes(
  "this.readMemoryBlock('DA39',1)"
 ));

 assert.ok(client.includes(
  'const t235NeedsDA39='
 ));

 assert.ok(client.includes(
  't234Evidence.mapId===this.latestState.mapId'
 ));

 assert.ok(client.includes(
  'publicationPositionWindow.verified===true'
 ));

 assert.ok(client.includes(
  'matchesTargetScope(this,pollTargetScope)'
 ));

 assert.ok(ui.includes(
  'indexedJumpLiveT234.additionalUdpRequests<=1'
 ));

 assert.ok(ui.includes(
  'indexedJumpLiveT234.indirectJumpObserved===false'
 ));
});