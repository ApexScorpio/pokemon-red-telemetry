'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectRom}=require('../romVariantRegistry');
const {decompressSprite,toPng,spritePngBase64}=require('../romSpriteDecoder');

const variants=[
 {name:'red',file:'Pokemon Red.gb',sha256:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'},
 {name:'blue',file:'Pokemon Blue.gb',sha256:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'},
 {name:'green',file:'Pokemon Green International v1.2.1.gb',sha256:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'}
];
for(const variant of variants){
 test('Gen I original ROM sprites: '+variant.name,{skip:!process.env.POKEMON_ROM_DIR},()=>{
  const filename=path.join(process.env.POKEMON_ROM_DIR,variant.file);
  const rom=fs.readFileSync(filename);
  assert.equal(crypto.createHash('sha256').update(rom).digest('hex'),variant.sha256);
  const p=inspectRom(filename);
  assert.equal(p.spritesVerified,150);
  assert.equal(p.spritesWithPixelsDecoded,150);
  for(const mon of p.species){
   if(!mon.stats)continue;
   assert.ok(mon.sprite?.verified,mon.name+' has no validated ROM sprite bank');
   assert.equal(mon.sprite.pixelsDecoded,true,mon.name+' compressed sprite failed');
   for(const side of ['front','back']){
    const compressedAt=mon.sprite[side].fileOffset;
    const decoded=decompressSprite(rom,compressedAt,side==='front'?mon.sprite.dimensionsByte:0x44);
    assert.ok(decoded.width>=32&&decoded.width<=56);
    assert.ok(new Set(decoded.pixels).size>1);
    assert.ok(decoded.pixels.every(x=>x<=3));
    const png=toPng(decoded);
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),decoded.width);
    assert.equal(png.readUInt32BE(20),decoded.height);
    assert.equal(spritePngBase64(rom,compressedAt,side==='front'?mon.sprite.dimensionsByte:0x44),png.toString('base64'));
   }
  }
 });
}
test('algoritmo recusa bitstream invalido antes de produzir imagens falsas',()=>{
 assert.throws(()=>decompressSprite(Buffer.from([0x00]),0));
 assert.throws(()=>decompressSprite(Buffer.from([0x55]),0,0x66));
});
