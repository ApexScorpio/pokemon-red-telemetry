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

function fixture(address=0xd369,byte=0x83){
 const blocks={
  player:Array(530).fill('00'),
  world:Array(784).fill('00'),
  sprites:Array(512).fill('00')
 };

 const region=address>=0xd158&&address<0xd158+530?
  ['player',0xd158]:
  address>=0xd5a0&&address<0xd5a0+784?
   ['world',0xd5a0]:
   ['sprites',0xc100];

 blocks[region[0]][address-region[1]]=
  byte.toString(16).padStart(2,'0');

 const words=Buffer.alloc(256);
 words.writeUInt16LE(0x4321,6);

 const table={
  source:'VERIFIED_ROM_INDEXED_TABLE_WORDS_128_V1',
  sourceAddress:address,
  instructionOffset:0x19d40,
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
  sourceAddress:address,
  instructionOffset:table.instructionOffset,
  assumedBank:6,
  baseCpuAddress:table.baseCpuAddress,
  runtimeRamReadObserved:false,
  actualBankSelectionVerified:false,
  indirectJumpObserved:false,
  gameplayExecutionObserved:false,
  gameEventCompleted:false
 };

 const evidence={
  verified:true,
  mapId:209,
  romSha256:KNOWN.red,
  indexedRomTableWords:[table],
  runtimeIndexedJumpRequirements:[requirement]
 };

 return {blocks,evidence};
}

function select(address=0xd369,changes={}){
 const {blocks,evidence}=fixture(address);

 return selectIndexedJumpLiveWords({
  evidence,
  romSha256:KNOWN.red,
  mapId:209,
  blocks,
  eligible:true,
  ...changes
 });
}

test('maps D369 source byte into ROM index',()=>{
 const result=select();

 assert.equal(result.verified,true);
 assert.equal(result.selections.length,1);

 const selected=result.selections[0];

 assert.equal(selected.sourceRamByte,0x83);
 assert.equal(selected.pointerIndex,3);
 assert.equal(selected.pointerCpu,0x5806);
 assert.equal(selected.rawTargetCpu,0x4321);
 assert.equal(selected.targetClass,
  'SWITCHABLE_ROM_WORD_ASSUMED_BANK');
 assert.equal(selected.candidatePhysicalOffset,
  6*16384+0x321);

 assert.equal(result.additionalUdpRequests,0);
 assert.equal(result.indirectJumpObserved,false);
 assert.equal(result.gameEventCompleted,false);
});

test('supports an existing world-block source',()=>{
 const result=select(0xd747);

 assert.equal(result.verified,true);
 assert.equal(result.selections[0].sourceAddress,0xd747);
 assert.equal(
  result.selections[0].sourceReadBlock,
  'WORLD_D5A0'
 );
});

test('supports an existing sprite-block source',()=>{
 const result=select(0xc21e);

 assert.equal(result.verified,true);
 assert.equal(
  result.selections[0].sourceReadBlock,
  'SPRITES_C100'
 );
});

test('rejects missing runtime publication gates',()=>{
 const result=select(0xd369,{eligible:false});

 assert.equal(result.verified,false);
 assert.deepEqual(result.selections,[]);
});

test('rejects wrong ROM and map identities',()=>{
 for(const change of [
  {romSha256:KNOWN.blue},
  {mapId:207},
  {evidence:{...fixture().evidence,verified:false}}
 ]){
  const result=select(0xd369,change);

  assert.equal(result.verified,false);
  assert.deepEqual(result.selections,[]);
 }
});

test('rejects malformed and unavailable RAM data',()=>{
 const {blocks,evidence}=fixture();

 blocks.player[0xd369-0xd158]='XX';

 const bad=selectIndexedJumpLiveWords({
  evidence,
  romSha256:KNOWN.red,
  mapId:209,
  blocks,
  eligible:true
 });

 assert.equal(bad.verified,false);

 assert.equal(
  readExistingSource({
   player:Array(100).fill('00')
  },0xd369),
  null
 );
});

test('rejects corrupted ROM table words',()=>{
 const {blocks,evidence}=fixture();

 evidence.indexedRomTableWords[0]
  .targetWordsLittleEndianHex='01';

 const result=selectIndexedJumpLiveWords({
  evidence,
  romSha256:KNOWN.red,
  mapId:209,
  blocks,
  eligible:true
 });

 assert.equal(result.verified,false);
});

test('rejects missing indexed jump requirement',()=>{
 const {blocks,evidence}=fixture();

 evidence.runtimeIndexedJumpRequirements=[];

 const result=selectIndexedJumpLiveWords({
  evidence,
  romSha256:KNOWN.red,
  mapId:209,
  blocks,
  eligible:true
 });

 assert.equal(result.verified,false);
});

test('integration preserves final publication and invalidation',()=>{
 const root=path.join(__dirname,'..');

 const client=fs.readFileSync(
  path.join(root,'retroarchClient.js'),'utf8'
 );

 const app=fs.readFileSync(
  path.join(root,'public','app.js'),'utf8'
 );

 assert.ok(client.includes(
  'selectIndexedJumpLiveWords({'
 ));

 assert.ok(client.includes(
  'publicationPositionWindow.verified===true'
 ));

 assert.ok(client.includes(
  'this.latestState.romIndexedJumpLiveSelection='
 ));

 assert.ok(client.includes(
  "'romIndexedJumpLiveSelection'"
 ));

 assert.ok(app.includes('indexedJumpLiveT234'));

 assert.ok(app.includes(
  'indexedJumpLiveT234.romSha256===runtimeSha'
 ));

 assert.ok(app.includes(
  'indexedJumpLiveT234.observedAt===state.lastUpdate'
 ));

 assert.ok(app.includes(
  'indexedJumpLiveT234.indirectJumpObserved===false'
 ));
});