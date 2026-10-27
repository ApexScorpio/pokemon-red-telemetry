'use strict';
// Descoberta AUTOMÁTICA, SOMENTE LEITURA, das ROMs e perfis Gen I.
// Funciona sem variáveis de ambiente se os ficheiros estiverem nas pastas usuais.
// O ZIP fornecido pela conversa pode estar simplesmente em Downloads: NÃO exige extrair.
// Não pesquisa C:\ inteiro, não altera ROMs, saves, credenciais ou pastas externas.
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');

const MAX_DIR_ENTRIES=500, MAX_ZIP_SIZE=32*1024*1024;
const MAX_JSON_UNCOMPRESSED=4*1024*1024, MAX_PROFILES=32;
const ROM_EXT=/\.(?:gb|gbc)$/i;
const PROFILE_NAME=/^pokemon_(?:red|blue|green)(?:_international.*?)?_rom_profile\.json$/i;
const PROFILE_ZIP_NAME=/^pokemon_gen1_red_blue_green_profiles(?:_v\d+)?\.zip$/i;

function safeDir(dir){
 try {return fs.statSync(dir).isDirectory();} catch {return false;}
}
function pathsToCheck(root){
 return [
  root,
  path.join(root,'roms'),path.join(root,'ROMs'),path.join(root,'games'),
  path.join(root,'pokemon'),path.join(root,'Pokemon'),
  path.join(root,'rom-profiles'),path.join(root,'profiles'),
  path.join(root,'data','rom-profiles'),path.join(root,'data','profiles'),
  path.join(root,'RetroArch','roms'),path.join(root,'RetroArch','downloads'),
  path.join(root,'games','pokemon')
 ];
}
function searchRoots(base=__dirname,env=process.env){
 const roots=[base,path.dirname(base),path.dirname(path.dirname(base)),process.cwd()];
 const home=env.USERPROFILE||env.HOME||null;
 if(home){
  roots.push(path.join(home,'Downloads'),path.join(home,'Documents'),path.join(home,'Desktop'),
   path.join(home,'Games'),path.join(home,'RetroArch'));
 }
 if(process.platform==='win32'||env.POKEMON_AUTO_SEARCH_S_DRIVE==='1'){
  roots.push('S:\\tmp','S:\\ROMs','S:\\Games','S:\\Pokemon',
   'S:\\tmp\\pokemon-rom-profiles','S:\\tmp\\pokemon-red-telemetry-upload');
 }
 for(const e of ['POKEMON_ROM_PATH','POKEMON_ROM_DIR','POKEMON_ROM_PROFILE_PATH',
                 'POKEMON_ROM_PROFILE_DIR','POKEMON_ROM_PROFILE_ZIP']){
  if(env[e])roots.push(path.extname(env[e])?path.dirname(env[e]):env[e]);
 }
 const dirs=[];
 const seen=new Set();
 for(const root of roots){
  for(const candidate of pathsToCheck(root)){
   const key=path.normalize(candidate).toLowerCase();
   if(!seen.has(key)){seen.add(key);if(safeDir(candidate))dirs.push(candidate);}
  }
 }
 return dirs;
}
function listCandidates(base=__dirname,env=process.env){
 const found={romFiles:[],profileFiles:[],zipFiles:[],directories:[],warnings:[]};
 const seen=new Set();
 const scan=(dir)=>{
  let entries;
  try{entries=fs.readdirSync(dir,{withFileTypes:true});}
  catch(e){found.warnings.push('Não foi possível ler '+dir+': '+e.code);return;}
  if(entries.length>MAX_DIR_ENTRIES){found.warnings.push('Pasta demasiado grande, ignorada: '+dir);return;}
  found.directories.push(dir);
  for(const entry of entries){
   if(!entry.isFile())continue; // nunca seguir atalhos ou links simbólicos
   const filename=entry.name,full=path.join(dir,filename);
   const key=path.normalize(full).toLowerCase();
   if(seen.has(key))continue;seen.add(key);
   if(ROM_EXT.test(filename))found.romFiles.push(full);
   else if(PROFILE_NAME.test(filename))found.profileFiles.push(full);
   else if(PROFILE_ZIP_NAME.test(filename))found.zipFiles.push(full);
  }
 };
 for(const dir of searchRoots(base,env))scan(dir);
 for(const e of ['POKEMON_ROM_PATH','POKEMON_ROM_PROFILE_PATH','POKEMON_ROM_PROFILE_ZIP']){
  const full=env[e];
  if(!full)continue;
  const key=path.normalize(full).toLowerCase();
  if(seen.has(key))continue;
  try{
   if(!fs.statSync(full).isFile())continue;
   seen.add(key);
   if(ROM_EXT.test(full))found.romFiles.unshift(full);
   else if(/\.json$/i.test(full))found.profileFiles.unshift(full);
   else if(/\.zip$/i.test(full))found.zipFiles.unshift(full);
  }catch(e){found.warnings.push('Ficheiro configurado não acessível: '+path.basename(full));}
 }
 const limit=(a)=>a.splice(MAX_PROFILES);
 limit(found.romFiles);limit(found.profileFiles);limit(found.zipFiles);
 return found;
}

// Leitura segura de ficheiros JSON em ZIP em memória, sem extração para disco.
// Índice ZIP central verificado; máximos de tamanho; CRC32 por entrada.
const crcTable=Array.from({length:256},(_,n)=>{
 let v=n;for(let i=0;i<8;i++)v=(v&1)?0xEDB88320^(v>>>1):v>>>1;
 return v>>>0;
});
function crc32(b){
 let v=0xFFFFFFFF;for(const n of b)v=crcTable[(v^n)&255]^(v>>>8);
 return (v^0xFFFFFFFF)>>>0;
}
function inspectZipProfiles(filename){
 const zip=fs.readFileSync(filename);
 if(zip.length>MAX_ZIP_SIZE||zip.length<22)throw Error('ZIP demasiado grande ou incompleto');
 let end=-1;
 for(let p=zip.length-22;p>=Math.max(0,zip.length-65557);p--){
  if(zip.readUInt32LE(p)===0x06054b50){end=p;break;}
 }
 if(end<0)throw Error('Fim do ZIP não encontrado');
 const count=zip.readUInt16LE(end+10),indexSize=zip.readUInt32LE(end+12);
 let pos=zip.readUInt32LE(end+16);
 if(count>256||pos+indexSize>zip.length)throw Error('Índice ZIP inválido');
 const profiles=[];
 for(let i=0;i<count;i++){
  if(pos+46>zip.length||zip.readUInt32LE(pos)!==0x02014b50)throw Error('Índice ZIP corrupto');
  const flags=zip.readUInt16LE(pos+8),method=zip.readUInt16LE(pos+10);
  const expectedCrc=zip.readUInt32LE(pos+16),compressed=zip.readUInt32LE(pos+20),
    uncompressed=zip.readUInt32LE(pos+24),nameLen=zip.readUInt16LE(pos+28),
    extra=zip.readUInt16LE(pos+30),comment=zip.readUInt16LE(pos+32);
  const local=zip.readUInt32LE(pos+42),name=zip.subarray(pos+46,pos+46+nameLen).toString('utf8');
  pos+=46+nameLen+extra+comment;
  if(!PROFILE_NAME.test(name)||name.includes('/')||name.includes('\\'))continue;
  if((flags&1)!==0||![0,8].includes(method)||uncompressed>MAX_JSON_UNCOMPRESSED||
     compressed>MAX_JSON_UNCOMPRESSED||local+30>zip.length||
     zip.readUInt32LE(local)!==0x04034b50)throw Error('Perfil comprimido inválido');
  const localName=zip.readUInt16LE(local+26),localExtra=zip.readUInt16LE(local+28);
  const start=local+30+localName+localExtra;
  if(start+compressed>zip.length)throw Error('Perfil ZIP truncado');
  const raw=zip.subarray(start,start+compressed);
  const data=method===8?zlib.inflateRawSync(raw,{maxOutputLength:MAX_JSON_UNCOMPRESSED}):raw;
  if(data.length!==uncompressed||crc32(data)!==expectedCrc)
   throw Error('CRC ou tamanho de perfil ZIP incorreto');
  profiles.push({name,profile:JSON.parse(data.toString('utf8'))});
  if(profiles.length>=MAX_PROFILES)break;
 }
 return profiles;
}
module.exports={searchRoots,listCandidates,inspectZipProfiles};
