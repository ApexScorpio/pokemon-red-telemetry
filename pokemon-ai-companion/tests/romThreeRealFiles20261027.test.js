'use strict';
// Regressão baseada em três ROMs reais analisadas em 2026-10-27.
// Não guarda/distribui ROMs, não lê saves e não usa offsets presumidos para variantes.
// Executar com POKEMON_RED_ROM, POKEMON_BLUE_ROM, POKEMON_GREEN_ROM (.gb locais).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {findGen1MoveTable}=require('../romMoveTable');
const {findWildData,findMapHeaders}=require('../romWorldData');

const verified=[
  {name:'Red',env:'POKEMON_RED_ROM',
    sha:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b'},
  {name:'Blue',env:'POKEMON_BLUE_ROM',
    sha:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d'},
  {name:'Green International v1.2.1',env:'POKEMON_GREEN_ROM',
    sha:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'}
];
const configured=verified.every(v=>process.env[v.env]);
test('3 ROMs locais: SHA exato, 165 golpes, 248 mapas, 334 treinadores, 106 itens, 12 fixos', {
  skip:!configured?'Definir POKEMON_RED_ROM, POKEMON_BLUE_ROM e POKEMON_GREEN_ROM (.gb locais) antes de certificar':false
},()=>{
  const atlas=new Map();
  for(const spec of verified){
    const bytes=fs.readFileSync(process.env[spec.env]);
    assert.equal(bytes.length,1048576,spec.name+' tamanho');
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),spec.sha,spec.name+' SHA256');
    // ItemUseBall em banco 3: ambas as leituras da taxa usada na captura
    // são LD A,[D007], iguais nas três ROMs verificadas por SHA.
    // Fonte: pret/pokered/engine/items/item_effects.asm e pokered.sym
    assert.equal(bytes.subarray(0xD777,0xD77A).toString('hex'),'fa07d0',
      spec.name+' capture rate use #1');
    assert.equal(bytes.subarray(0xD797,0xD79A).toString('hex'),'fa07d0',
      spec.name+' capture rate use #2');
    const moves=findGen1MoveTable(bytes);
    assert.equal(moves.valid,true,spec.name+' Moves');
    assert.equal(moves.rows.length,165,spec.name+' 165');
    assert.equal(moves.offset,0x38000,spec.name+' Moves offset');
    const wild=findWildData(bytes);
    assert.equal(wild.valid,true,spec.name+' WildData');
    assert.equal(wild.data.length,248,spec.name+' encontros por mapa');
    for(const row of wild.data)for(const kind of ['grass','water']){
      const slots=row[kind].slots;
      if(slots.length)assert.equal(slots.reduce((sum,x)=>sum+x.rollWeight,0),256,
        spec.name+' encounter map '+row.mapId+' '+kind);
    }
    const world=findMapHeaders(bytes);
    assert.equal(world.valid,true,spec.name+' MapHeaders');
    assert.equal(world.validMapHeaders,226,spec.name+' cabeçalhos');
    const obj=world.data.filter(x=>x.valid).flatMap(x=>x.objects.objects);
    assert.equal(obj.filter(x=>x.kind==='trainer').length,334,spec.name+' trainers');
    assert.equal(obj.filter(x=>x.kind==='item').length,106,spec.name+' ground items');
    assert.equal(obj.filter(x=>x.kind==='wildPokemon').length,12,spec.name+' stationary Pokémon');
    atlas.set(spec.name,{wild,moves});
  }
  const red=atlas.get('Red'),blue=atlas.get('Blue'),
    green=atlas.get('Green International v1.2.1');
  const differences=(a,b,kind)=>a.wild.data.reduce((n,row,i)=>n+(
    JSON.stringify(row[kind])!==JSON.stringify(b.wild.data[i][kind])?1:0),0);
  assert.equal(differences(red,blue,'grass'),34);
  assert.equal(differences(red,green,'grass'),31);
  assert.equal(differences(blue,green,'grass'),29);
  assert.equal(differences(red,blue,'water'),0);
  assert.equal(differences(red,green,'water'),0);
  assert.equal(red.moves.rows.every((r,i)=>
    ['id','effectByte','powerByte','typeByte','accuracyByte','basePp'].every(
      k=>r[k]===blue.moves.rows[i][k]&&r[k]===green.moves.rows[i][k])),true);
});
