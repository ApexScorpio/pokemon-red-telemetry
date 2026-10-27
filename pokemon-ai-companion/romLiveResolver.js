'use strict';
// Seleciona um perfil ROM só quando o CRC32 reportado pelo RetroArch corresponde
// ao ficheiro local lido integralmente. Nunca carrega/reescreve saves nem ROMs.
const fs=require('node:fs'),path=require('node:path');
const {inspectRom,runtimeMatches}=require('./romVariantRegistry');
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
function buildProfiles(){
 const profiles=[],errors=[];
 for(const filename of localRomPaths()){
  try{
   const size=fs.statSync(filename).size;
   if(size<0x8000||size>0x800000)throw Error('tamanho não suportado');
   const profile=inspectRom(filename);
   if(profile.unknownLayout)throw Error('não foi possível validar tabelas Gen I');
   profiles.push(profile);
  }catch(e){errors.push({file:path.basename(filename),error:e.message});}
 }
 return {profiles,errors};
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
  source:'ROM_VERIFICADA_PELO_CRC32',
  movesAndEvolutionsSource:p.learnset?'ROM_VERIFICADA_PELO_CRC32':'NÃO_DISPONÍVEL'
 };
}
function moveNameFromProfile(profile,id){
 return profile&&Number.isInteger(id)&&id>0 ? profile.moveNames?.[id-1]||null : null;
}
module.exports={buildProfiles,getCurrentRom,pokemonFromProfile,moveNameFromProfile};