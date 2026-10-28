'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const {inspectCatchRamLayout}=require('../romCaptureLayout');
const roms=[
 ['Red','POKEMON_RED_ROM','5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'],
 ['Blue','POKEMON_BLUE_ROM','2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'],
 ['Green International','POKEMON_GREEN_ROM','aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']
];
for(const [name,env,sha] of roms){
 test('D007 layout audit from real ROM '+name,{
   skip:!process.env[env]?'ROM não disponível neste ambiente':false
 },()=>{
  const bytes=fs.readFileSync(process.env[env]);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sha);
  const r=inspectCatchRamLayout(bytes);
  assert.equal(r.verified,true);
  assert.equal(r.actualCatchRateAddress,0xd007);
  assert.equal(r.statusAddress,0xcfe9);
  assert.equal(r.romSha256,sha);
  assert.equal(r.runtimeRomSha256Proven,false);
 });
}
test('ROM ausente ou alterada é recusada, sem deduzir layout',()=>{
 assert.equal(inspectCatchRamLayout(null).verified,false);
 assert.equal(inspectCatchRamLayout(Buffer.alloc(1048576)).verified,false);
 assert.equal(inspectCatchRamLayout(Buffer.alloc(16384)).verified,false);
});
