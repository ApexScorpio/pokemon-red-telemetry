'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditWorldObjects,main,expected}=
  require('../scripts/auditRealWorldInteractions');
test('known real-binary baseline accounts for full map actor and sign formats',()=>{
 assert.deepEqual(expected,{maps:226,warps:813,signs:202,npc:472,
   trainer:334,item:106,wildPokemon:12,
   invalidCoordinates:0,bankTableOffset:49725});
});
test('truncated or forged ROM buffer never produces a certified map inventory',()=>{
 assert.throws(()=>auditWorldObjects(Buffer.alloc(10)),/1 MiB/);
 assert.throws(()=>auditWorldObjects(Buffer.alloc(1048576)),
   /SHA-256 não pertence/);
});
test('strict auditor requires exactly the three distinct ROM files',()=>{
 assert.throws(()=>main([]),/exatamente 3/);
 assert.throws(()=>main(['not-a-file']),/exatamente 3/);
});
