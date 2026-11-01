'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectSpecialTextDispatch:inspect}=require('../romSpecialTextDispatchSemantics');
const at=0x18020;
const romWith=(bytes,offset=at)=>{const rom=Buffer.alloc(1048576);rom.set(bytes,offset);return rom;};
const cases=[
 [0xff,'SCRIPT_POKECENTER_NURSE','DisplayPokemonCenterDialogue'],
 [0xfd,'SCRIPT_BILLS_PC','TextScript_BillsPC'],
 [0xfc,'SCRIPT_PLAYERS_PC','TextScript_ItemStoragePC'],
 [0xf9,'SCRIPT_POKECENTER_PC','TextScript_PokemonCenterPC'],
 [0xf7,'SCRIPT_PRIZE_VENDOR','TextScript_GameCornerPrizeMenu'],
 [0xf6,'SCRIPT_CABLE_CLUB_RECEPTIONIST','CableClubNPC'],
 [0xf5,'SCRIPT_VENDING_MACHINE','VendingMachineMenu']
];
for(const [opcode,scriptCommand,handler] of cases){
 test('special text opcode '+opcode.toString(16)+' never claims runtime effect',()=>{
  const r=inspect({rom:romWith([opcode]),scriptFileOffset:at,scriptCommand});
  assert.equal(r.verified,true);
  assert.equal(r.referenceHandler,handler);
  assert.equal(r.scriptEffectsVerified,false);
  assert.equal(r.accessibleNow,null);
  assert.equal(r.completedNow,null);
  assert.equal(r.gameplayActionObserved,false);
  assert.equal(r.handlerImplementationInCartridgeVerified,false);
 });
}
test('mart uses independently reconciled physical ROM item list',()=>{
 const rom=romWith([0xfe,2,4,7,0xff]),mart={verified:true,itemCount:2,itemIds:[4,7]};
 const r=inspect({rom,scriptFileOffset:at,scriptCommand:'SCRIPT_MART',mart});
 assert.equal(r.verified,true);
 assert.deepEqual(r.staticItemIds,[4,7]);
 assert.equal(r.priceVerified,false);
 for(const wrong of [undefined,{verified:true,itemCount:2,itemIds:[4,8]}])
  assert.equal(inspect({rom,scriptFileOffset:at,scriptCommand:'SCRIPT_MART',mart:wrong}).verified,false);
});
test('rejects mismatch, malformed size, bank end and missing terminator',()=>{
 const rom=romWith([0xf5]);
 assert.equal(inspect({rom,scriptFileOffset:at,scriptCommand:'SCRIPT_MART'}).verified,false);
 assert.equal(inspect({rom,scriptFileOffset:at,scriptCommand:'SCRIPT_VENDING_MACHINE',mart:{}}).verified,false);
 assert.equal(inspect({rom,scriptFileOffset:-1,scriptCommand:'SCRIPT_VENDING_MACHINE'}).verified,false);
 assert.equal(inspect({rom:Buffer.alloc(8),scriptFileOffset:0,scriptCommand:'SCRIPT_VENDING_MACHINE'}).verified,false);
 const edge=romWith([0xfe,2],0x1bffe);
 assert.equal(inspect({rom:edge,scriptFileOffset:0x1bffe,scriptCommand:'SCRIPT_MART',mart:{verified:true,itemCount:2,itemIds:[1,2]}}).verified,false);
 const noEnd=romWith([0xfe,1,5,3]);
 assert.equal(inspect({rom:noEnd,scriptFileOffset:at,scriptCommand:'SCRIPT_MART',mart:{verified:true,itemCount:1,itemIds:[5]}}).verified,false);
});
