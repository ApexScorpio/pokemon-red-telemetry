'use strict';
// Seleciona um perfil ROM só quando o CRC32 reportado pelo RetroArch corresponde
// ao ficheiro local lido integralmente. Nunca carrega/reescreve saves nem ROMs.
const fs=require('node:fs'),path=require('node:path');
const {inspectRom,runtimeMatches}=require('./romVariantRegistry');
const {listCandidates,inspectZipProfiles}=require('./romAutoDiscovery');
const TYPES={0:'Normal',1:'Fighting',2:'Flying',3:'Poison',4:'Ground',5:'Rock',
  7:'Bug',8:'Ghost',20:'Fire',21:'Water',22:'Grass',23:'Electric',
  24:'Psychic',25:'Ice',26:'Dragon'};
function localRomPaths(){
 const candidates=[];
 if(process.env.POKEMON_ROM_PATH)candidates.push(process.env.POKEMON_ROM_PATH);
 const dir=process.env.POKEMON_ROM_DIR;
 if(dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory()){
  const entries=fs.readdirSync(dir,{withFileTypes:true})
   .filter(e=>e.isFile()&&/\.gbc?$/i.test(e.name)).slice(0,100);
  for(const e of entries)candidates.push(path.join(dir,e.name));
 }
 return [...new Set(candidates)];
}
function profilePaths(){
 const paths=[];
 if(process.env.POKEMON_ROM_PROFILE_PATH)paths.push(process.env.POKEMON_ROM_PROFILE_PATH);
 const dir=process.env.POKEMON_ROM_PROFILE_DIR;
 if(dir){
  try{
   if(fs.statSync(dir).isDirectory()){
    const entries=fs.readdirSync(dir,{withFileTypes:true})
     .filter(e=>e.isFile()&&/\.json$/i.test(e.name)).slice(0,256);
    for(const e of entries)paths.push(path.join(dir,e.name));
   }
  }catch(e){/* report individual source errors in buildProfiles */ }
 }
 return [...new Set(paths)];
}
function loadProfile(filename){
 const profile=JSON.parse(fs.readFileSync(filename,'utf8'));
 if(profile.schema!=='gen1-rom-profile-v1'||
    !/^[0-9a-f]{64}$/i.test(profile.hash?.sha256||'')||
    !/^[0-9a-f]{8}$/i.test(profile.hash?.crc32||'')||
    !Number.isInteger(profile.bytes)||profile.bytes<32768||
    profile.bytesRead!==profile.bytes||
    !Array.isArray(profile.species)||profile.species.length!==190||
    !Array.isArray(profile.moveNames)||profile.moveNames.length!==165||
    !Array.isArray(profile.growthRates)||profile.growthRates.length!==6||
    !profile.validated||!Object.values(profile.validated).every(v=>v===true)||
    !['names','dexOrder','baseStats','growthRates','evolutions','moveNames'].every(k=>profile.offsets?.[k]&&profile.validated[k]===true)||
    profile.unknownLayout===true)throw Error('perfil JSON inválido ou incompleto');
 profile.source='PERFIL_IMPORTADO_DE_ROM_VERIFICADA; ROM LOCAL NÃO RELIDA';
 return profile;
}
function profileQuality(profile) {
 const sprite=profile.spritesWithPixelsDecoded||0;
 const world=profile.world?.wildEncounters?.valid&&profile.world?.maps?.valid?1:0;
 const verifiedMachineData=profile.capabilities?.tmHmBitfields ||
   profile.species?.some(p=>p.stats?.tmHm?.source==='ROM_BASESTATS_BITS_VERIFICADOS');
 return sprite*10+world*100+(verifiedMachineData?50:0)+
   (profile.source==='local-ROM-file'?10000:0);
}
function buildProfiles(){
 const profiles=[],errors=[];
 const seen=new Map();
 const discovered=listCandidates(__dirname);
 const add=(p,source)=>{
  if(p.schema!=='gen1-rom-profile-v1'||
     !/^[0-9a-f]{64}$/i.test(p.hash?.sha256||'')||
     !/^[0-9a-f]{8}$/i.test(p.hash?.crc32||'')||
     !Number.isInteger(p.bytes)||p.bytes<32768||
     p.bytesRead!==p.bytes||
     !Array.isArray(p.species)||p.species.length!==190||
     !Array.isArray(p.moveNames)||p.moveNames.length!==165||
     !Array.isArray(p.growthRates)||p.growthRates.length!==6||
     !p.validated||!['names','dexOrder','baseStats','growthRates','evolutions','moveNames']
       .every(k=>p.offsets?.[k]&&p.validated[k]===true)||
     p.unknownLayout===true)throw Error('perfil JSON inválido/incompleto');
  p.source=source;
  const other=seen.get(p.hash.sha256);
  if(other!==undefined){
    if(profileQuality(p)>profileQuality(profiles[other]))profiles[other]=p;
  }else{
    seen.set(p.hash.sha256,profiles.length);
    profiles.push(p);
  }
 };
 // A prioridade já não depende de POKEMON_ROM_PROFILE_DIR: descobrir ao abrir.
 for(const filename of discovered.profileFiles){
  try{add(loadProfile(filename),'PERFIL_IMPORTADO_DE_ROM_VERIFICADA; ROM LOCAL NÃO RELIDA');}
  catch(e){errors.push({file:path.basename(filename),error:e.message});}
 }
 // Pacote v3 funciona diretamente, mesmo ainda comprimido em Downloads.
 const sortedZip=[...discovered.zipFiles].sort((a,b)=>{
  const version=n=>Number(path.basename(n).match(/_v(\d+)\.zip$/i)?.[1]||0);
  return version(b)-version(a);
 });
 for(const filename of sortedZip){
  try{
    for(const {name,profile} of inspectZipProfiles(filename)){
      try{add(profile,'PERFIL_IMPORTADO_DE_ROM_VERIFICADA; ROM LOCAL NÃO RELIDA');}
      catch(e){errors.push({file:path.basename(filename)+'/'+name,error:e.message});}
    }
  }catch(e){errors.push({file:path.basename(filename),error:e.message});}
 }
 // O binário ROM local, quando existe, tem prioridade e gera perfil integral.
 for(const filename of discovered.romFiles){
  try{
   const size=fs.statSync(filename).size;
   if(size<32768||size>8388608)throw Error('tamanho não suportado');
   const profile=inspectRom(filename);
   if(profile.unknownLayout||!Object.values(profile.validated).every(Boolean))
     throw Error('ROM com tabelas desconhecidas: não atribuir valores supostos');
   add(profile,'local-ROM-file');
  }catch(e){errors.push({file:path.basename(filename),error:e.message});}
 }
 return {profiles,errors,discovery:{
   mode:'AUTOMÁTICO_NO_ARRANQUE',directoriesChecked:discovered.directories.length,
   profileFiles:discovered.profileFiles.length,zipFiles:discovered.zipFiles.length,
   romFiles:discovered.romFiles.length,profilesLoaded:profiles.length,
   warnings:discovered.warnings.slice(0,10),
   profiles:profiles.map(p=>({title:p.title,crc32:p.hash.crc32,
     sprites:p.spritesWithPixelsDecoded||0,hasWorld:!!p.world?.maps?.valid,
     origin:p.source}))
 }};
}
function getCurrentRom(status,profiles){
 if(!/\bPLAYING\b|\bPAUSED\b/.test(String(status||'')))return null;
 const matching=profiles.filter(p=>runtimeMatches(p,status));
 return matching.length===1 ? matching[0] : null;
}
function pokemonFromProfile(profile,internalId,reference){
 if(!profile||!Number.isInteger(internalId))return null;
 const p=profile.species[internalId-1];
 if(!p||p.internalId!==internalId||!p.name)return null;
 const types=p.stats?.typeIds?.map(i=>TYPES[i]||'Desconhecido')||[];
 return {
  name:p.name,dex:p.dex,types,baseHp:p.stats?.baseHp??null,
  catchRate:p.stats?.catchRate??null,attack:p.stats?.attack??null,
  defense:p.stats?.defense??null,speed:p.stats?.speed??null,
  special:p.stats?.special??null,
  tmHmFromRom:p.stats?.tmHm?.source==='ROM_BASESTATS_BITS_VERIFICADOS'?p.stats.tmHm:null,
  spriteRom:p.sprite?.verified ? p.sprite : null,
  spritePixelDataSource:'AINDA_NÃO_DESCODIFICADA',
  source:profile.source==='PERFIL_IMPORTADO_DE_ROM_VERIFICADA; ROM LOCAL NÃO RELIDA' ?
    'PERFIL_DA_ROM_CRC32_CONFIRMADO' : 'ROM_LOCAL_CRC32_CONFIRMADO',
  movesAndEvolutionsSource:p.learnset?'ROM_VERIFICADA_PELO_CRC32':'NÃO_DISPONÍVEL'
 };
}
function moveNameFromProfile(profile,id){
 return profile&&Number.isInteger(id)&&id>0 ? profile.moveNames?.[id-1]||null : null;
}
module.exports={buildProfiles,getCurrentRom,pokemonFromProfile,moveNameFromProfile};