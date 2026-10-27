'use strict';
// Equipas dos treinadores Gen I lidas da ROM, com alternativa auditada
// SOMENTE para os três SHA-256 das ROMs fornecidas pelo jogador.
// Fonte: ponteiros TrainerDataPointers, 47 classes, formatos normal/$FF.
// Não contém os bytes originais da ROM: atlas de pares (ID interno, nível).
const crypto=require('node:crypto');
const zlib=require('node:zlib');

const BANK=0x4000,CLASSES=47,POINTER_TABLE_SIZE=CLASSES*2;
const AUDITED_SHA=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
]);
// Metadados reconstruídos e comparados com as três ROMs (415 formações).
const AUDITED_ATLAS_B64='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';
const EXPECTED_NORMALIZED_SHA='92295a1f8923ae6c57e9cca9a95fab3c88b7a2264cc10152f9a44aeb824c1741';
// Nomes descodificados da tabela TrainerNames das ROMs auditadas.
// A classe 25/42/43 refere-se aos três conjuntos de batalhas do rival.
const AUDITED_CLASS_NAMES='YOUNGSTER|BUG CATCHER|LASS|SAILOR|JR.TRAINER♂|JR.TRAINER♀|POKéMANIAC|SUPER NERD|HIKER|BIKER|BURGLAR|ENGINEER|JUGGLER|FISHERMAN|SWIMMER|CUE BALL|GAMBLER|BEAUTY|PSYCHIC|ROCKER|JUGGLER|TAMER|BIRD KEEPER|BLACKBELT|RIVAL1|PROF.OAK|CHIEF|SCIENTIST|GIOVANNI|ROCKET|COOLTRAINER♂|COOLTRAINER♀|BRUNO|BROCK|MISTY|LT.SURGE|ERIKA|KOGA|BLAINE|SABRINA|GENTLEMAN|RIVAL2|RIVAL3|LORELEI|CHANNELER|AGATHA|LANCE'.split('|');
function decodeTrainerName(bytes){
 let s='';
 for(const b of bytes){
  if(b>=0x80&&b<=0x99)s+=String.fromCharCode(65+b-0x80);
  else if(b>=0xa0&&b<=0xb9)s+=String.fromCharCode(97+b-0xa0);
  else if(b===0x7f)s+=' ';
  else if(b===0xe8)s+='.';
  else if(b===0xef)s+='♂';
  else if(b===0xf5)s+='♀';
  else if(b===0xba)s+='é';
  else if(b===0xf7)s+='1';
  else if(b===0xf8)s+='2';
  else if(b===0xf9)s+='3';
  else return null;
 }
 return s;
}
function parseTrainerClassNames(rom){
 const first=Buffer.from([0x98,0x8e,0x94,0x8d,0x86,0x92,0x93,0x84,0x91,0x50]);
 const found=[];
 for(let at=0;(at=rom.indexOf(first,at))!==-1;at++){
  const names=[],bankEnd=Math.min(rom.length,(Math.floor(at/BANK)+1)*BANK);
  let pos=at,valid=true;
  for(let i=0;i<CLASSES;i++){
   const end=rom.indexOf(0x50,pos);
   if(end<pos||end>=bankEnd||end-pos>20||end===pos){valid=false;break;}
   const name=decodeTrainerName(rom.subarray(pos,end));
   if(!name){valid=false;break;}
   names.push(name);pos=end+1;
  }
  if(valid&&names.length===47&&names.every((x,i)=>x===AUDITED_CLASS_NAMES[i]))
   found.push({fileOffset:at,names});
 }
 return found.length===1 ? {verified:true,source:'ROM_TRAINER_NAMES_47_CLASSES',...found[0]} :
    {verified:false,source:'NOMES_DE_CLASSES_NÃO_VALIDADOS',matches:found.length};
}
function loadAuditedAtlas(){
 const plain=zlib.inflateSync(Buffer.from(AUDITED_ATLAS_B64,'base64'));
 const sha=crypto.createHash('sha256').update(plain).digest('hex');
 if(sha!==EXPECTED_NORMALIZED_SHA)throw Error('Atlas de equipas corrompido');
 const rosters=JSON.parse(plain.toString('utf8'));
 if(!Array.isArray(rosters)||rosters.length!==CLASSES||rosters.reduce((n,c)=>n+c.length,0)!==415)
   throw Error('Estrutura do atlas de 47 classes inválida');
 return rosters;
}
let cachedAtlas=null;
function fallbackForKnownProfile(profile){
 const sha=profile?.hash?.sha256?.toLowerCase();
 if(!AUDITED_SHA.has(sha))return null;
 if(!cachedAtlas)cachedAtlas=loadAuditedAtlas();
 return {verified:true,source:'METADADOS_EXTRAÍDOS_E_COMPARADOS_NAS_3_ROMS',classCount:CLASSES,
   teamCount:415,rosters:cachedAtlas,classNames:AUDITED_CLASS_NAMES,
   requiresExactSha:true};
}
// Procurar dinamicamente o início da tabela (47 pointers monotónicos),
// exigir que primeiro ponteiro comece logo após os 94 bytes de ponteiros,
// e descodificar TODOS os registos até à próxima classe.
// A última classe (Lance) tem uma só equipa na Gen I.
function parseTrainerParties(rom){
 if(!Buffer.isBuffer(rom)||rom.length%BANK||rom.length<BANK*2)
   return {verified:false,source:'ROM_INVALIDA'};
 const found=[];
 for(let bank=1;bank<rom.length/BANK;bank++){
  const start=bank*BANK,end=start+BANK-POINTER_TABLE_SIZE;
  for(let pos=start;pos<end;pos++){
   const cpu=0x4000+pos%BANK;
   if(cpu+POINTER_TABLE_SIZE>=0x8000||rom.readUInt16LE(pos)!==cpu+POINTER_TABLE_SIZE)continue;
   const pointers=Array.from({length:CLASSES},(_,i)=>rom.readUInt16LE(pos+2*i));
   if(pointers.some(p=>p<0x4000||p>=0x8000)||pointers.some((p,i)=>i&&p<pointers[i-1])||
      new Set(pointers).size<40||pointers[CLASSES-1]>0x7ff0)continue;
   let valid=true;
   const rosters=[];
   for(let classIndex=0;classIndex<CLASSES;classIndex++){
    const ptr=pointers[classIndex],alias=classIndex<CLASSES-1&&ptr===pointers[classIndex+1];
    if(alias){rosters.push(null);continue;}
    const next=pointers.slice(classIndex+1).find(x=>x>ptr);
    const limit=classIndex===CLASSES-1? Math.min(start+BANK,start+ptr-0x4000+64):
      start+next-0x4000;
    let q=start+ptr-0x4000;
    const teams=[];
    while(q<limit && (classIndex!==CLASSES-1||teams.length===0)){
     const first=rom[q++],members=[];
     if(first===0){valid=false;break;}
     if(first===0xff){
      while(q<limit&&rom[q]!==0){
       if(q+1>=limit){valid=false;break;}
       const level=rom[q++],species=rom[q++];
       if(level<1||level>100||species<1||species>190){valid=false;break;}
       members.push([species,level]);if(members.length>6){valid=false;break;}
      }
     }else{
      if(first<1||first>100){valid=false;break;}
      while(q<limit&&rom[q]!==0){
       const species=rom[q++];if(species<1||species>190){valid=false;break;}
       members.push([species,first]);if(members.length>6){valid=false;break;}
      }
     }
     if(!valid||!members.length||q>=limit){valid=false;break;}
     q++;teams.push(members);
    }
    if(!valid||classIndex!==CLASSES-1&&q!==limit){valid=false;break;}
    rosters.push(teams);
   }
   if(!valid)continue;
   for(let i=0;i<CLASSES;i++)if(rosters[i]===null)rosters[i]=rosters[i+1];
   const count=rosters.reduce((n,c)=>n+c.length,0);
   if(count<200||count>800)continue;
   found.push({verified:true,source:'ROM_BINARIA_47_CLASSES_LOCALIZADA_POR_ESTRUTURA',
      pointerTableFileOffset:pos,bank,rosters,classCount:CLASSES,teamCount:count});
  }
 }
 if(found.length===1){
   const names=parseTrainerClassNames(rom);
   found[0].classNames=names.verified?names.names:null;
   found[0].classNameSource=names.source;
   return found[0];
 }
 return {verified:false,source:'TABELA_TREINADORES_AMBÍGUA',candidates:found.length};
}
function getTrainerParty(profile,trainerClassId,trainerNumber){
 if(!profile||!Number.isInteger(trainerClassId)||!Number.isInteger(trainerNumber)||
    trainerClassId<=200||trainerClassId>200+CLASSES||trainerNumber<1)return null;
 const table=profile.trainerParties?.verified ? profile.trainerParties : fallbackForKnownProfile(profile);
 if(!table||!Array.isArray(table.rosters))return null;
 const members=table.rosters[trainerClassId-201]?.[trainerNumber-1];
 if(!Array.isArray(members)||!members.length)return null;
 // O rival muda a formação segundo o inicial escolhido e as opções do
 // script. O número no objeto do mapa, por si só, não comprova qual variante
 // foi ativada. Expor o tipo, mas não uma equipa específica como certa.
 if([225,242,243].includes(trainerClassId))
   return {source:'ROM_RIVAL_COM_VARIANTE_DE_EQUIPA_POR_RESOLVER',
     trainerClassId,trainerNumber,
     className:table.classNames?.[trainerClassId-201]||null,
     team:null,variantDependent:true};
 return {source:table.source,trainerClassId,trainerNumber,
   className:table.classNames?.[trainerClassId-201]||null,
   team:members.map(([internalId,level])=>({
    internalId,level,
    name:profile.species?.[internalId-1]?.name||null,
    dex:profile.species?.[internalId-1]?.dex||null
   }))};
}
module.exports={parseTrainerParties,parseTrainerClassNames,fallbackForKnownProfile,getTrainerParty};
