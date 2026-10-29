'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {inspectGreenP1Layout,ROM_SHA256}=
  require('../romGreenP1WorldProbe');
const {main}=require('../scripts/auditGreenP1World');
test('a variante Green p1 tem identidade diferente da Green International',()=>{
 assert.equal(ROM_SHA256,'5f31568f93c9d238b25e8f0f21e0f70dd1e20279065ff4d359d6147b8b692eeb');
 assert.equal(ROM_SHA256!=='aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db',true);
});
test('não identifica zeros ou ROMs truncadas como Green p1',()=>{
 assert.equal(inspectGreenP1Layout(Buffer.alloc(16)).verified,false);
 const r=inspectGreenP1Layout(Buffer.alloc(1048576));
 assert.equal(r.verified,false);
 assert.equal(r.liveCompanionSupported,false);
 assert.equal(r.textSemanticsVerified,false);
 assert.equal(r.accessVerified,false);
});
test('interface CLI exige exatamente um caminho, sem abrir ficheiros',()=>{
 assert.throws(()=>main([]),/exatamente um caminho/);
 assert.throws(()=>main(['a','b']),/exatamente um caminho/);
});
test('ROM Green p1 real pode ser auditada apenas com ficheiro explicitamente fornecido',t=>{
 const romPath=process.env.POKEGUIDE_GREEN_P1_ROM;
 if(!romPath){t.skip('Definir POKEGUIDE_GREEN_P1_ROM para auditar ROM do utilizador');return;}
 const b=fs.readFileSync(romPath);
 const r=inspectGreenP1Layout(b);
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.variant,'GREEN_U_P1');
 assert.equal(r.mapPointerTableOffset,0x1bcb);
 assert.equal(r.mapBankTableOffset,0xc883);
 assert.deepEqual(r.counts,{mapCount:226,warps:813,signs:204,
   npc:472,trainer:334,item:106,wildPokemon:12});
 assert.equal(r.maps.length,226);
 assert.equal(r.liveCompanionSupported,false);
 assert.equal(r.textSemanticsVerified,false);
});
