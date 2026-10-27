'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {listCandidates,inspectZipProfiles}=require('../romAutoDiscovery');
const {buildProfiles,getCurrentRom}=require('../romLiveResolver');

test('arranque sem configuração encontra ficheiros no projeto e ZIP em Downloads',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pokeromauto-'));
 try{
  const app=path.join(temp,'app','pokemon-ai-companion');
  const download=path.join(temp,'user','Downloads');
  const roms=path.join(app,'roms');
  fs.mkdirSync(app,{recursive:true});
  fs.mkdirSync(download,{recursive:true});
  fs.mkdirSync(roms,{recursive:true});
  fs.writeFileSync(path.join(download,'pokemon_gen1_red_blue_green_profiles_v4.zip'),'fake zip candidate');
  fs.writeFileSync(path.join(roms,'Pokemon Green International v1.2.1.gb'),'fake rom candidate');
  const found=listCandidates(app,{HOME:path.join(temp,'user')});
  assert.equal(found.zipFiles.some(x=>x.includes('_v4.zip')),true);
  assert.equal(found.romFiles.some(x=>x.endsWith('.gb')),true);
  assert.equal(found.profileFiles.length,0);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('ZIP inválido é rejeitado antes de fabricar perfis',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pokeromzip-'));
 try{
  const file=path.join(temp,'pokemon_gen1_red_blue_green_profiles_v4.zip');
  fs.writeFileSync(file,'conteudo corrompido');
  assert.throws(()=>inspectZipProfiles(file));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('pacote real v4 contém os perfis completos sem necessitar de extração',{
 skip:!process.env.POKEMON_PROFILE_ZIP_TEST_FILE
},()=>{
 const profiles=inspectZipProfiles(process.env.POKEMON_PROFILE_ZIP_TEST_FILE);
 assert.equal(profiles.length,3);
 const crcs=new Set(profiles.map(x=>x.profile.hash.crc32));
 assert.deepEqual(crcs,new Set(['9F7FDD53','D6DA8A1A','3C2DD8AE']));
 for(const {profile} of profiles){
  assert.equal(profile.spritesWithPixelsDecoded,150);
  assert.equal(profile.world.maps.validMapHeaders,226);
  assert.equal(profile.capabilities.tmHmReadForSpecies,150);
  const bulbasaur=profile.species.find(x=>x.name==='BULBASAUR');
  assert.equal(bulbasaur.stats.tmHm.rawHex,'a40338c0030806');
 }
});

test('com perfil registado, seleciona automaticamente Red Blue Green por CRC',{
 skip:!process.env.POKEMON_PROFILE_ZIP_TEST_FILE
},()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'pokeromregistrar-'));
 try{
  // Um único ZIP conhecido, sem extrair: o arranque descobre os 3 perfis.
  const p=path.join(folder,'pokemon_gen1_red_blue_green_profiles_v4.zip');
  fs.copyFileSync(process.env.POKEMON_PROFILE_ZIP_TEST_FILE,p);
  const old=process.env.POKEMON_ROM_PROFILE_PATH;
  const oldDir=process.env.POKEMON_ROM_PROFILE_DIR;
  const oldZip=process.env.POKEMON_ROM_PROFILE_ZIP;
  const oldHome=process.env.HOME;
  try{
   // Evitar depender do HOME real ao usar a fonte explícita opcional.
   process.env.POKEMON_ROM_PROFILE_ZIP=p;
   const {profiles}=buildProfiles();
   for(const crc of ['9F7FDD53','D6DA8A1A','3C2DD8AE']){
    const current=getCurrentRom('GET_STATUS PLAYING game_boy,game,crc32='+crc,profiles);
    assert.ok(current,'CRC não reconhecido '+crc);
   }
  }finally{
   if(old===undefined)delete process.env.POKEMON_ROM_PROFILE_PATH;else process.env.POKEMON_ROM_PROFILE_PATH=old;
   if(oldDir===undefined)delete process.env.POKEMON_ROM_PROFILE_DIR;else process.env.POKEMON_ROM_PROFILE_DIR=oldDir;
   if(oldZip===undefined)delete process.env.POKEMON_ROM_PROFILE_ZIP;else process.env.POKEMON_ROM_PROFILE_ZIP=oldZip;
   if(oldHome===undefined)delete process.env.HOME;else process.env.HOME=oldHome;
  }
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});