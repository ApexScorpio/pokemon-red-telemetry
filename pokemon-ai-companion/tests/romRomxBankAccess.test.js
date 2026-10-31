'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyRomxHeaderBankCandidates}=require('../romRomxBankAccess');
const rom=(type=3,size=5)=>{const b=Buffer.alloc(1048576);b[0x147]=type;b[0x148]=size;return b;};
test('standard MBC1 1MiB condition excludes ROMX physical bank 32',()=>{
 const r=classifyRomxHeaderBankCandidates({rom:rom(),targetCpu:0x5000});
 assert.equal(r.verified,true);
 assert.equal(r.physicalMappingCount,63);
 assert.deepEqual(r.excludedIfStandardMbc1,[32]);
 assert.equal(r.conditionalCandidateCount,62);
 assert.equal(r.physicalMappings[31].fileOffset,32*0x4000+0x1000);
 assert.equal(r.physicalMappings[30].selectableIfStandardMbc1,true);
 assert.equal(r.physicalMappings[31].selectableIfStandardMbc1,false);
 assert.equal(r.physicalMappings[32].selectableIfStandardMbc1,true);
 assert.equal(r.activeBankKnown,false);
});
test('unsupported bank controllers never inherit MBC1 exclusions',()=>{
 for(const [type,size] of [[0x1b,5],[3,6],[0,5]]){
  const r=classifyRomxHeaderBankCandidates({rom:rom(type,size),targetCpu:0x4000});
  assert.equal(r.verified,true);
  assert.equal(r.conditionalCandidateCount,null);
  assert.deepEqual(r.excludedIfStandardMbc1,[]);
  assert.ok(r.physicalMappings.every(x=>x.selectableIfStandardMbc1===null));
 }
});
test('invalid requests fail closed',()=>{
 for(const arg of [{},{rom:Buffer.alloc(256),targetCpu:0x5000},
  {rom:rom(),targetCpu:0x3fff},{rom:rom(),targetCpu:0x8000},
  {rom:rom(),targetCpu:20480.5}]){
  const r=classifyRomxHeaderBankCandidates(arg);
  assert.equal(r.verified,false);
  assert.equal(r.semantic100PercentCertified,false);
 }
});
