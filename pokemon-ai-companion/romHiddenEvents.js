'use strict';
// Leitura em modo read-only: ROM exata -> mapa de eventos ocultos + ponteiros
// -> evento de 6 bytes -> argumento (ID real do item) -> coordenadas.
const crypto=require('node:crypto');
const BANK=0x4000,ITEM_COUNT=54,MAP_COUNT=85;
const MAP_SEED=Buffer.from([38,39,40,41,42,43,45,52]);
const COORD_SEED=Buffer.from([0x33,0x12,0x01,0x33,0x2a,0x10,0x3d,0x0c,0x12]);
function positions(buffer,seed){
 const out=[];let at=0;
 while((at=buffer.indexOf(seed,at))!==-1){out.push(at);at++;}
 return out;
}
function address(pos){return {bank:Math.floor(pos/BANK),fileOffset:pos,
 cpuAddress:0x4000+pos%BANK};}
function extractHiddenItemsFromRom(rom){
 if(!Buffer.isBuffer(rom)||rom.length<2*BANK||rom.length%BANK)
  return {valid:false,reason:'ROM inválida'};
 const matches=[];
 for(const start of positions(rom,MAP_SEED)){
  if(Math.floor(start/BANK)!==Math.floor((start+MAP_COUNT*3)/BANK))continue;
  if(rom[start+MAP_COUNT]!==0xff)continue;
  const mapIds=rom.subarray(start,start+MAP_COUNT);
  if(new Set(mapIds).size!==MAP_COUNT)continue;
  const bank=Math.floor(start/BANK),ptrStart=start+MAP_COUNT+1;
  const eventsByCoordinate=new Map();
  let eventCount=0,valid=true;
  for(let i=0;i<MAP_COUNT&&valid;i++){
   const ptr=rom.readUInt16LE(ptrStart+2*i);
   if(ptr<0x4000||ptr>=0x8000){valid=false;break;}
   let pos=bank*BANK+ptr-0x4000,ended=false;
   for(let j=0;j<150;j++){
    if(pos>=(bank+1)*BANK){valid=false;break;}
    if(rom[pos]===0xff){ended=true;break;}
    if(pos+6>(bank+1)*BANK){valid=false;break;}
    const y=rom[pos],x=rom[pos+1],itemId=rom[pos+2];
    const handlerBank=rom[pos+3],handlerCpu=rom.readUInt16LE(pos+4);
    if(handlerBank>=rom.length/BANK||handlerCpu<0x4000||handlerCpu>=0x8000){
     valid=false;break;
    }
    const key=mapIds[i]+','+y+','+x;
    if(!eventsByCoordinate.has(key))eventsByCoordinate.set(key,[]);
    eventsByCoordinate.get(key).push({mapId:mapIds[i],y,x,itemId,handlerBank,handlerCpu});
    pos+=6;eventCount++;
   }
   if(!ended)valid=false;
  }
  if(!valid||eventCount<ITEM_COUNT)continue;
  for(const offset of positions(rom,COORD_SEED)){
   if(Math.floor(offset/BANK)!==Math.floor((offset+ITEM_COUNT*3)/BANK))continue;
   if(rom[offset+ITEM_COUNT*3]!==0xff)continue;
   const items=[],handlers=[];let ok=true;
   for(let index=0;index<ITEM_COUNT;index++){
    const p=offset+3*index,mapId=rom[p],y=rom[p+1],x=rom[p+2];
    const found=eventsByCoordinate.get(mapId+','+y+','+x)||[];
    if(found.length!==1||found[0].itemId<1||found[0].itemId>0x53){
     ok=false;break;
    }
    const e=found[0];
    items.push({hiddenIndex:index,mapId,y,x,itemId:e.itemId});
    handlers.push(e.handlerBank*65536+e.handlerCpu);
   }
   if(!ok||new Set(handlers).size!==1)continue;
   matches.push({
    eventMapTable:address(start),coordinateTable:address(offset),
    hiddenItemHandler:{bank:items.length?Math.floor(handlers[0]/65536):null,
      cpuAddress:handlers[0]&0xffff},
    maps:MAP_COUNT,totalEvents:eventCount,items
   });
  }
 }
 if(matches.length!==1)return {valid:false,candidates:matches.length,
  reason:'Tabela ROM de eventos/itens ocultos não encontrada de forma única'};
 return {schema:'gen1-hidden-items-v1',valid:true,
  source:'ROM: HiddenEventMaps+Pointers+HiddenItemCoords',
  sha256:crypto.createHash('sha256').update(rom).digest('hex'),
  ...matches[0]};
}
module.exports={extractHiddenItemsFromRom};
