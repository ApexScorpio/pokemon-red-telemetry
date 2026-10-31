'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyMbc3ConditionalBanks}=require('../romMbc3ConditionalBanks');
const site=(pc,value)=>({writePc:pc,conditionalByte:value,
 executed:false,bankActiveVerified:false});
const plan=sites=>({verified:true,sites,siteCount:sites.length,runtimeBankVerified:false});
test('zero selects bank one conditionally, never proves runtime execution',()=>{
 const r=classifyMbc3ConditionalBanks({plan:plan([site(0x100,0)])});
 assert.equal(r.verified,true);
 assert.equal(r.candidates[0].selectedBankIfExecuted,1);
 assert.equal(r.candidates[0].zeroAliasToBankOne,true);
 assert.equal(r.candidates[0].physicalBankStartOffset,0x4000);
 assert.equal(r.executedBankWrites,0);
 assert.equal(r.activeBankVerified,false);
});
test('high bit is ignored by MBC3 and 0x80 becomes bank one',()=>{
 const r=classifyMbc3ConditionalBanks({plan:plan([site(0x100,0x80)])});
 assert.equal(r.candidates[0].selectedBankIfExecuted,1);
 assert.equal(r.candidates[0].highBitIgnored,true);
 assert.equal(r.highBitIgnoredSites,1);
 assert.equal(r.zeroAliasSites,1);
});
test('MBC3 supports ROM bank 32 as physical bank 32',()=>{
 const r=classifyMbc3ConditionalBanks({plan:plan([site(0x100,0x20)])});
 assert.equal(r.candidates[0].selectedBankIfExecuted,32);
 assert.equal(r.candidates[0].physicalBankStartOffset,32*0x4000);
 assert.equal(r.candidates[0].physicalBankEndExclusive,33*0x4000);
});
test('bank 63 exists; bank 64, 127 and masked 255 are beyond 1 MiB file',()=>{
 const r=classifyMbc3ConditionalBanks({plan:plan([
  site(0x100,63),site(0x200,64),site(0x300,127),site(0x400,255)
 ])});
 assert.equal(r.inPhysicalFileSites,1);
 assert.equal(r.outsidePhysicalFileSites,3);
 assert.equal(r.candidates[0].physicalBankEndExclusive,1048576);
 assert.ok(r.candidates.slice(1).every(x=>x.physicalBankStartOffset===null));
 assert.equal(r.activeBankVerified,false);
});
test('unknown sources never default to bank one',()=>{
 const r=classifyMbc3ConditionalBanks({plan:plan([
  site(0x100,null),site(0x200,undefined),site(0x300,5)
 ])});
 assert.equal(r.candidateByteSites,1);
 assert.equal(r.unknownByteSites,2);
 assert.deepEqual(r.missingSourceWritePcs,[0x100,0x200]);
 assert.deepEqual(r.distinctConditionalBanksInFile,[5]);
});
test('repeated candidates retain site count and deduplicate distinct banks',()=>{
 const r=classifyMbc3ConditionalBanks({plan:plan([
  site(0x100,5),site(0x200,5),site(0x300,7)
 ])});
 assert.equal(r.candidateByteSites,3);
 assert.deepEqual(r.distinctConditionalBanksInFile,[5,7]);
 assert.equal(r.linkedRomxTransferSites,0);
});
test('invalid candidates and claims of live execution fail closed',()=>{
 for(const p of [
  null,{},plan([site(0x100,256)]),plan([site(0x100,-1)]),
  plan([site(0x100,1.5)]),plan([site(0x100,5),site(0x100,6)]),
  plan([{...site(0x100,5),executed:true}]),
  {...plan([]),runtimeBankVerified:true},
  {...plan([site(0x100,1)]),siteCount:2}
 ])assert.equal(classifyMbc3ConditionalBanks({plan:p}).verified,false);
});
