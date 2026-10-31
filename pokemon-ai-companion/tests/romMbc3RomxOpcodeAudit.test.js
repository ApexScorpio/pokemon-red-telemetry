'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditMbc3RomxEntryOpcodes}=require('../romMbc3RomxOpcodeAudit');
const {buildMbc3RomxPhysicalScenarios}=require('../romMbc3RomxPhysicalScenarios');
const {classifyRomxHeaderBankCandidates}=require('../romRomxBankAccess');
const {decodeOpcode}=require('../romMapCodeAtlas');
const rom=()=>{const r=Buffer.alloc(1048576,0xc9);r[0x147]=0x13;r[0x148]=5;return r;};
function atlas(r,bank=3,target=0x5000,pc=0x210){
 const mappings=classifyRomxHeaderBankCandidates({rom:r,targetCpu:target})
  .physicalMappings.map(x=>({...x,
   firstOpcodeDecodable:decodeOpcode(r,x.bank,target).ok===true}));
 const t={fromRom0Cpu:pc,transferKind:'call',targetCpu:target,
  mapperFamilyFromHeader:'MBC3',transferExecuted:false,
  activeBankKnown:false,physicalMappings:mappings,
  witnessPath:[{pc,via:'ROOT'}]};
 const c={rom0WritePc:0x200,selectedBankIfExecuted:bank,
  bankPresentInOneMiBRom:true,executed:false,activeBankKnown:false,
  romxTransferLinked:false};
 return buildMbc3RomxPhysicalScenarios({rom:r,transferSites:[t],
  conditionalBanks:{verified:true,candidates:[c],
   candidateByteSites:1,activeBankVerified:false,executedBankWrites:0}});
}
test('documented ROMX instruction is consistent with atlas',()=>{
 const r=rom(),a=atlas(r),e=auditMbc3RomxEntryOpcodes({rom:r,scenarioAtlas:a});
 assert.equal(e.verified,true);
 assert.equal(e.scenariosAudited,1);
 assert.equal(e.firstOpcodeDecodableCount,1);
 assert.equal(e.notDecodableCount,0);
 assert.equal(e.activeBankVerified,false);
});
test('undocumented opcode becomes exact and bounded anomaly evidence',()=>{
 const r=rom(),offset=3*0x4000+0x1000;r[offset]=0xd3;
 const e=auditMbc3RomxEntryOpcodes({rom:r,scenarioAtlas:atlas(r)});
 assert.equal(e.verified,true);assert.equal(e.notDecodableCount,1);
 assert.equal(e.notDecodable[0].bank,3);
 assert.equal(e.notDecodable[0].firstByte,0xd3);
 assert.equal(e.notDecodable[0].reason,'undocumented opcode');
 assert.equal(e.reasonCounts['undocumented opcode'],1);
 assert.equal(e.notDecodable[0].transferExecuted,false);
});
test('an instruction crossing physical ROMX bank boundary is separately classified',()=>{
 const r=rom(),offset=3*0x4000+0x3fff;r[offset]=0xea;
 const e=auditMbc3RomxEntryOpcodes({
  rom:r,scenarioAtlas:atlas(r,3,0x7fff)});
 assert.equal(e.verified,true);
 assert.equal(e.notDecodableCount,1);
 assert.equal(e.notDecodable[0].reason,'instruction crosses bank boundary');
});
test('contradictory precomputed decoder flag fails closed',()=>{
 const r=rom(),a=atlas(r);
 a.scenarios[0].physicalFirstOpcodeDecodable=false;
 const e=auditMbc3RomxEntryOpcodes({rom:r,scenarioAtlas:a});
 assert.equal(e.verified,false);
 assert.match(e.reason,/disagree/);
});
test('wrong ROM header, impossible physical offset and invented execution fail closed',()=>{
 const r=rom(),a=atlas(r);
 const invalid=[
  {rom:Buffer.alloc(100),scenarioAtlas:a},
  {rom:r,scenarioAtlas:{...a,scenarioCount:2}},
  {rom:r,scenarioAtlas:{...a,scenarios:[{...a.scenarios[0],physicalFileOffset:1}]}},
  {rom:r,scenarioAtlas:{...a,scenarios:[{...a.scenarios[0],transferExecuted:true}]}},
  {rom:r,scenarioAtlas:{...a,activeBanksVerified:1}}
 ];
 for(const bad of invalid)assert.equal(
  auditMbc3RomxEntryOpcodes(bad).verified,false);
});
