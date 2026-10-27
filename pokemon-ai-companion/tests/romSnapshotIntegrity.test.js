'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verifyMapSnapshot}=require('../romSnapshotIntegrity');

test('mesmo mapa nas duas leituras pode ser publicado (com ressalva de atomicidade)',()=>{
 const result=verifyMapSnapshot('11',['11']);
 assert.equal(result.verified,true);
 assert.equal(result.initialMapId,17);
 assert.equal(result.finalMapId,17);
 assert.match(result.limitations,/não certifica leitura atómica/i);
});
test('mudança Route 6 -> outro mapa descarta toda a amostra',()=>{
 const result=verifyMapSnapshot('11',['15']);
 assert.equal(result.verified,false);
 assert.equal(result.reason,'MUDANÇA_DE_MAPA_DURANTE_A_LEITURA_RAM');
 assert.equal(result.initialMapId,17);
 assert.equal(result.finalMapId,21);
});
test('leitura falhada, truncada ou não hexadecimal nunca é interpretada como mapa zero',()=>{
 for(const byte of [null,[],['00','00'],['GG'],[42],undefined]){
  const result=verifyMapSnapshot('11',byte);
  assert.equal(result.verified,false);
  assert.equal(result.reason,'MAPA_RAM_RELEITURA_INCOMPLETA');
 }
 assert.equal(verifyMapSnapshot(null,['11']).verified,false);
});
test('mapas inexistentes ou códigos de glitch não são aceites sem validação',()=>{
 const result=verifyMapSnapshot('ff',['ff']);
 assert.equal(result.verified,false);
 assert.equal(result.reason,'MAPA_GEN1_DESCONHECIDO');
});