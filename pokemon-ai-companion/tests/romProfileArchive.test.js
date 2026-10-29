'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {buildVerifiedProfileArchive,saveVerifiedProfileArchive}=require('../romProfileArchive');
const {readRom}=require('../romComprehensiveAudit');
const {inspectZipProfiles}=require('../romAutoDiscovery');
const {parseArguments}=require('../scripts/createRealProfileArchive');

test('never certify a partial original ROM set',()=>{
 assert.throws(()=>buildVerifiedProfileArchive({}),/tres perfis originais/);
 assert.throws(()=>buildVerifiedProfileArchive({red:null,blue:null}),/tres perfis originais/);
});
test('only complete original-ROM Buffers may enter profile archiver',()=>{
 assert.throws(()=>buildVerifiedProfileArchive({
  red:Buffer.alloc(8),blue:Buffer.alloc(8),green:Buffer.alloc(8)
 }),/Buffer completo/);
});
test('three exact-size unknown images cannot be certified',()=>{
 assert.throws(()=>buildVerifiedProfileArchive({
  red:Buffer.alloc(1048576),
  blue:Buffer.alloc(1048576),
  green:Buffer.alloc(1048576)
 }),/Checksum|ROM|cabeçalho/i);
});
test('CLI rejects missing options, duplicate options and non-ZIP destination',()=>{
 assert.throws(()=>parseArguments([]),/necessarios/);
 assert.throws(()=>parseArguments(['--red','a','--red','b']),/invalidos/);
 assert.throws(()=>parseArguments([
  '--red','a','--blue','b','--green','c','--out','package.json'
 ]),/zip/);
});
test('failed ROM identity check does not create a file',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pokeguide-archive-negative-'));
 const output=path.join(root,'profiles.zip');
 try{
  assert.throws(()=>saveVerifiedProfileArchive(output,{
   red:Buffer.alloc(1048576),blue:Buffer.alloc(1048576),green:Buffer.alloc(1048576)
  }));
  assert.equal(fs.existsSync(output),false);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
const configured=['POKEMON_RED_ROM','POKEMON_BLUE_ROM','POKEMON_GREEN_ROM']
 .every(key=>Boolean(process.env[key]));
test('real original ROMs build ZIP accepted by the independent profile reader',
 {skip:!configured?'Provide the three original ROM paths to perform real archive verification':false},()=>{
  const roms={
   red:readRom(process.env.POKEMON_RED_ROM),
   blue:readRom(process.env.POKEMON_BLUE_ROM),
   green:readRom(process.env.POKEMON_GREEN_ROM)
  };
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pokeguide-archive-original-'));
  try{
   const destination=path.join(root,'pokemon_gen1_red_blue_green_profiles_v4.zip');
   const result=saveVerifiedProfileArchive(destination,roms);
   assert.equal(result.verified,true);
   assert.equal(result.entryCount,3);
   const imported=inspectZipProfiles(destination);
   assert.equal(imported.length,3);
   assert.deepEqual(new Set(imported.map(p=>p.profile.hash.crc32)),
    new Set(['9F7FDD53','D6DA8A1A','3C2DD8AE']));
   assert.ok(imported.every(p=>p.profile.capabilities.tmHmReadForSpecies===150));
   assert.ok(imported.every(p=>p.profile.spritesWithPixelsDecoded===150));
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
