'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditTextPointers,expected,main}=
  require('../scripts/auditRealRomTextPointers');
test('Gen I direct text table counts are tracked separately from script meaning',()=>{
 assert.equal(expected.interactions,674);
 assert.equal(expected.resolved,616);
 assert.equal(expected.unresolved,58);
 assert.equal(Object.values(expected.firstBytes).reduce((a,b)=>a+b,0),616);
});
test('text pointer auditor refuses unknown or truncated ROM bytes',()=>{
 assert.throws(()=>auditTextPointers(Buffer.alloc(16)),/1 MiB/);
 assert.throws(()=>auditTextPointers(Buffer.alloc(1048576)),/SHA-256/);
});
test('text pointer CLI requires all three variants',()=>{
 assert.throws(()=>main([]),/três caminhos/);
 assert.throws(()=>main(['only-one']),/três caminhos/);
});

test('all 409 verified TX_FAR command entries need real ROM-bank destinations',()=>{
 const count=expected.firstBytes['17'];
 assert.equal(count,409);
 assert.equal(expected.interactions,expected.resolved+expected.unresolved);
 // A real binary with unknown SHA is rejected before decoding anything.
 assert.throws(()=>auditTextPointers(Buffer.alloc(1048576)),/SHA-256/);
});
