'use strict';
// Extrai mapas e encontros da ROM real. Nunca inventa offsets nem altera ficheiros.
// Motor Gen I: WildDataPointers, MapHeaderPointers, MapHeaderBanks, object events.
const crypto=require('node:crypto');
const {findGen1EncounterWeights}=require('./romEncounterWeights');
const BANK_SIZE=16384, MAPS=248;
function u16(b,p){return b[p]|(b[p+1]<<8);}
function romAddress(bank,cpu,bytes){return bank>0&&cpu>=0x4000&&cpu<0x8000
    ? bank*BANK_SIZE+cpu-0x4000<bytes?bank*BANK_SIZE+cpu-0x4000:null:null;}
function bankLocation(pos){return pos===null?null:{
  fileOffset:pos,bank:Math.floor(pos/BANK_SIZE),
  cpuAddress:pos<BANK_SIZE?pos:0x4000+pos%BANK_SIZE};}
function readEncounter(b,bank,pointer,validatedWeights){
 const weights=validatedWeights||findGen1EncounterWeights(b).weights;
 const p=romAddress(bank,pointer,b.length),end=(bank+1)*BANK_SIZE;
 if(p===null||!Array.isArray(weights)||weights.length!==10)return null;
 let q=p;const out={pointerCpu:pointer};
 for(const kind of ['grass','water']){
  if(q>=end)return null;
  const rate=b[q++];
  const slots=[];
  if(rate){
   if(q+20>end)return null;
   for(let i=0;i<10;i++){
    const level=b[q++],speciesId=b[q++];
    if(level<1||level>100||speciesId<1||speciesId>190)return null;
    slots.push({slot:i,level,internalId:speciesId,rollWeight:weights[i],rollOutOf:256});
   }
  }
  out[kind]={rateByte:rate,slots};
 }
 return out;
}
function findWildData(b){
 const rngTable=findGen1EncounterWeights(b);
 if(!rngTable.verified)return {valid:false,reason:'Limiar dos slots não validado nesta ROM: '+rngTable.reason};
 const countBanks=b.length/BANK_SIZE;
 const matches=[];
 for(let bank=1;bank<countBanks;bank++){
  const start=bank*BANK_SIZE,end=start+BANK_SIZE-MAPS*2-2;
  for(let pos=start;pos<end;pos++){
   const ptr=u16(b,pos);
   if(ptr<0x4000||ptr>=0x8000)continue;
   if(b[pos+MAPS*2]!==0xFF||b[pos+MAPS*2+1]!==0xFF)continue;
   if(b[pos+MAPS*2+2]!==0||b[pos+MAPS*2+3]!==0)continue;
   let prefix=true;
   for(let i=1;i<12;i++)if(u16(b,pos+2*i)!==ptr){prefix=false;break;}
   if(!prefix)continue;
   const pointers=[];
   for(let i=0;i<MAPS;i++)pointers.push(u16(b,pos+i*2));
   if(pointers.some(x=>x<0x4000||x>=0x8000))continue;
   const unique=[...new Set(pointers)];
   if(unique.length<25||unique.length>125)continue;
   let valid=true;
   for(const cpu of unique){if(!readEncounter(b,bank,cpu,rngTable.weights)){valid=false;break;}}
   if(!valid)continue;
   const route1=readEncounter(b,bank,pointers[12],rngTable.weights);
   if(!route1?.grass?.slots.length)continue;
   matches.push({offset:pos,bank,pointers});
  }
 }
 if(matches.length!==1)return {valid:false,reason:'Nenhuma tabela única de 248 ponteiros de encontros validada',candidates:matches.length};
 const m=matches[0],data=m.pointers.map((cpu,mapId)=>{
   const item=readEncounter(b,m.bank,cpu,rngTable.weights);
   return {mapId,...item};
 });
 return {valid:true,pointerTable:bankLocation(m.offset),
   slotWeightsFromRom:{offset:rngTable.offset,bank:rngTable.bank,
     weights:rngTable.weights,thresholdsInclusive:rngTable.thresholdsInclusive,
     rawHex:rngTable.rawHex,source:rngTable.source},
   uniqueDataRecords:new Set(m.pointers).size,totalMapIds:MAPS,
   source:'ROM: WildDataPointers → grass/water (gen1)',
   data};
}
function readMapObject(b,bank,objPtr,height,width){
 let q=romAddress(bank,objPtr,b.length),end=(bank+1)*BANK_SIZE;
 if(q===null||q+2>=end)return null;
 const borderBlock=b[q++],warps=[],signs=[],objects=[];
 const nWarp=b[q++];if(nWarp>64||q+4*nWarp>=end)return null;
 for(let i=0;i<nWarp;i++){
  const y=b[q++],x=b[q++],destinationWarp=b[q++],destinationMap=b[q++];
  warps.push({y,x,destinationWarp,destinationMap});
 }
 const nSigns=b[q++];if(nSigns>40||q+3*nSigns>=end)return null;
 for(let i=0;i<nSigns;i++)signs.push({y:b[q++],x:b[q++],textId:b[q++]});
 const nObjects=b[q++];if(nObjects>48)return null;
 for(let i=0;i<nObjects;i++){
  if(q+6>end)return null;
  const spriteId=b[q++],y=b[q++]-4,x=b[q++]-4;
  const movement=b[q++],directionOrRange=b[q++],textId=b[q++];
  // No esquema Gen I, OPP_ID_OFFSET=200 para classes de treinadores;
  // um ID de espécie 1..190 é um Pokémon selvagem de encontro fixo.
  const battle=(textId&0x40)!==0;
  const extra=battle?2:(textId&0x80)?1:0;
  if(q+extra>end)return null;
  const meta=[...b.subarray(q,q+extra)];q+=extra;
  const kind=battle ? ((meta[0]>=1&&meta[0]<=190)?'wildPokemon':'trainer') :
    (textId&0x80)?'item':'npc';
  objects.push({spriteId,y,x,movement,directionOrRange,kind,textId,
    trainerClassOrItemId:meta[0]??null,trainerNumberOrLevel:meta[1]??null,
    wildSpeciesInternalId:kind==='wildPokemon'?meta[0]:null,
    wildLevel:kind==='wildPokemon'?meta[1]:null});
 }
 return {borderBlock,warps,signs,objects,source:'ROM: map object binary format',
   rawEndOffset:q};
}

function extractTrainerEventPointers(b,map){
 const bank=map.mapBank,end=Math.min(b.length,(bank+1)*BANK_SIZE);
 const objects=map.objects?.objects,base=romAddress(bank,map.textPointerCpu,b.length);
 if(!Array.isArray(objects)||base===null)return [];
 const bindings=[];
 for(let i=0;i<objects.length;i++){
  const o=objects[i];if(o.kind!=='trainer')continue;
  const ix=o.textId&0x3F;
  if(ix<1||ix>63||base+(ix-1)*2+1>=end)continue;
  const textPtr=u16(b,base+(ix-1)*2);
  const p=romAddress(bank,textPtr,b.length);
  if(p===null||p+11>=end||b[p]!==0x08||b[p+1]!==0x21)continue;
  const hdrCpu=u16(b,p+2);
  let q=p+4;
  if(b[q]===0x18){const delta=(b[q+1]<<24)>>24;q+=2+delta;}
  if(q<bank*BANK_SIZE||q+6>=end||b[q]!==0xCD||b[q+3]!==0xC3)continue;
  const fn=u16(b,q+1),terminal=u16(b,q+4);
  if(fn<=0x3000||fn>=0x3400||terminal<=0x2300||terminal>=0x2700)continue;
  const h=romAddress(bank,hdrCpu,b.length);
  if(h===null||h+12>=end)continue;
  const bit=b[h],distance=b[h+1],ram=u16(b,h+2);
  if(bit>15||distance>0xA0||(distance&15)!==0||ram<0xD747||ram>=0xD887)continue;
  if(Array.from({length:4},(_,z)=>u16(b,h+4+2*z)).some(ptr=>ptr<0x4000||ptr>=0x8000))continue;
  bindings.push({objectOrdinal:i+1,eventBitIndex:(ram-0xD747)*8+bit,
    trainerHeaderCpu:hdrCpu,source:'ROM_OBJECT_TEXT_SCRIPT_TO_TRAINER_HEADER'});
 }
 return bindings;
}

function extractStaticEncounterEventPointers(b,map){
 const bank=map.mapBank,end=Math.min(b.length,(bank+1)*BANK_SIZE);
 const objects=map.objects?.objects,textBase=romAddress(bank,map.textPointerCpu,b.length);
 if(!Array.isArray(objects)||textBase===null)return [];
 const entries=[];
 for(let i=0;i<objects.length;i++){
  const actor=objects[i];
  if(actor.kind!=='wildPokemon'||!Number.isInteger(actor.wildLevel)||
     actor.wildLevel<1||actor.wildLevel>100)continue;
  const index=actor.textId&0x3f;
  if(index<1||index>63||textBase+(index-1)*2+1>=end)continue;
  const text=romAddress(bank,u16(b,textBase+(index-1)*2),b.length);
  if(text===null||text+7>=end||b[text]!==0x08||b[text+1]!==0x21)continue;
  const headerCpu=u16(b,text+2),header=romAddress(bank,headerCpu,b.length);
  if(header===null||header+12>end)continue;
  const bit=b[header],distance=b[header+1],ptr=u16(b,header+2);
  if(bit>15||distance!==0||ptr<0xD747||ptr>=0xD887||
     Array.from({length:4},(_,j)=>u16(b,header+4+2*j))
       .some(cpu=>cpu<0x4000||cpu>=0x8000))continue;
  entries.push({objectOrdinal:i+1,eventBitIndex:(ptr-0xD747)*8+bit,
    speciesInternalId:actor.wildSpeciesInternalId,level:actor.wildLevel,
    trainerHeaderCpu:headerCpu,
    source:'ROM_OBJECT_TEXT_ASM_TO_STATIONARY_POKEMON_HEADER'});
 }
 return entries;
}

function getMapHeader(b,bank,cpu){
 const p=romAddress(bank,cpu,b.length);
 if(p===null||p+12>(bank+1)*BANK_SIZE)return null;
 const tilesetId=b[p],height=b[p+1],width=b[p+2],connections=b[p+9];
 if(tilesetId>24||height<1||height>80||width<1||width>80||connections>15)return null;
 const connCount=connections.toString(2).replace(/0/g,'').length;
 const objPtrAt=p+10+connCount*11;
 if(objPtrAt+2>(bank+1)*BANK_SIZE)return null;
 const blocksPtr=u16(b,p+3),textPtr=u16(b,p+5),scriptPtr=u16(b,p+7),objPtr=u16(b,objPtrAt);
 const blockAt=romAddress(bank,blocksPtr,b.length);
 if(blockAt===null||blockAt+height*width>(bank+1)*BANK_SIZE)return null;
 const objects=readMapObject(b,bank,objPtr,height,width);
 if(!objects)return null;
 const blocks=b.subarray(blockAt,blockAt+width*height);
 return {valid:true,tilesetId,heightBlocks:height,widthBlocks:width,
   heightTiles:height*2,widthTiles:width*2,
   mapHeaderPointerCpu:cpu,mapBank:bank,blocksPointerCpu:blocksPtr,
   objectPointerCpu:objPtr,textPointerCpu:textPtr,scriptPointerCpu:scriptPtr,
   connectionFlags:connections,
   blockDataBase64:blocks.toString('base64'),
   blockBytes:blocks.length,
   blockSha256:crypto.createHash('sha256').update(blocks).digest('hex'),
   objects};
}
function findMapHeaders(b){
 // Posição histórica da tabela de ponteiros na ROM bank0; SEM confiança
 // até os cabeçalhos e a tabela de bancos coincidirem estruturalmente.
 const p=0x1AE;
 if(b.length<BANK_SIZE*2||p+MAPS*2>BANK_SIZE)return {valid:false};
 const pointers=Array.from({length:MAPS},(_,i)=>u16(b,p+i*2));
 if(pointers.some(x=>x<0x4000||x>=0x8000))return {valid:false,reason:'ponteiros da home bank incompatíveis'};
 const dims=[[9,10],[18,20],[18,20],[18,20],[9,10],[18,20],[18,25],
   [18,20],[9,10],[9,10],[18,20]];
 const hits=[];
 for(let pos=BANK_SIZE;pos+MAPS<b.length;pos++){
  if(b[pos]>b.length/BANK_SIZE||b[pos+1]>b.length/BANK_SIZE)continue;
  let fits=true;
  for(let i=0;i<dims.length;i++){
   const bank=b[pos+i],addr=romAddress(bank,pointers[i],b.length);
   if(addr===null||b[addr+1]!==dims[i][0]||b[addr+2]!==dims[i][1]){fits=false;break;}
  }
  if(!fits)continue;
  hits.push(pos);
 }
 if(hits.length!==1)return {valid:false,reason:'Tabela de bancos de mapas não encontrada de forma única',candidates:hits.length};
 const bankPos=hits[0];
 const data=pointers.map((cpu,mapId)=>{
  const bank=b[bankPos+mapId],h=getMapHeader(b,bank,cpu);
  if(h?.valid){
    h.trainerEvents=extractTrainerEventPointers(b,h);
    h.staticEncounterEvents=extractStaticEncounterEventPointers(b,h);
  }
  return {mapId,valid:!!h,...(h||{invalidReason:'Cabeçalho não corresponde à estrutura Gen I'})};
 });
 const validCount=data.filter(x=>x.valid).length;
 return {valid:validCount>=200,source:'ROM: MapHeaderPointers + MapHeaderBanks',
   pointerTable:bankLocation(p),bankTable:bankLocation(bankPos),
   validMapHeaders:validCount,totalMapIds:MAPS,
   trainerEventsVerified:data.reduce((n,m)=>n+(m.trainerEvents?.length||0),0),
   trainerEventMapsVerified:data.filter(m=>m.trainerEvents?.length).length,
   staticEncountersVerified:data.reduce((n,m)=>n+(m.staticEncounterEvents?.length||0),0),
   staticEncounterMapsVerified:data.filter(m=>m.staticEncounterEvents?.length).length,
   data};
}
function inspectWorld(b){
 if(!Buffer.isBuffer(b)||b.length%BANK_SIZE)throw Error('ROM inválida');
 return {schema:'gen1-world-v1',wildEncounters:findWildData(b),maps:findMapHeaders(b)};
}
module.exports={inspectWorld,findWildData,findMapHeaders,readEncounter,getMapHeader,
  extractTrainerEventPointers,extractStaticEncounterEventPointers};