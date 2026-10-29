'use strict';
// Read-only Gen I text table pointer audit. A resolved pointer is NOT a decoded script.
const fs=require('node:fs');
const {auditWorldObjects}=require('./auditRealWorldInteractions');
const BANK=0x4000,MAPS=248;
const expected={interactions:674,npcs:472,signs:202,resolved:674,unresolved:0,
  rom0:58,romx:616,
  firstBytes:{'08':177,'17':453,'f5':3,'f6':12,'f7':3,'fe':14,'ff':12}};
const valid=(bank,cpu,size)=>bank>0&&cpu>=0x4000&&cpu<0x8000&&
  bank*BANK+cpu-0x4000<size?bank*BANK+cpu-0x4000:null;
const u16=(b,p)=>b[p]|b[p+1]<<8;
// Text tables can legally point to the fixed bank ROM0 ($0001..$3fff).
// Ordinary map headers and their tables still live in switched ROMX.
const textTarget=(bank,cpu,size)=>cpu>0&&cpu<0x4000?cpu:valid(bank,cpu,size);
function auditTextPointers(rom){
  const world=auditWorldObjects(rom),bankTable=world.counts.bankTableOffset;
  const counts={interactions:0,npcs:0,signs:0,resolved:0,unresolved:0,rom0:0,romx:0};
  const firstBytes={},unresolvedByMap=[],sourceSamples=[];
  const far={total:0,resolved:0,startText:0,invalid:0};
  for(let mapId=0;mapId<MAPS;mapId++){
    const bank=rom[bankTable+mapId],h=valid(bank,u16(rom,0x1ae+mapId*2),rom.length);
    if(h===null||rom[h]>24||rom[h+1]<1||rom[h+1]>80||
       rom[h+2]<1||rom[h+2]>80||rom[h+9]>15)continue;
    let conn=0;for(let bit=0;bit<4;bit++)conn+=(rom[h+9]>>bit)&1;
    const end=(bank+1)*BANK,ptrAt=h+10+11*conn;
    if(ptrAt+2>end)continue;
    const textTable=valid(bank,u16(rom,h+5),rom.length);
    let p=valid(bank,u16(rom,ptrAt),rom.length);
    if(p===null||p+2>=end)continue;
    p++;const warps=rom[p++];if(warps>64||p+4*warps>=end)continue;
    p+=4*warps;const signs=rom[p++];
    if(signs>40||p+3*signs>=end)continue;
    const entries=[];
    for(let i=0;i<signs;i++){
      const y=rom[p++],x=rom[p++],textId=rom[p++];
      entries.push({kind:'sign',ordinal:i+1,x,y,textId,index:textId});
    }
    const actors=rom[p++];if(actors>48)continue;
    for(let i=0;i<actors;i++){
      if(p+6>end)break;
      const y=rom[p+1]-4,x=rom[p+2]-4,textId=rom[p+5];p+=6;
      const extra=textId&0x40?2:textId&0x80?1:0;
      if(p+extra>end)break;p+=extra;
      if(!(textId&0xc0))entries.push({kind:'npc',ordinal:i+1,x,y,
        textId,index:textId&0x3f});
    }
    for(const e of entries){
      counts.interactions++;counts[e.kind==='npc'?'npcs':'signs']++;
      let dest=null;
      if(e.index>=1&&e.index<=63&&textTable!==null&&
         textTable+(e.index-1)*2+1<end){
        dest=textTarget(bank,u16(rom,textTable+(e.index-1)*2),rom.length);
        if(dest!==null&&dest>=end)dest=null;
      }
      if(dest===null){
        counts.unresolved++;
        unresolvedByMap.push({mapId,kind:e.kind,ordinal:e.ordinal,
          textId:e.textId,reason:'SAME_BANK_TEXT_POINTER_NOT_CORROBORATED'});
      }else{
        counts.resolved++;counts[dest<BANK?'rom0':'romx']++;
        const code=rom[dest].toString(16).padStart(2,'0');
        firstBytes[code]=(firstBytes[code]||0)+1;
        // pret/pokered TX_FAR ($17): [opcode, CPU low, CPU high, bank].
        // A far target validates a text start, never the dialogue outcome.
        if(code==='17'){
          far.total++;
          const target=dest+4<=(bank+1)*BANK?
            valid(rom[dest+3],u16(rom,dest+1),rom.length):null;
          if(target===null)far.invalid++;
          else{far.resolved++;if(rom[target]===0x00)far.startText++;}
        }
        if(sourceSamples.length<8)sourceSamples.push({mapId,kind:e.kind,
          ordinal:e.ordinal,x:e.x,y:e.y,textId:e.textId,
          entryBank:bank,entryFileOffset:dest,firstByteHex:code});
      }
    }
  }
  for(const [name,count] of Object.entries(expected)){
    if(name==='firstBytes')continue;
    if(counts[name]!==count)throw Error('Contagem de texto '+name+
      ' divergente: '+counts[name]+' != '+count);
  }
  for(const [code,count] of Object.entries(expected.firstBytes))
    if(firstBytes[code]!==count)throw Error('Byte inicial de texto '+code+
      ' divergente: '+firstBytes[code]+' != '+count);
  if(Object.keys(firstBytes).length!==Object.keys(expected.firstBytes).length)
    throw Error('Categorias desconhecidas de bytes iniciais de texto');
  if(far.total!==453||far.resolved!==453||far.startText!==453||far.invalid!==0)
    throw Error('Destino far text de TX_FAR não corroborado na ROM');
  return {verified:true,romSha256:world.sha256,counts,firstBytes,far,
    unresolvedExamples:unresolvedByMap.slice(0,6),sourceSamples,
    staticTextPointerVerified:counts.resolved,
    dialogueEffectsVerified:false,liveInteractionVerified:false,
    note:'Ponteiro de texto válido não implica diálogo executado, conteúdo interpretado ou consequência confirmada.'};
}
function main(paths){
  if(paths.length!==3)throw Error('São necessários três caminhos de ROM');
  const seen=new Set(),results=[];
  for(const path of paths){const r=auditTextPointers(fs.readFileSync(path));
    if(seen.has(r.romSha256))throw Error('ROM repetida');
    seen.add(r.romSha256);results.push(r);
  }
  return {verified:true,variants:results};
}
if(require.main===module){
  try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2));}
  catch(e){console.error('TEXTO_ROM_FALHOU: '+e.message);process.exitCode=1;}
}
module.exports={auditTextPointers,expected,main};
