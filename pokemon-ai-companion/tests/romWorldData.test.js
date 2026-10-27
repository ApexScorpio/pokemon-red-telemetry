'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {inspectWorld}=require('../romWorldData');
const {inspectRom}=require('../romVariantRegistry');

const ROMS=[
  {file:'Pokemon Red.gb',sha256:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
   route5:[185,36,36,57]},
  {file:'Pokemon Blue.gb',sha256:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
   route5:[188,36,36,77]},
  {file:'Pokemon Green International v1.2.1.gb',sha256:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db',
   route5:[185,36,36,77]}
];
const romDir=process.env.POKEMON_ROM_DIR;
for(const testCase of ROMS){
 test('rom world: '+testCase.file+' real byte-for-byte fixture',{skip:!romDir},()=>{
  const filename=path.join(romDir,testCase.file);
  const b=fs.readFileSync(filename);
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),testCase.sha256);
  const p=inspectWorld(b);
  assert.equal(p.wildEncounters.valid,true);
  assert.equal(p.wildEncounters.totalMapIds,248);
  assert.equal(p.wildEncounters.uniqueDataRecords,59);
  assert.equal(p.wildEncounters.pointerTable.fileOffset,0xCEEB);
  assert.equal(p.maps.valid,true);
  assert.equal(p.maps.totalMapIds,248);
  assert.equal(p.maps.validMapHeaders,226);
  assert.equal(p.maps.trainerEventsVerified,312);
  assert.equal(p.maps.trainerEventMapsVerified,67);
  assert.deepEqual(p.maps.data[17].trainerEvents.map(x=>x.eventBitIndex),
    [1041,1042,1043,1044,1045,1046]);
  assert.deepEqual(p.maps.data[35].trainerEvents.map(x=>x.objectOrdinal),
    [2,3,4,5,6,7]);
  assert.equal(p.maps.pointerTable.fileOffset,0x1AE);
  assert.equal(p.maps.bankTable.fileOffset,0xC23D);
  assert.deepEqual(p.wildEncounters.data[0x10].grass.slots.slice(0,4).map(s=>s.internalId),
   testCase.route5);
  const daycare=p.maps.data[0x48];
  assert.equal(daycare.valid,true);
  assert.equal(daycare.widthTiles,8);
  assert.equal(daycare.heightTiles,8);
  assert.equal(daycare.objects.warps.length,2);
  assert.equal(daycare.objects.objects.length,1);
  const route5=p.maps.data[0x10];
  assert.equal(route5.objects.warps.length,5);
  assert.equal(route5.objects.objects.length,0);
  assert.equal(Buffer.from(route5.blockDataBase64,'base64').length,route5.blockBytes);
  const profile=inspectRom(filename);
  assert.equal(profile.world.wildEncounters.valid,true);
  assert.equal(profile.world.maps.valid,true);
  assert.equal(profile.bytesRead,b.length);
 });
}
test('ROM truncada ou sem assinatura completa não pode gerar mundo verificado',()=>{
 assert.throws(()=>inspectWorld(Buffer.alloc(3)));
 const b=Buffer.alloc(32768);
 const data=inspectWorld(b);
 assert.equal(data.wildEncounters.valid,false);
 assert.equal(data.maps.valid,false);
});