'use strict';
// Descoberta de variantes de Pokémon Gen I diretamente do binário ROM.
// Só leitura local. Offsets encontrados e validados por estrutura, nunca fixos.
const fs=require('node:fs'), crypto=require('node:crypto'), path=require('node:path');
const {inspectWorld}=require('./romWorldData');
const {parseTrainerParties}=require('./romTrainerParties');
const {extractHiddenItemsFromRom}=require('./romHiddenEvents');
const {spritePngBase64}=require('./romSpriteDecoder');
const {findGen1MoveTable}=require('./romMoveTable');
const {findGen1TypeMatchups}=require('./romTypeMatchups');
const {inspectCatchRamLayout}=require('./romCaptureLayout');
const {readRomBattleRuleTables}=require('./romBattleRuleTables');
const BANK=0x4000, INTERNAL=190;
const crcTable=Array.from({length:256},(_,n)=>{let v=n;for(let i=0;i<8;i++)v=(v&1)?(0xEDB88320^(v>>>1)):(v>>>1);return v>>>0;});
function crc32(buf){let x=0xFFFFFFFF;for(const b of buf)x=crcTable[(x^b)&255]^(x>>>8);return ((x^0xFFFFFFFF)>>>0).toString(16).toUpperCase().padStart(8,'0');}
function addresses(p){return p===null?null:{fileOffset:p,bank:Math.floor(p/BANK),cpuAddress:p<BANK?p:0x4000+p%BANK};}
function findAll(buf,needle){let out=[];for(let p=0;(p=buf.indexOf(needle,p))!==-1;p++)out.push(p);return out;}
function encode(s){return Buffer.from([...s].map(c=>c.charCodeAt(0)-65+0x80));}
function decode(bytes){
 let str='',ended=false;
 for(const n of bytes){
  if(n===0x50){ended=true;break;}
  if(n>=0x80&&n<=0x99)str+=String.fromCharCode(n-0x80+65);
  else if(n>=0xA0&&n<=0xB9)str+=String.fromCharCode(n-0xA0+97);
  else if(n===0x7F)str+=' ';
  else if(n===0xE0)str+="'";
  else if(n===0xE3)str+='-';
  else if(n===0xE8)str+='.';
  else if(n===0xEF)str+='♂';
  else if(n===0xF5)str+='♀';
  else return null;
 }
 return ended||str.length===bytes.length?str:null;
}
function findNames(b){
 const seed=Buffer.concat([encode('RHYDON'),Buffer.alloc(4,0x50),encode('KANGASKHAN')]);
 const matches=findAll(b,seed).filter(p=>{
  if(p+INTERNAL*10>b.length||Math.floor(p/BANK)!==Math.floor((p+INTERNAL*10-1)/BANK))return false;
  const names=Array.from({length:INTERNAL},(_,i)=>decode(b.subarray(p+i*10,p+i*10+10)));
  return names.every(Boolean)&&names[0]==='RHYDON'&&names[1]==='KANGASKHAN'&&names[2].startsWith('NIDORAN')&&names.includes('PIKACHU')&&names.includes('MEW');
 });
 return matches.length===1?matches[0]:null;
}
function findDex(b){
 const matches=findAll(b,Buffer.from([112,115,32,35,21,100,34,80,2])).filter(p=>{
  if(p+INTERNAL>b.length)return false;
  const cnt=new Uint8Array(152);
  for(let i=0;i<INTERNAL;i++){const n=b[p+i];if(n>151)return false;if(n&&++cnt[n]>1)return false;}
  return cnt.slice(1).every(n=>n===1);
 });
 return matches.length===1?matches[0]:null;
}
function findStats(b){
 const matches=[];
 for(let p=0;p+150*28<=b.length;p++){
  if(b[p]!==1||b[p+28]!==2||b[p+56]!==3||b[p+84]!==4)continue;
  if(Math.floor(p/BANK)!==Math.floor((p+150*28-1)/BANK))continue;
  let ok=true;for(let i=0;i<150;i++){const k=p+i*28;if(b[k]!==i+1||!b[k+1]||!b[k+2]||!b[k+3]||!b[k+4]||!b[k+5]){ok=false;break;}}
  if(ok)matches.push(p);
 }
 return matches.length===1?matches[0]:null;
}
function findGrowth(b){
 const data=Buffer.from([0x11,0,0,0,0x34,10,0,30,0x34,20,0,70,0x65,0x8F,100,140,0x45,0,0,0,0x54,0,0,0]);
 const matches=findAll(b,data);return matches.length===1?matches[0]:null;
}
function evoRows(b,p,bank){
 const out=[],end=(bank+1)*BANK;
 for(let id=0;id<INTERNAL;id++){
  const a=b.readUInt16LE(p+id*2);if(a<0x4000||a>=0x8000)return null;
  let q=bank*BANK+a-0x4000;if(q>=b.length||q>=end)return null;
  const evolutions=[],learnset=[];let ended=false;
  for(let j=0;j<10;j++){
   if(q>=end)return null;const method=b[q++];
   if(!method){ended=true;break;}
   const size=method===2?3:(method===1||method===3?2:0);
   if(!size||q+size>end)return null;
   evolutions.push({method,args:[...b.subarray(q,q+size)]});q+=size;
  }
  if(!ended)return null;ended=false;
  for(let j=0;j<100;j++){
   if(q>=end)return null;const level=b[q++];
   if(!level){ended=true;break;}
   if(level>100||q>=end||!b[q])return null;
   learnset.push({level,moveId:b[q++]});
  }
  if(!ended)return null;
  out.push({internalId:id+1,evolutions,learnset});
 }
 return out;
}
function findEvos(b,statsOffset){
 if(statsOffset===null)return {offset:null,rows:null};
 const bank=Math.floor(statsOffset/BANK),end=(bank+1)*BANK;
 const out=[];
 for(let p=bank*BANK;p+INTERNAL*2<=end;p++){
  if(b[p+1]<0x40||b[p+1]>=0x80||b[p+3]<0x40||b[p+3]>=0x80)continue;
  const first=b.readUInt16LE(p),second=b.readUInt16LE(p+2);
  if(first>second||second-first>160)continue;
  const rows=evoRows(b,p,bank);
  if(rows&&rows.some(x=>x.learnset.length>3))out.push({offset:p,rows});
 }
 return out.length===1?out[0]:{offset:null,rows:null};
}
function findMoveNames(b){
 const found=[];
 for(const p of findAll(b,Buffer.from([...encode('POUND'),0x50]))){
  let q=p,names=[];
  for(let i=0;i<165;i++){
   const end=b.indexOf(0x50,q);
   if(end<0||end===q||end-q>16||Math.floor(end/BANK)!==Math.floor(q/BANK)){names=null;break;}
   names.push(decode(b.subarray(q,end)));q=end+1;
  }
  if(names&&names[0]==='POUND'&&names[1]==='KARATE CHOP')found.push({offset:p,names});
 }
 return found.length===1?found[0]:{offset:null,names:null};
}
function spritePointersFromRom(b,stats,dimsByte){
  if(!stats||!Number.isInteger(dimsByte)||![0x55,0x66,0x77].includes(dimsByte))return null;
  const frontCpu=stats.frontSpritePointer,backCpu=stats.backSpritePointer;
  if(!Number.isInteger(frontCpu)||!Number.isInteger(backCpu)||
     frontCpu<0x4000||frontCpu>=0x8000||backCpu<0x4000||backCpu>=0x8000)return null;
  const candidates=[];
  for(let bank=1;bank<b.length/BANK;bank++){
    const front=bank*BANK+frontCpu-0x4000,back=bank*BANK+backCpu-0x4000;
    // Comprimidos Gen I: frente inicia com dimensões 5x5/6x6/7x7;
    // costas usa 0x44 (4x4). Exigir AMBOS no mesmo banco.
    if(b[front]===dimsByte && b[back]===0x44)candidates.push(bank);
  }
  if(candidates.length!==1)return {
    verified:false,candidateBanks:candidates,reason:'Banco de sprites não identificado de forma única'
  };
  const bank=candidates[0];
  const frontOffset=bank*BANK+frontCpu-0x4000,backOffset=bank*BANK+backCpu-0x4000;
  const result={verified:true,source:'ROM: 2 ponteiros + 2 cabeçalhos comprimidos compatíveis',
    bank,dimensionsByte:dimsByte,front:{cpuPointer:frontCpu,fileOffset:frontOffset},
    back:{cpuPointer:backCpu,fileOffset:backOffset},
    compressed:true,pixelsDecoded:false,paletteSource:'GEN1_4_SHADES_NEUTRAL (SGB/SameBoy recoloring not captured)'};
  try {
    result.frontPngBase64=spritePngBase64(b,frontOffset,dimsByte);
    result.backPngBase64=spritePngBase64(b,backOffset,0x44);
    result.pixelsDecoded=true;
    result.spritePngSource='BYTES_DESCOMPRIMIDOS_DA_ROM';
  }catch(err){
    result.pixelsDecoded=false;
    result.spriteDecodeError=err.message;
  }
  return result;
}
function inspectRom(file){
 const b=fs.readFileSync(file);
 if(b.length<0x150||b.length%BANK)throw Error('ROM sem bancos Game Boy completos');
 let h=0;for(let i=0x134;i<=0x14c;i++)h=(h-b[i]-1)&255;
 if(h!==b[0x14d])throw Error('Checksum do cabeçalho inválido');
 const offsets={names:findNames(b),dexOrder:findDex(b),baseStats:findStats(b),growthRates:findGrowth(b)};
 const evos=findEvos(b,offsets.baseStats),moves=findMoveNames(b);
 const romMoves=findGen1MoveTable(b);
 const types=findGen1TypeMatchups(b);
 const battleCaptureLayout=inspectCatchRamLayout(b);
 const battleRuleTables=readRomBattleRuleTables(b);
 offsets.evolutions=evos.offset;offsets.moveNames=moves.offset;
 offsets.moveData=romMoves.valid?romMoves.offset:null;
 offsets.typeMatchups=types.verified?types.offset:null;
 const growthRates=offsets.growthRates===null?null:Array.from({length:6},(_,id)=>{
  const q=offsets.growthRates+id*4,first=b[q],quad=b[q+1];
  return {id,numerator:first>>4,denominator:first&15,
    squaredCoefficient:quad&0x80?-(quad&0x7f):(quad&0x7f),
    linearCoefficient:b[q+2],constantToSubtract:b[q+3],
    origin:'ROM: GrowthRateTable (4 bytes por grupo)'};
 });
 const world=inspectWorld(b);
 const trainerParties=parseTrainerParties(b);
 world.hiddenItemScripts=extractHiddenItemsFromRom(b);
 const species=[],hasCore=offsets.names!==null&&offsets.dexOrder!==null&&offsets.baseStats!==null;
 if(hasCore)for(let id=1;id<=INTERNAL;id++){
  const dex=b[offsets.dexOrder+id-1],name=decode(b.subarray(offsets.names+(id-1)*10,offsets.names+id*10));
  let stats=null;
  if(dex>0&&dex<=150){
   const p=offsets.baseStats+(dex-1)*28;
   // Os 7 bytes p+20..p+26 codificam 50 TMs + 5 HMs (bit 0 é TM01).
   const machineBytes=[...b.subarray(p+20,p+27)];
   const machines=Array.from({length:55},(_,i)=>i+1).filter(n=>
     !!(machineBytes[(n-1)>>3] & (1<<((n-1)&7))));
   stats={baseHp:b[p+1],attack:b[p+2],defense:b[p+3],speed:b[p+4],special:b[p+5],typeIds:[b[p+6],b[p+7]],catchRate:b[p+8],baseExp:b[p+9],frontSpritePointer:b.readUInt16LE(p+11),backSpritePointer:b.readUInt16LE(p+13),growthRateId:b[p+19],
    tmHm:{source:'ROM_BASESTATS_BITS_VERIFICADOS',rawHex:Buffer.from(machineBytes).toString('hex'),
      tmNumbers:machines.filter(n=>n<=50),hmNumbers:machines.filter(n=>n>50).map(n=>n-50)}};
  }
  const sprite=stats ? spritePointersFromRom(b,stats,
    b[offsets.baseStats+(dex-1)*28+10]) : null;
  species.push({internalId:id,name,dex,stats,sprite,
    evolutions:evos.rows?evos.rows[id-1].evolutions:null,
    learnset:evos.rows?evos.rows[id-1].learnset:null});
 }
 const title=b.subarray(0x134,0x144).toString('latin1').split('\0')[0].trim();
 return {schema:'gen1-rom-profile-v1',source:'local-ROM-file',file:path.basename(file),
  hash:{sha256:crypto.createHash('sha256').update(b).digest('hex'),crc32:crc32(b)},
  title,bytes:b.length,banks:b.length/BANK,bytesRead:b.length,
  offsets:Object.fromEntries(Object.entries(offsets).map(([name,p])=>[name,addresses(p)])),
  validated:Object.fromEntries(Object.entries(offsets).map(([name,p])=>[name,p!==null])),
  species,moveNames:moves.names,moveStats:romMoves.valid?romMoves.rows:null,
  typeMatchups:types.verified?types.orderedTypeRulesFromRom:null,
  typeMatchupsStatus:{verified:types.verified,
    source:types.source||null,count:types.verified?types.recordCount:0,
    bank:types.verified?types.bank:null,reason:types.reason||null},
  moveStatsStatus:{verified:romMoves.valid,source:romMoves.source||null,
    reason:romMoves.reason||null,totalRomMoves:romMoves.valid?romMoves.rows.length:0},
  growthRates,world,trainerParties,battleCaptureLayout,battleRuleTables,
  spritesVerified:species.filter(x=>x.sprite?.verified).length,
  spritesTotalInBaseStats:species.filter(x=>x.stats).length,
  spritesWithPixelsDecoded:species.filter(x=>x.sprite?.pixelsDecoded).length,
  unknownLayout:!hasCore,semanticCoveragePercent:null,
  identityMatchedWithRuntime:false};
}
function runtimeMatches(profile,status){
 const m=String(status||'').match(/\bcrc32=([0-9a-f]{8})\b/i);
 return !!(profile&&m&&m[1].toUpperCase()===profile.hash.crc32);
}
module.exports={inspectRom,runtimeMatches,crc32,spritePointersFromRom};
if(require.main===module)try{
 if(!process.argv[2])throw Error('Uso: node romVariantRegistry.js "caminho\\jogo.gb"');
 const p=inspectRom(process.argv[2]);
 console.log(JSON.stringify({...p,species:p.species.slice(0,10),totalSpecies:p.species.length,totalMoveNames:p.moveNames?.length},null,2));
}catch(e){console.error(e.message);process.exitCode=1;}