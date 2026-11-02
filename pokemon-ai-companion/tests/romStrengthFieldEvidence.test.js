'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readStrengthFieldEvidence,START,FLAG,OFFSET,LENGTH}
 =require('../romStrengthFieldEvidence');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const sample=v=>({romSha256:sha,romIdentityMatched:true,
 mapWindowVerified:true,positionWindowVerified:true,
 worldBlockHex:Array.from({length:LENGTH},(_,i)=>i===OFFSET?v:'00')});
test('actual D728 Strength bit is read from existing D5A0 block',()=>{
 assert.equal(START,0xD5A0);assert.equal(FLAG,0xD728);
 assert.equal(OFFSET,0x188);assert.equal(LENGTH,784);
 const r=readStrengthFieldEvidence(sample('01'));
 assert.equal(r.verified,true);assert.equal(r.activeAtSample,true);
 assert.equal(r.pushObserved,false);assert.equal(r.snapshotAtomicVerified,false);
});
test('other status bits do not activate Strength',()=>{
 for(const [byte,expected] of [['00',false],['02',false],
   ['01',true],['81',true]]){
   assert.equal(readStrengthFieldEvidence(sample(byte)).activeAtSample,expected);
 }
});
test('wrong ROM, stale map/position, truncated bytes fail closed',()=>{
 const s=sample('01');
 for(const args of [{...s,romIdentityMatched:false},
   {...s,romSha256:'0'.repeat(64)},
   {...s,mapWindowVerified:false},
   {...s,positionWindowVerified:false},
   {...s,worldBlockHex:['01']},
   sample('GG')]){
   const r=readStrengthFieldEvidence(args);
   assert.equal(r.verified,false);assert.equal(r.activeAtSample,null);
 }
});
