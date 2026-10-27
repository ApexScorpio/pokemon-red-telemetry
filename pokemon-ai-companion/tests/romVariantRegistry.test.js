'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectRom,runtimeMatches,crc32}=require('../romVariantRegistry');
const {getCurrentRom,pokemonFromProfile,moveNameFromProfile}=require('../romLiveResolver');

test('CRC32 e correspondência com a sessão real são verificações estritas',()=>{
 assert.equal(crc32(Buffer.from('123456789')),'CBF43926');
 const p={hash:{crc32:'3C2DD8AE'}};
 assert.equal(runtimeMatches(p,'GET_STATUS PLAYING gb,Pokemon Green International,crc32=3C2DD8AE'),true);
 assert.equal(runtimeMatches(p,'GET_STATUS PLAYING gb,Pokemon Red,crc32=00000000'),false);
 assert.equal(runtimeMatches(p,'GET_STATUS CONTENTLESS'),false);
 assert.equal(getCurrentRom('GET_STATUS PLAYING gb,test,crc32=3C2DD8AE',[p]),p);
 assert.equal(getCurrentRom('GET_STATUS PLAYING gb,test,crc32=3C2DD8AE',[p,p]),null);
});

test('ROM Gen I verdadeira: só identificar tabelas quando o ficheiro exato está disponível',{
 skip:!process.env.POKEMON_ROM_PATH
},()=>{
 const p=inspectRom(process.env.POKEMON_ROM_PATH);
 assert.equal(p.bytesRead,p.bytes);
 assert.equal(p.banks*16384,p.bytes);
 assert.equal(p.unknownLayout,false,'rom não suportada: não usar deslocamentos do Red');
 assert.equal(p.species.length,190);
 assert.equal(p.moveNames.length,165);
 for(const field of ['names','dexOrder','baseStats','growthRates','evolutions','moveNames'])
  assert.equal(p.validated[field],true,'tabela não verificada: '+field);
 assert.equal(pokemonFromProfile(p,1).name,'RHYDON');
 assert.equal(moveNameFromProfile(p,1),'POUND');
 assert.equal(p.species.find(x=>x.name==='BEEDRILL').learnset.some(x=>x.level===20),true);
});

test('a identificação por nome ou cabeçalho apenas não basta',()=>{
 const p={hash:{crc32:'3C2DD8AE'},species:[],moveNames:[]};
 assert.equal(getCurrentRom('GET_STATUS PLAYING gb,POKEMON GREEN,crc32=00000000',[p]),null);
 assert.equal(pokemonFromProfile(null,1),null);
 assert.equal(moveNameFromProfile(null,1),null);
});
