'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyMovementModeWindow}=require('../romMovementModeConsistency');
test('walk, bike and Surf double-read accepted, no atomic claim',()=>{
 for(let id=0;id<3;id++){
  const b=id.toString(16).padStart(2,'0');
  const r=verifyMovementModeWindow({firstModeByte:b,secondModeBytes:[b.toUpperCase()]});
  assert.equal(r.verified,true);assert.equal(r.modeByte,id);
  assert.equal(r.atomicSnapshotVerified,false);
 }
});
test('change from walking to surfing invalidates mode prediction',()=>{
 const r=verifyMovementModeWindow({firstModeByte:'00',secondModeBytes:['02']});
 assert.equal(r.verified,false);assert.equal(r.reason,'D700_CHANGED_DURING_SEQUENTIAL_READS');
});
test('unsupported movement bytes rejected',()=>{
 for(const b of ['03','ff','80'])assert.equal(verifyMovementModeWindow({firstModeByte:b,secondModeBytes:[b]}).verified,false);
});
test('missing or nonhex second sample rejects',()=>{
 for(const b of [[],null,['qq'],['00','00']])assert.equal(verifyMovementModeWindow({firstModeByte:'00',secondModeBytes:b}).verified,false);
});
