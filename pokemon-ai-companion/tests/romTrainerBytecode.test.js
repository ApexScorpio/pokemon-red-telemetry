'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {extractTrainerEventPointers}=require('../romWorldData');
const BANK=16384,bank=22;
const at=cpu=>bank*BANK+cpu-0x4000;
const make=(green=false,shared=false)=>{
 const rom=Buffer.alloc(64*BANK);
 const w=(cpu,val)=>rom.writeUInt16LE(val,at(cpu));
 w(0x5600,0x5620);
 const call=green?0x31B3:0x31CC,ret=green?0x24BE:0x24D7;
 const routine=shared? [0x08,0x21,0,0x57,0x18,0x02,0x17,0x17,0xCD,call&255,call>>8,0xC3,ret&255,ret>>8] :
  [0x08,0x21,0,0x57,0xCD,call&255,call>>8,0xC3,ret&255,ret>>8];
 rom.set(routine,at(0x5620));
 rom.set([1,0,0xC9,0xD7],at(0x5700));
 for(let i=0;i<4;i++)w(0x5704+2*i,0x6000);
 const map={mapBank:bank,textPointerCpu:0x5600,objects:{objects:[
  {kind:'trainer',textId:0x41}, {kind:'npc',textId:0x02}
 ]}};
 return {rom,map};
};
for(const variant of [
 {name:'Red direct',green:false,shared:false},
 {name:'Green relocated direct',green:true,shared:false},
 {name:'Gen I JR to shared TalkToTrainer',green:false,shared:true}
]){
 test('trainer header traced through NPC text bytecode: '+variant.name,()=>{
  const {rom,map}=make(variant.green,variant.shared);
  const data=extractTrainerEventPointers(rom,map);
  assert.equal(data.length,1);
  assert.equal(data[0].eventBitIndex,1041);
  assert.equal(data[0].objectOrdinal,1);
  assert.equal(data[0].trainerHeaderCpu,0x5700);
 });
}
test('bytecode candidate without real event pointer is rejected',()=>{
 const {rom,map}=make(false,false);
 rom.writeUInt16LE(0xD000,at(0x5700)+2);
 assert.deepEqual(extractTrainerEventPointers(rom,map),[]);
});
