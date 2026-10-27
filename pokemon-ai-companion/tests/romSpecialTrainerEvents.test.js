'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectWorld}=require('../romWorldData');
const {trainerFlagsForCurrentMap,SPECIAL_SCRIPT_EVENTS}=require('../romTrainerEvents');
const ROMS=[
 ['Pokemon Red.gb','5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'],
 ['Pokemon Blue.gb','2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'],
 ['Pokemon Green International v1.2.1.gb','aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']
];
const COUNT=Object.values(SPECIAL_SCRIPT_EVENTS).reduce((n,vals)=>n+Object.keys(vals).length,0);
test('o catálogo de scripts especiais contém 18 flags',()=>assert.equal(COUNT,18));
for(const [file,sha256] of ROMS){
 test('cada flag de chefe ou script especial está nos bytes da ROM '+file,
   {skip:!process.env.POKEMON_ROM_DIR},()=>{
   const b=fs.readFileSync(path.join(process.env.POKEMON_ROM_DIR,file));
   assert.equal(crypto.createHash('sha256').update(b).digest('hex'),sha256);
   const world=inspectWorld(b),profile={hash:{sha256},world};
   let checked=0;
   for(const [strId,entries] of Object.entries(SPECIAL_SCRIPT_EVENTS)){
     const mapId=Number(strId),m=world.maps.data[mapId];
     assert.equal(m.valid,true);
     for(const [ordString,bit] of Object.entries(entries)){
       const ordinal=Number(ordString),o=m.objects.objects[ordinal-1];
       assert.equal(o.kind,'trainer','Não é uma classe humana: '+mapId+':'+ordinal);
       const base=m.mapBank*16384;
       const bankOffset=(cpu)=>base+cpu-0x4000;
       const textBase=bankOffset(m.textPointerCpu);
       const ix=o.textId&0x3f;
       assert.ok(ix>=1);
       const tCpu=b.readUInt16LE(textBase+2*(ix-1));
       const t=bankOffset(tCpu);
       const opcode=Buffer.from([0xfa,...Buffer.from(Uint16Array.of(0xd747+(bit>>3)).buffer),0xcb,0x47+8*(bit&7)]);
       // Karate Master: o segundo bit reutiliza A carregado pelo primeiro CheckEvent.
       const search=mapId===177?Buffer.from([0xcb,0x4f]):opcode;
       const found=b.subarray(t,t+19).indexOf(search);
       assert.ok(found>=0,'Não encontrado bit '+bit+' em mapa '+mapId);
       const flags=Array(320).fill('00');
       flags[bit>>3]=(1<<(bit&7)).toString(16).padStart(2,'0');
       const resolved=trainerFlagsForCurrentMap(profile,m,flags);
       assert.equal(resolved.verified,true);
       const entry=resolved.entries.find(x=>x.objectOrdinal===ordinal);
       assert.equal(entry?.eventBitIndex,bit);
       assert.equal(entry.eventFlagSet,true);
       assert.equal(entry.defeated,null);
       checked++;
     }
   }
   assert.equal(checked,18);
 });
}
