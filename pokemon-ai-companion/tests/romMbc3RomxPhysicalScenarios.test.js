'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildMbc3RomxPhysicalScenarios}=require('../romMbc3RomxPhysicalScenarios');
const {classifyRomxHeaderBankCandidates}=require('../romRomxBankAccess');
const make=()=>{const r=Buffer.alloc(1048576,0xc9);r[0x147]=19;r[0x148]=5;return r;};
const bank=(pc,n)=>({rom0WritePc:pc,selectedBankIfExecuted:n,
 bankPresentInOneMiBRom:n>=1&&n<=63,
 executed:false,activeBankKnown:false,romxTransferLinked:false});
const list=bs=>({verified:true,candidates:bs,candidateByteSites:bs.length,
 activeBankVerified:false,executedBankWrites:0});
function transfer(rom,{pc=0x201,to=0x5000,witness}={}){
 const physicalMappings=classifyRomxHeaderBankCandidates({
  rom,targetCpu:to}).physicalMappings.map(x=>({
   ...x,firstOpcodeDecodable:true
  }));
 return {fromRom0Cpu:pc,targetCpu:to,transferKind:'call',
  mapperFamilyFromHeader:'MBC3',transferExecuted:false,
  activeBankKnown:false,physicalMappings,
  witnessPath:witness??[{pc,via:'ROOT'}]};
}
test('bank 3 resolves conditional physical entrypoint bytes, never active bank',()=>{
 const rom=make(),at=3*0x4000+0x1000;rom[at]=0xf3;
 const r=buildMbc3RomxPhysicalScenarios({
  rom,transferSites:[transfer(rom)],conditionalBanks:list([bank(0x100,3)])
 });
 assert.equal(r.verified,true);assert.equal(r.scenarioCount,1);
 assert.equal(r.scenarios[0].physicalFileOffset,at);
 assert.equal(r.scenarios[0].physicalFirstOpcodeByte,0xf3);
 assert.equal(r.scenarios[0].activeBankVerified,false);
 assert.equal(r.causalLinksVerified,0);
});
test('co-occurrence on static witness is not an executed or causal link',()=>{
 const rom=make();
 const t=transfer(rom,{pc:0x300,witness:[
  {pc:0x100,via:'ROOT'},{pc:0x103,via:'fallthrough'},
  {pc:0x300,via:'fallthrough'}]});
 const r=buildMbc3RomxPhysicalScenarios({
  rom,transferSites:[t],conditionalBanks:list([bank(0x103,5)])});
 assert.equal(r.sameStaticWitnessPairs,1);
 assert.equal(r.scenarios[0].sameStaticWitnessIncludesWrite,true);
 assert.equal(r.scenarios[0].causalLinkVerified,false);
 assert.equal(r.scenarios[0].transferExecuted,false);
});
test('unrelated ROM0 witness does not become proven bank ancestry',()=>{
 const rom=make();
 const r=buildMbc3RomxPhysicalScenarios({
  rom,transferSites:[transfer(rom)],conditionalBanks:list([bank(0x100,5)])});
 assert.equal(r.sameStaticWitnessPairs,0);
 assert.equal(r.scenarios[0].sameStaticWitnessIncludesWrite,false);
});
test('cross product preserves sites and deduplicates only physical offsets',()=>{
 const rom=make();
 const r=buildMbc3RomxPhysicalScenarios({rom,
  transferSites:[transfer(rom,{pc:0x200}),transfer(rom,{pc:0x300})],
  conditionalBanks:list([bank(0x100,3),bank(0x180,3),bank(0x190,7)])});
 assert.equal(r.transferSites,2);assert.equal(r.scenarioCount,6);
 assert.equal(r.distinctPhysicalOffsetCount,2);
 assert.equal(r.firstOpcodeDecodableScenarios,6);
 assert.equal(r.executedTransfers,0);
});
test('out-of-file bank stays unknown without inventing wraparound',()=>{
 const rom=make();
 const r=buildMbc3RomxPhysicalScenarios({
  rom,transferSites:[transfer(rom)],
  conditionalBanks:list([bank(0x100,64),bank(0x103,3)])});
 assert.equal(r.scenarioCount,1);
 assert.equal(r.scenarios[0].candidateBankIfExecuted,3);
 assert.equal(r.scenarios[0].physicalFileOffset,3*0x4000+0x1000);
});
test('reject fake mapper, bad target, inconsistent offsets, or live flags',()=>{
 const rom=make(),good=transfer(rom);
 const cases=[
  {rom:Buffer.alloc(10),transferSites:[good],conditionalBanks:list([bank(0x100,3)])},
  {rom,transferSites:[{...good,targetCpu:0x1000}],conditionalBanks:list([bank(0x100,3)])},
  {rom,transferSites:[{...good,transferExecuted:true}],conditionalBanks:list([bank(0x100,3)])},
  {rom,transferSites:[{...good,physicalMappings:[{bank:3,fileOffset:0x1000}]}],conditionalBanks:list([bank(0x100,3)])},
  {rom,transferSites:[good],conditionalBanks:list([{...bank(0x100,3),executed:true}])},
  {rom,transferSites:[good],conditionalBanks:{...list([bank(0x100,3)]),activeBankVerified:true}}
 ];
 for(const c of cases)assert.equal(buildMbc3RomxPhysicalScenarios(c).verified,false);
});
