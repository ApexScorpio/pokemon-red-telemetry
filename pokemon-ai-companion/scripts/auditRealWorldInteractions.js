'use strict';
// Strict read-only ROM-world audit. No ROM bytes or saves are published.
const fs=require('node:fs');
const crypto=require('node:crypto');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const BANK=0x4000,MAPS=248;
const dims=[[9,10],[18,20],[18,20],[18,20],[9,10],[18,20],[18,25],
  [18,20],[9,10],[9,10],[18,20]];
const expected={maps:226,warps:813,signs:202,npc:472,trainer:334,
  item:106,wildPokemon:12,invalidCoordinates:0,bankTableOffset:49725};
const addr=(bank,cpu,size)=>bank>0&&cpu>=0x4000&&cpu<0x8000&&
  bank*BANK+cpu-0x4000<size?bank*BANK+cpu-0x4000:null;
const u16=(b,p)=>b[p]|b[p+1]<<8;
const invariant=(cond,reason)=>{if(!cond)throw Error(reason);};
function readMap(b,bank,cpu){
  const p=addr(bank,cpu,b.length),end=(bank+1)*BANK;
  if(p===null||p+12>end)return null;
  const tileset=b[p],height=b[p+1],width=b[p+2],connections=b[p+9];
  if(tileset>24||height<1||height>80||width<1||width>80||connections>15)
    return null;
  let connectionsCount=0;
  for(let bit=0;bit<4;bit++)connectionsCount+=(connections>>bit)&1;
  const ptrAt=p+10+connectionsCount*11;
  if(ptrAt+2>end)return null;
  const blockAt=addr(bank,u16(b,p+3),b.length);
  if(blockAt===null||blockAt+height*width>end)return null;
  let q=addr(bank,u16(b,ptrAt),b.length);
  if(q===null||q+2>=end)return null;
  q++;const warps=b[q++];
  if(warps>64||q+4*warps>=end)return null;
  q+=4*warps;
  const signCount=b[q++];
  if(signCount>40||q+3*signCount>=end)return null;
  let invalidCoordinates=0;
  for(let i=0;i<signCount;i++){
    const y=b[q++],x=b[q++];q++;
    if(x>255||y>255)invalidCoordinates++;
  }
  const actorCount=b[q++];if(actorCount>48)return null;
  const counts={npc:0,trainer:0,item:0,wildPokemon:0};
  for(let i=0;i<actorCount;i++){
    if(q+6>end)return null;
    const y=b[q+1]-4,x=b[q+2]-4,textId=b[q+5];q+=6;
    const extra=(textId&0x40)?2:(textId&0x80)?1:0;
    if(q+extra>end)return null;
    const meta=extra?b[q]:null;q+=extra;
    const type=(textId&0x40)?
      (meta>=1&&meta<=190?'wildPokemon':'trainer'):
      (textId&0x80?'item':'npc');
    counts[type]++;
    if((type==='npc'||type==='item')&&
       (x<0||x>255||y<0||y>255))invalidCoordinates++;
  }
  return {warps,signs:signCount,invalidCoordinates,...counts};
}
function auditWorldObjects(rom){
  invariant(Buffer.isBuffer(rom)&&rom.length===1048576,'ROM não tem exatamente 1 MiB');
  const sha256=crypto.createHash('sha256').update(rom).digest('hex');
  invariant(Object.values(AUDITED_ROM_SHA256).includes(sha256),
    'SHA-256 não pertence às três ROMs auditadas');
  const pointers=Array.from({length:MAPS},(_,i)=>u16(rom,0x1ae+2*i));
  invariant(pointers.every(x=>x>=0x4000&&x<0x8000),'Map pointers inválidos');
  const matches=[];
  for(let pos=BANK;pos+MAPS<rom.length;pos++){
    let matchesDims=true;
    for(let i=0;i<dims.length;i++){
      const p=addr(rom[pos+i],pointers[i],rom.length);
      if(p===null||rom[p+1]!==dims[i][0]||rom[p+2]!==dims[i][1]){
        matchesDims=false;break;
      }
    }
    if(matchesDims)matches.push(pos);
  }
  invariant(matches.length===1,'Tabela de bancos de mapas não única');
  const counts={maps:0,warps:0,signs:0,npc:0,trainer:0,
    item:0,wildPokemon:0,invalidCoordinates:0,bankTableOffset:matches[0]};
  for(let id=0;id<MAPS;id++){
    const map=readMap(rom,rom[matches[0]+id],pointers[id]);
    if(!map)continue;
    counts.maps++;
    for(const key of ['warps','signs','npc','trainer','item',
      'wildPokemon','invalidCoordinates'])counts[key]+=map[key];
  }
  for(const [name,value] of Object.entries(expected))
    invariant(counts[name]===value,
      name+' não corresponde aos três arquivos auditados: '+counts[name]+' != '+value);
  return {verified:true,sha256,counts,source:'FULL_ROM_BYTES_MAP_HEADERS_AND_OBJECTS',
    liveEmulatorVerified:false,scriptEffectsVerified:false};
}
function main(paths){
  invariant(paths.length===3,'Fornece exatamente 3 caminhos: Red, Blue e Green');
  const seen=new Set(),results=[];
  for(const path of paths){
    const r=auditWorldObjects(fs.readFileSync(path));
    invariant(!seen.has(r.sha256),'ROM duplicada em vez das três variantes');
    seen.add(r.sha256);results.push(r);
  }
  invariant(seen.size===3,'Não foram fornecidas três variantes únicas');
  return {verified:true,roms:results};
}
if(require.main===module){
  try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2));}
  catch(error){console.error('AUDITORIA_ROM_FALHOU: '+error.message);process.exitCode=1;}
}
module.exports={auditWorldObjects,main,expected};
