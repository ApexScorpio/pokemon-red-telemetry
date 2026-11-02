'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {addressDomain,planMbc3BankInputs}=require('../romMbc3BankSourcePlan');
const site=(pc,kind,address=null,byte=null)=>({
 rom0Pc:pc,opcode:0xea,
 literalTargets:[{registerKind:'ROM_BANK_NUMBER'}],
 aSourceProvenance:{verified:true,writePc:pc,sourcePc:pc-3,
  sourceKind:kind,sourceAddressCpu:address,conditionalByte:byte,
  sourceRegister:kind==='REGISTER_OR_HL_READ'?'B':null},
 registerInputProvenance:null
});
test('all CPU memory regions and excluded aliases classified',()=>{
 for(const [address,expected] of [
  [0,'ROM0'],[0x4000,'ROMX'],[0x8000,'VRAM'],
  [0xa000,'CART_RAM_OR_RTC'],[0xc000,'WRAM'],[0xdfff,'WRAM'],
  [0xe000,'ECHO'],[0xfe00,'OAM'],[0xfea0,'UNUSABLE'],
  [0xff00,'IO'],[0xff80,'HRAM'],[0xffff,'IE']])
  assert.equal(addressDomain(address).domain,expected);
 for(const a of [-1,65536,1.1,null,'c000'])
  assert.equal(addressDomain(a),null);
});
test('only exact WRAM/HRAM addresses enter future observation plan',()=>{
 const p=planMbc3BankInputs({directWriteSites:[
  site(0x100,'MEMORY_READ',0xd123),site(0x200,'MEMORY_READ',0xd123),
  site(0x300,'MEMORY_READ',0xff80),site(0x400,'MEMORY_READ',0xa000)
 ]});
 assert.equal(p.verified,true);
 assert.deepEqual(p.uniqueRamAddresses,[0xd123,0xff80]);
 assert.equal(p.runtimeReadCount,0);
 assert.equal(p.runtimeBankVerified,false);
});
test('literal bytes remain conditional and runtime unknown',()=>{
 const p=planMbc3BankInputs({directWriteSites:[
  site(0x100,'IMMEDIATE_A',null,7),
  site(0x200,'REGISTER_OR_HL_READ'),
  site(0x300,'MEMORY_READ',null),
  site(0x400,'UNRESOLVED')
 ]});
 assert.equal(p.verified,true);
 assert.equal(p.siteCount,4);
 assert.equal(p.sites[0].conditionalByte,7);
 assert.equal(p.sites[2].memoryPointerUnknown,true);
 assert.ok(p.sites.every(s=>s.executed===false&&s.bankActiveVerified===false));
});
test('untrusted or malformed candidates fail closed',()=>{
 assert.equal(planMbc3BankInputs().verified,false);
 assert.equal(planMbc3BankInputs({directWriteSites:[{...site(0x100,'MEMORY_READ'),opcode:0x77}]}).verified,false);
 assert.equal(planMbc3BankInputs({directWriteSites:[{...site(0x100,'MEMORY_READ'),aSourceProvenance:null}]}).verified,false);
});
