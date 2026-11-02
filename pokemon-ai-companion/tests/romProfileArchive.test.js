'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {buildVerifiedProfileArchive,saveVerifiedProfileArchive,writeArchiveEntries}=require('../romProfileArchive');
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

test('ZIP writer stays compatible with original single-member profile JSON',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pokeguide-archive-legacy-'));
 try{
  const destination=path.join(root,'legacy.zip');
  const payload={schema:'test',hash:{sha256:'a'.repeat(64)},name:'Red'};
  fs.writeFileSync(destination,writeArchiveEntries([
   ['pokemon_red_rom_profile.json',payload]
  ]),{flag:'wx'});
  const found=inspectZipProfiles(destination);
  assert.equal(found.length,1);
  assert.deepEqual(found[0].profile,payload);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('ZIP profiles exceeding 4 MiB are preserved byte-for-byte in bounded chunks',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pokeguide-archive-split-'));
 try{
  // Include multibyte UTF-8 characters across chunk boundaries.
  const payload={schema:'test',message:'Olá 🇵🇹',detail:'x'.repeat(4*1024*1024+99)};
  const destination=path.join(root,'split.zip');
  const archive=writeArchiveEntries([
   ['pokemon_red_rom_profile.json',payload]
  ]);
  assert.ok(archive.length<32*1024*1024);
  assert.ok(archive.includes(Buffer.from('pokemon_red_rom_profile.json.part00')));
  assert.ok(archive.includes(Buffer.from('pokemon_red_rom_profile.json.part01')));
  const eocd=archive.length-22;
  assert.equal(archive.readUInt32LE(eocd),0x06054b50);
  assert.equal(archive.readUInt16LE(eocd+8),2);
  assert.equal(archive.readUInt16LE(eocd+10),2);
  fs.writeFileSync(destination,archive,{flag:'wx'});
  const scanned=inspectZipProfiles(destination);
  assert.equal(scanned.length,1);
  assert.deepEqual(scanned[0].profile,payload);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('ZIP reader handles three bounded chunks but rejects missing or duplicate members',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pokeguide-archive-fragments-'));
 try{
  const source={schema:'test',payload:'z'.repeat(8*1024*1024+100)};
  const bytes=writeArchiveEntries([['pokemon_blue_rom_profile.json',source]]);
  const full=path.join(root,'full.zip');
  fs.writeFileSync(full,bytes,{flag:'wx'});
  assert.deepEqual(inspectZipProfiles(full)[0].profile,source);
  assert.ok(bytes.includes(Buffer.from('pokemon_blue_rom_profile.json.part02')));
  const eocd=bytes.length-22;
  assert.equal(bytes.readUInt32LE(eocd),0x06054b50);
  assert.equal(bytes.readUInt16LE(eocd+8),3);
  assert.equal(bytes.readUInt16LE(eocd+10),3);
  const tampered=Buffer.from(bytes);
  const from=Buffer.from('pokemon_blue_rom_profile.json.part01');
  const to=Buffer.from('pokemon_blue_rom_profile.json.part09');
  for(let at=tampered.indexOf(from);at>=0;at=tampered.indexOf(from,at+from.length))
   to.copy(tampered,at);
  const broken=path.join(root,'broken.zip');
  fs.writeFileSync(broken,tampered,{flag:'wx'});
  assert.throws(()=>inspectZipProfiles(broken),/fragmento|fragment/i);
  const duplicates=path.join(root,'duplicate.zip');
  fs.writeFileSync(duplicates,writeArchiveEntries([
   ['pokemon_red_rom_profile.json',{name:'first'}],
   ['pokemon_red_rom_profile.json',{name:'second'}]
  ]),{flag:'wx'});
  assert.throws(()=>inspectZipProfiles(duplicates),/duplicado/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('three logical profiles can have more central ZIP entries than profiles',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pokeguide-three-profile-parts-'));
 try{
  const payloads=[
   ['pokemon_red_rom_profile.json',{label:'red',payload:'r'.repeat(4*1024*1024+123)}],
   ['pokemon_blue_rom_profile.json',{label:'blue',payload:'b'.repeat(4*1024*1024+456)}],
   ['pokemon_green_international_rom_profile.json',{label:'green',payload:'g'.repeat(4*1024*1024+789)}]
  ];
  const zip=writeArchiveEntries(payloads);
  const eocd=zip.length-22;
  assert.equal(zip.readUInt16LE(eocd+8),6);
  assert.equal(zip.readUInt16LE(eocd+10),6);
  const dest=path.join(root,'three.zip');
  fs.writeFileSync(dest,zip,{flag:'wx'});
  const profiles=inspectZipProfiles(dest);
  assert.equal(profiles.length,3);
  for(const [name,original] of payloads){
   const reconstituted=profiles.find(x=>x.name===name);
   assert.ok(reconstituted,'Missing original profile: '+name);
   assert.deepEqual(reconstituted.profile,original);
  }
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('archive fails closed above the total bounded three-part JSON capacity',()=>{
 assert.throws(()=>writeArchiveEntries([
  ['pokemon_green_international_rom_profile.json',
   {data:'a'.repeat(12*1024*1024+1)}]
 ]),/limite total dividido/);
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
