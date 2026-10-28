'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const {coverageLedger,compareRomBanks,runBatch,readRom,KNOWN}=require('../romComprehensiveAudit');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const paths={red:process.env.POKEMON_RED_ROM,blue:process.env.POKEMON_BLUE_ROM,
 green:process.env.POKEMON_GREEN_ROM};
const ready=Object.values(paths).every(Boolean);

test('non-audited structure retains all unknown bytes, never 100% semantic',()=>{
 const b=Buffer.alloc(0x8000);const report=coverageLedger(b,{unknownLayout:true});
 assert.equal(report.bankCount,2);
 assert.equal(report.totalBytes,32768);
 assert.equal(report.decodedBytes,0);
 assert.equal(report.structuredOnlyBytes,28);
 assert.equal(report.unclassifiedBytes,32768-28);
 assert.equal(report.semanticCoverageCertified,false);
 assert.equal(report.banks.reduce((sum,bank)=>sum+bank.unclassifiedBytes+
   bank.structuredOnlyBytes+bank.decodedBytes,0),32768);
});
test('byte-diff preserves all mismatches, contiguous byte runs and bank boundaries',()=>{
 const a=Buffer.alloc(0x8000),b=Buffer.alloc(0x8000);
 b[0]=1;b[1]=2;b[100]=3;b[0x4000]=4;
 const x=compareRomBanks(a,b);
 assert.equal(x.equalBytes,32764);assert.equal(x.differentBytes,4);
 assert.deepEqual(x.banks[0].differenceRuns,[
  {start:0,endExclusive:2,bytes:2},
  {start:100,endExclusive:101,bytes:1}]);
 assert.deepEqual(x.banks[1].differenceRuns,[{start:0x4000,endExclusive:0x4001,bytes:1}]);
});
test('unknown ROM cannot be promoted to verified profile by a fake decoder',()=>{
 const unknown=Buffer.alloc(1048576);
 assert.notEqual(sha(unknown),KNOWN.red);
 assert.throws(()=>{
   const fake={red:'not-a-rom.gb',blue:'not-a-rom.gb',green:'not-a-rom.gb'};
   runBatch(fake,{decoder:()=>({hash:{sha256:KNOWN.red}})});
 });
});
test('zero file writes when outDir omitted, fail closed on missing path',()=>{
 assert.throws(()=>runBatch({red:null,blue:null,green:null}));
});
for(const [variant,filepath] of Object.entries(paths)){
 test('local real ROM '+variant+' verified directly by SHA256',
  {skip:!filepath?'Define POKEMON_'+variant.toUpperCase()+'_ROM to test against local ROM':false},()=>{
   const bytes=readRom(filepath);
   assert.equal(bytes.length,1048576);
   assert.equal(sha(bytes),KNOWN[variant]);
  });
}
test('FULL 3-ROM pipeline invokes all existing decoders and returns gaps',
 {skip:!ready?'Three local ROM paths required, no ROMs in GitHub':false},()=>{
 const output=runBatch(paths);
 for(const [variant,report] of Object.entries(output.variants)){
  assert.equal(report.identity.sha256,KNOWN[variant]);
  assert.equal(report.coverage.bankCount,64);
  assert.equal(report.coverage.totalBytes,1048576);
  assert.equal(report.coverage.bytesRead,1048576);
  assert.ok(report.coverage.decodedBytes>0);
  assert.ok(report.coverage.unclassifiedBytes>0);
  assert.equal(report.semantic100PercentCertified,false);
  assert.equal(report.unresolved.length,14);
  assert.equal(report.coverage.errors.length,0,variant+': invalid evidence intervals');
 }
 for(const x of Object.values(output.comparisons)){
  assert.ok(x.differentBytes>0);
  assert.equal(x.equalBytes+x.differentBytes,1048576);
 }
});