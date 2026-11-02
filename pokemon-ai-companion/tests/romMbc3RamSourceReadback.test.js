'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {SOURCE_CPU_ADDRESSES,verifyMbc3SourceRamReadback}=
 require('../romMbc3RamSourceReadback');
const args=(a)=>({addresses:[...SOURCE_CPU_ADDRESSES],
 firstHex:Array(8).fill('A0'),repeatHex:Array(8).fill('a0'),
 romCrcMatched:true,mapRepeated:true,
 positionRepeated:true,statusRepeated:true,...a});
test('all eight audited RAM/HRAM addresses are pinned from Bridge 038',()=>{
 assert.deepEqual(SOURCE_CPU_ADDRESSES,[
  0xc0ef,0xcf08,0xcf09,0xd0b7,0xd52b,0xff8b,0xffb9,0xffe8]);
 assert.ok(SOURCE_CPU_ADDRESSES.every(a=>
  (a>=0xc000&&a<=0xdfff)||(a>=0xff80&&a<=0xfffe)));
});
test('two equal case-normalized readbacks corroborate values but never bank',()=>{
 const r=verifyMbc3SourceRamReadback(args());
 assert.equal(r.verified,true);
 assert.equal(r.stableRamBytes,8);
 assert.equal(r.readOnlyBytesRequested,16);
 assert.equal(r.runtimeBankVerified,false);
 assert.equal(r.selectedBank,null);
 assert.equal(r.atomicSnapshotVerified,false);
 assert.equal(r.playerActionConfirmed,false);
 assert.ok(r.samples.every(s=>s.stable&&
  s.firstHex===s.repeatHex&&s.registerWriteExecuted===false));
});
test('reject changed WRAM or HRAM source even when ROM status is stable',()=>{
 for(const i of [0,4,7]){
  const repeat=Array(8).fill('a0');repeat[i]='A1';
  const r=verifyMbc3SourceRamReadback(args({repeatHex:repeat}));
  assert.equal(r.verified,false);
  assert.equal(r.status,'RAM_SOURCE_READBACK_CHANGED');
  assert.deepEqual(r.changedAddresses,[SOURCE_CPU_ADDRESSES[i]]);
  assert.equal(r.runtimeBankVerified,false);
 }
});
test('reject unknown addresses, wrong ordering, duplicates or extra probes',()=>{
 const invalid=[
  [0xc000,...SOURCE_CPU_ADDRESSES.slice(1)],
  [...SOURCE_CPU_ADDRESSES].reverse(),
  [...SOURCE_CPU_ADDRESSES,0xfff0],
  [...SOURCE_CPU_ADDRESSES.slice(0,7),SOURCE_CPU_ADDRESSES[0]]
 ];
 for(const addresses of invalid){
  const r=verifyMbc3SourceRamReadback(args({addresses}));
  assert.equal(r.status,'RAM_SOURCE_ADDRESS_CONTRACT_REJECTED');
  assert.equal(r.verified,false);
 }
});
test('reject uncorroborated ROM, map, position or final status',()=>{
 for(const name of ['romCrcMatched','mapRepeated',
  'positionRepeated','statusRepeated']){
  const r=verifyMbc3SourceRamReadback(args({[name]:false}));
  assert.equal(r.status,'ROM_MAP_POSITION_OR_STATUS_UNCORROBORATED');
  assert.equal(r.runtimeBankVerified,false);
 }
});
test('reject missing, malformed, truncated or misaligned memory results',()=>{
 for(const opts of [
  {firstHex:Array(7).fill('00')},
  {repeatHex:Array(8).fill('ZZ')},
  {firstHex:'00'},
  {repeatHex:Array(8).fill('0')}
 ]){
  const r=verifyMbc3SourceRamReadback(args(opts));
  assert.equal(r.status,'RAM_SOURCE_BYTES_INVALID');
  assert.equal(r.verified,false);
 }
});
