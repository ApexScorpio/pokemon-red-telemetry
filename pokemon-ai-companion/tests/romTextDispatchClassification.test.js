'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {resolveStaticTextPointer}=require('../romTextPointerEvidence');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
function fixture(opcode,tail=[]){
 const rom=Buffer.alloc(1048576),bank=6;
 const table=bank*0x4000+0x100,target=bank*0x4000+0x200;
 rom.writeUInt16LE(0x4200,table);rom[target]=opcode;
 rom.set(tail,target+1);
 return {rom,mapBank:bank,textPointerCpu:0x4100,textId:1};
}
test('all eight documented Gen I special text script opcodes have distinct dispatches',()=>{
 const commands=[
  [0xff,'SCRIPT_POKECENTER_NURSE'],
  [0xfe,'SCRIPT_MART'],
  [0xfd,'SCRIPT_BILLS_PC'],
  [0xfc,'SCRIPT_PLAYERS_PC'],
  [0xf9,'SCRIPT_POKECENTER_PC'],
  [0xf7,'SCRIPT_PRIZE_VENDOR'],
  [0xf6,'SCRIPT_CABLE_CLUB_RECEPTIONIST'],
  [0xf5,'SCRIPT_VENDING_MACHINE']
 ];
 for(const [opcode,expected] of commands){
  const arg=opcode===0xfe?[0x00,0xff]:[];
  const r=resolveStaticTextPointer(fixture(opcode,arg));
  assert.equal(r.verified,true,r.reason);
  assert.equal(r.firstByte,opcode);
  assert.equal(r.command,expected);
  assert.equal(r.dispatchClass,'SPECIAL_TEXT_DISPATCH');
  assert.equal(r.dispatchOpcodePhysicallyVerified,true);
  assert.equal(r.dispatchHandlerCodeSemanticsVerified,false);
  assert.equal(r.dispatchOutcomeVerified,false);
  assert.equal(r.dialogueExecuted,false);
  if(opcode===0xfe){
   assert.equal(r.mart.verified,true);
   assert.equal(r.mart.itemCount,0);
   assert.deepEqual(r.mart.itemIds,[]);
  }
 }
});
test('far text and ASM are dispatched differently and do not certify effects',()=>{
 const asm=resolveStaticTextPointer(fixture(0x08));
 assert.equal(asm.verified,true);
 assert.equal(asm.dispatchClass,'ASM_HANDLER');
 const farFixture=fixture(0x17,[0x00,0x43,0x06]);
 farFixture.rom[0x18000+0x300]=0x00;
 farFixture.rom[0x18000+0x301]=0x80;
 farFixture.rom[0x18000+0x302]=0x50;
 const far=resolveStaticTextPointer(farFixture);
 assert.equal(far.verified,true,far.reason);
 assert.equal(far.dispatchClass,'FAR_TEXT');
 assert.equal(far.far.verified,true);
 assert.equal(far.dispatchOutcomeVerified,false);
});
test('undefined $FA or $FB are not invented as special PC scripts',()=>{
 for(const opcode of [0xfa,0xfb]){
  const r=resolveStaticTextPointer(fixture(opcode));
  assert.equal(r.verified,true);
  assert.equal(r.command,'TEXT_OPCODE_UNCLASSIFIED');
  assert.equal(r.dispatchClass,'UNCLASSIFIED');
 }
});
for(const [name,env] of [['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']]){
 test('original '+name+' ROM: every map object has a physically verified dispatch classification',
 {skip:!process.env[env]?'Original ROM path required':false},()=>{
  const rom=readRom(process.env[env]);
  const profile=inspectRomBuffer(rom,name+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[name]);
  const a=profile.world.interactionScriptAtlas;
  assert.equal(a.verified,true);
  assert.equal(a.references.length,1126);
  const observed={};
  for(const row of a.references){
   assert.ok(typeof row.scriptDispatchClass==='string');
   assert.equal(row.scriptDispatchOutcomeVerified,false);
   assert.equal(row.scriptDispatchCodeSemanticsVerified,false);
   assert.equal(row.scriptDispatchOpcodeVerified,row.textPointerVerified);
   observed[row.scriptDispatchClass]=(observed[row.scriptDispatchClass]||0)+1;
   if(row.scriptCommand==='SCRIPT_BILLS_PC')
    assert.equal(row.scriptDispatchClass,'SPECIAL_TEXT_DISPATCH');
   if(row.scriptCommand==='SCRIPT_PLAYERS_PC')
    assert.equal(row.scriptDispatchClass,'SPECIAL_TEXT_DISPATCH');
   if(row.scriptCommand==='SCRIPT_POKECENTER_PC')
    assert.equal(row.scriptDispatchClass,'SPECIAL_TEXT_DISPATCH');
  }
  assert.deepEqual(observed,a.summary.dispatchClassCounts);
  assert.equal(Object.values(a.summary.dispatchClassCounts).reduce((n,x)=>n+x,0),1126);
  assert.equal(a.summary.semicallyCertifiedInteractionScripts,undefined);
  assert.equal(a.summary.semanticallyCertifiedInteractionScripts,0);
 });
}
