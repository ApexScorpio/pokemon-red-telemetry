'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {EXPECTED,REGIONS,inspectRom,auditThreeRomBattleTables}=require('./verifyRealRomBattleTables');
const dir=process.env.POKEMON_ROM_DIR;
if(!dir)throw Error('TRES_ROMS_REAIS_OBRIGATORIAS_SEM_SKIP');
const files={red:'Pokemon Red.gb',blue:'Pokemon Blue.gb',
  green:'Pokemon Green International v1.2.1.gb'};
const roms=Object.fromEntries(Object.entries(files).map(([name,filename])=>[
  name,fs.readFileSync(path.join(dir,filename))]));
test('3 SHA-256 e cabeçalhos reais originais',()=>{
  for(const name of Object.keys(files))
    assert.equal(inspectRom(name,roms[name]).romSha256,EXPECTED[name]);
});
test('5 regiões binárias são iguais byte a byte nas 3 ROMs',()=>{
 const proof=auditThreeRomBattleTables(roms);
 assert.equal(proof.verified,true);
 assert.equal(Object.keys(proof.tables).length,5);
 assert.equal(proof.tables.moves.entries,165);
 assert.equal(proof.tables.effectDispatch.entries,86);
 assert.equal(proof.tables.statModifierRatios.entries,13);
 for(const t of Object.values(proof.tables))
   assert.equal(t.identicalAcrossThreeVerified,true);
});
test('cada ROM com bytes adulterados é rejeitada pelo SHA',()=>{
 for(const name of Object.keys(files)){
   const changed=Buffer.from(roms[name]);changed[0x38000+7]^=1;
   assert.throws(()=>auditThreeRomBattleTables({...roms,[name]:changed}),/SHA256_ROM_NAO_AUDITADO/);
 }
});
test('ROM ausente, truncada ou trocada falha sem ignorar',()=>{
 assert.throws(()=>auditThreeRomBattleTables({...roms,blue:null}),/ROM_NAO_TEM/);
 assert.throws(()=>auditThreeRomBattleTables({...roms,green:roms.green.subarray(0,8192)}),/ROM_NAO_TEM/);
 assert.throws(()=>auditThreeRomBattleTables({...roms,red:roms.blue}),/SHA256_ROM_NAO_AUDITADO/);
});
test('rejeita variantes externas e inputs nulos',()=>{
 assert.throws(()=>inspectRom('silver',roms.red),/VARIANTE_DESCONHECIDA/);
 assert.throws(()=>auditThreeRomBattleTables(null),/TRES_ROMS_OBRIGATORIAS/);
});
test('contagens exatas do código são estáveis',()=>{
 assert.deepEqual(Object.entries(REGIONS).map(([k,v])=>[k,v.size]),[
 ['moves',990],['effectDispatch',172],['statModifierRatios',26],
 ['highCriticalMoves',5],['unusedHighCriticalMoves',5]]);
});
