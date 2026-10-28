'use strict';
// Extract every cardinal boundary connection directly from compiled Gen I
// map-header records. A connection record occupies 11 bytes and stores the
// destination map ID first. The movement may still be blocked by script state.
const crypto=require('node:crypto');
const SHA=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']);
const DIR=[['north',8,'south'],['south',4,'north'],['west',2,'east'],['east',1,'west']];
function extractOutdoorConnections(rom,maps){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    !maps||maps.valid!==true||!Array.isArray(maps.data)||maps.data.length!==248)
  return {verified:false,reason:'ROM ou catálogo de 248 mapas não validado'};
 const sha256=crypto.createHash('sha256').update(rom).digest('hex');
 if(!SHA.has(sha256))return {verified:false,reason:'SHA-256 da ROM não auditado'};
 const byId=new Map(maps.data.filter(m=>m.valid).map(m=>[m.mapId,m]));
 if(byId.size!==226)return {verified:false,reason:'Esperados 226 cabeçalhos normais'};
 const edges=[];
 for(const m of byId.values()){
  const bank=m.mapBank,p=m.mapBank*0x4000+m.mapHeaderPointerCpu-0x4000;
  if(!Number.isInteger(bank)||bank<1||bank>=64||!Number.isInteger(m.mapHeaderPointerCpu)||
    m.mapHeaderPointerCpu<0x4000||m.mapHeaderPointerCpu>=0x8000||
    p<bank*0x4000||p+12>(bank+1)*0x4000||rom[p+9]!==m.connectionFlags)
   return {verified:false,reason:'Cabeçalho ou bitmask incoerente: mapa '+m.mapId};
  let index=0;
  for(const [direction,mask,reverseDirection] of DIR){
   if(!(m.connectionFlags&mask))continue;
   const position=p+10+index*11;
   if(position+11>(bank+1)*0x4000)return {verified:false,reason:'Ligação fora do banco: mapa '+m.mapId};
   const destinationMapId=rom[position];
   if(!byId.has(destinationMapId))return {verified:false,reason:'Ligação para ID de mapa sem cabeçalho: '+m.mapId+' → '+destinationMapId};
   edges.push({sourceMapId:m.mapId,destinationMapId,direction,reverseDirection,
    sourceFileOffset:position,sourceBank:bank,descriptorSize:11,
    destinationBlockPointerCpu:rom.readUInt16LE(position+1),
    destinationWidthBlocks:rom[position+6],
    pathAccessProven:false,currentBorderCoordinatesProven:false});
   index++;
  }
  if(index!==m.connectionFlags.toString(2).split('1').length-1)
   return {verified:false,reason:'Contagem de ligações divergente no mapa '+m.mapId};
 }
 const signatures=new Set(edges.map(e=>e.sourceMapId+':'+e.direction+':'+e.destinationMapId));
 const unmatched=edges.filter(e=>!signatures.has(e.destinationMapId+':'+e.reverseDirection+':'+e.sourceMapId));
 return {verified:edges.length===78&&unmatched.length===0,
  romSha256:sha256,edges,edgeCount:edges.length,reciprocalConnections:edges.length-unmatched.length,
  nonReciprocalConnections:unmatched,
  source:'ROM MapHeaderConnections (11 bytes, directions north/south/west/east)',
  runtimeAccessibilityVerified:false,
  allConnectionBytesScanned:true};
}
module.exports={extractOutdoorConnections};