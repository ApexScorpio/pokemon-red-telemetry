'use strict';
// PokéGuide: pack genuine ROM-derived profiles in the ZIP format understood by romAutoDiscovery.
// This module never creates or modifies ROMs, saves, game sessions or user profiles.
const fs=require('node:fs');
const zlib=require('node:zlib');
const {KNOWN}=require('./romComprehensiveAudit');
const {inspectRomBuffer}=require('./romVariantRegistry');
const {inspectZipProfiles}=require('./romAutoDiscovery');

const ENTRIES=Object.freeze({
 red:'pokemon_red_rom_profile.json',
 blue:'pokemon_blue_rom_profile.json',
 green:'pokemon_green_international_rom_profile.json'
});
const EXPECTED_CRC=Object.freeze({
 red:'9F7FDD53',blue:'D6DA8A1A',green:'3C2DD8AE'
});
// Preserve the strict 4 MiB *per-entry* inflation bound enforced by the
// independent reader. A larger verified profile is losslessly split into
// at most three bounded ZIP members and reconstructed in memory.
const MAX_ENTRY=4*1024*1024;
const MAX_PARTS=3;
const MAX_ARCHIVE=32*1024*1024;
const CRC_TABLE=Array.from({length:256},(_,start)=>{
 let value=start;
 for(let i=0;i<8;i++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;
 return value>>>0;
});
function crc32(buffer){
 let result=0xffffffff;
 for(const n of buffer)result=CRC_TABLE[(result^n)&255]^(result>>>8);
 return (result^0xffffffff)>>>0;
}
function derivedProfile(profile,variant){
 if(!profile||typeof profile!=='object'||profile.schema!=='gen1-rom-profile-v1'||
    profile.hash?.sha256!==KNOWN[variant]||
    profile.hash?.crc32!==EXPECTED_CRC[variant]||
    profile.bytes!==1048576||profile.bytesRead!==profile.bytes||
    profile.unknownLayout===true||
    profile.world?.maps?.valid!==true||
    profile.world?.maps?.validMapHeaders!==226||
    !Array.isArray(profile.species)||profile.species.length!==190||
    !Array.isArray(profile.moveNames)||profile.moveNames.length!==165||
    !Array.isArray(profile.growthRates)||profile.growthRates.length!==6||
    !profile.validated||
    !['names','dexOrder','baseStats','growthRates','evolutions','moveNames']
      .every(k=>profile.validated[k]===true&&profile.offsets?.[k]?.fileOffset>=0))
   throw Error('Perfil original nao foi estruturalmente validado: '+variant);
 const decoded=profile.species.filter(x=>x.sprite?.pixelsDecoded===true).length;
 const distinct=new Map();
 for(const species of profile.species){
  const dex=species?.dex;
  if(Number.isInteger(dex)&&dex>=1&&dex<=150&&species?.stats){
   const machine=species.stats.tmHm;
   if(machine?.source==='ROM_BASESTATS_BITS_VERIFICADOS'&&
      /^[0-9a-f]{14}$/i.test(machine.rawHex||'')){
     const old=distinct.get(dex);
     if(old&&old!==machine.rawHex)throw Error('Contradicao de TM/HM no dex '+dex);
     distinct.set(dex,machine.rawHex);
   }
  }
 }
 const machineCount=distinct.size;
 if(decoded!==150||machineCount!==150)
  throw Error('Sprite pixels ou TM/HM nao estao comprovados: '+variant+
    ' sprites='+decoded+' machines='+machineCount);
 const bulbasaur=profile.species.find(x=>x.name==='BULBASAUR');
 if(bulbasaur?.stats?.tmHm?.rawHex!=='a40338c0030806')
  throw Error('Tabela de TM/HM Bulbasaur diverge: '+variant);
 return {
  ...profile,
  capabilities:{
   ...(profile.capabilities||{}),
   tmHmReadForSpecies:machineCount
  }
 };
}
function writeArchiveEntries(entries){
 const locals=[],central=[];
 let position=0;
 const normalized=[];
 for(const [name,json] of entries){
  if(!/^pokemon_(?:red|blue|green)(?:_international.*?)?_rom_profile\.json$/i.test(name))
   throw Error('Nome de perfil ROM nao permitido no ZIP');
  const original=Buffer.from(JSON.stringify(json),'utf8');
  if(original.length===0||original.length>MAX_ENTRY*MAX_PARTS)
   throw Error('Perfil ROM ultrapassa limite total dividido ('+
    original.length+' bytes)');
  if(original.length<=MAX_ENTRY)normalized.push([name,original]);
  else {
   const count=Math.ceil(original.length/MAX_ENTRY);
   for(let i=0;i<count;i++)
    normalized.push([name+'.part'+String(i).padStart(2,'0'),
     original.subarray(i*MAX_ENTRY,(i+1)*MAX_ENTRY)]);
  }
 }
 for(const [name,original] of normalized){
  const filename=Buffer.from(name,'utf8');
  if(filename.length>255||original.length===0||original.length>MAX_ENTRY)
   throw Error('Entrada ZIP excede limites da auditora');
  const compressed=zlib.deflateRawSync(original,{level:6});
  if(compressed.length>MAX_ENTRY)throw Error('Perfil comprimido excede limite');
  const checksum=crc32(original);
  const header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50,0);
  header.writeUInt16LE(20,4);
  header.writeUInt16LE(0x800,6);
  header.writeUInt16LE(8,8);
  header.writeUInt32LE(checksum,14);
  header.writeUInt32LE(compressed.length,18);
  header.writeUInt32LE(original.length,22);
  header.writeUInt16LE(filename.length,26);
  locals.push(header,filename,compressed);
  const index=Buffer.alloc(46);
  index.writeUInt32LE(0x02014b50,0);
  index.writeUInt16LE(20,4);
  index.writeUInt16LE(20,6);
  index.writeUInt16LE(0x800,8);
  index.writeUInt16LE(8,10);
  index.writeUInt32LE(checksum,16);
  index.writeUInt32LE(compressed.length,20);
  index.writeUInt32LE(original.length,24);
  index.writeUInt16LE(filename.length,28);
  index.writeUInt32LE(position,42);
  central.push(index,filename);
  position+=header.length+filename.length+compressed.length;
 }
 const centralSize=central.reduce((sum,b)=>sum+b.length,0);
 const tail=Buffer.alloc(22);
 tail.writeUInt32LE(0x06054b50,0);
 tail.writeUInt16LE(entries.length,8);
 tail.writeUInt16LE(entries.length,10);
 tail.writeUInt32LE(centralSize,12);
 tail.writeUInt32LE(position,16);
 const zip=Buffer.concat([...locals,...central,tail]);
 if(zip.length>MAX_ARCHIVE)throw Error('Pacote ZIP demasiado grande');
 return zip;
}
function buildVerifiedProfileArchive(profiles){
 // Re-run the real ROM decoder for every variant. Never trust caller-supplied profile JSON.
 if(!profiles||typeof profiles!=='object'||
    Object.keys(profiles).sort().join(',')!=='blue,green,red')
  throw Error('Sao obrigatorios os tres perfis originais Red/Blue/Green International');
 const list=Object.keys(ENTRIES).map(variant=>{
  const bytes=profiles[variant];
  if(!Buffer.isBuffer(bytes)||bytes.length!==1048576)
   throw Error('ROM original nao fornecida como Buffer completo: '+variant);
  const profile=inspectRomBuffer(bytes,variant+'.gb');
  return [ENTRIES[variant],derivedProfile(profile,variant)];
 });
 return writeArchiveEntries(list);
}
function saveVerifiedProfileArchive(destination,profiles){
 if(!/\.zip$/i.test(destination))throw Error('Destino deve ser ZIP');
 const bytes=buildVerifiedProfileArchive(profiles);
 // The existing ZIP parser is an independent parser validating archive entries and their CRCs.
 const parent=require('node:path').dirname(destination);
 if(!fs.statSync(parent).isDirectory())throw Error('Pasta de destino nao existe');
 // The file is exclusive. No user file is overwritten; remove only our own failed output.
 let written=false;
 try{
  fs.writeFileSync(destination,bytes,{flag:'wx'});
  written=true;
  const scanned=inspectZipProfiles(destination);
  if(scanned.length!==3||
     scanned.some(({profile})=>profile?.capabilities?.tmHmReadForSpecies!==150)||
     new Set(scanned.map(x=>x.profile.hash.sha256)).size!==3)
   throw Error('Leitura independente do ZIP de perfis falhou');
  return {verified:true,entryCount:scanned.length,bytes:bytes.length,path:destination};
 }catch(e){
  if(written)fs.rmSync(destination,{force:true});
  throw e;
 }
}
module.exports={buildVerifiedProfileArchive,saveVerifiedProfileArchive,writeArchiveEntries};
