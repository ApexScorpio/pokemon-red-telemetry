'use strict';
// Elevator floor choices from compiled table data in the three exact Gen I ROMs.
// They describe possible floor-menu destinations, never the current RAM choice.
const crypto=require('node:crypto');
const KNOWN=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']);
const TABLES=Object.freeze([
 {mapId:127,name:'Celadon Mart Elevator',bank:0x12,cpu:0x464a,count:5,
  expected:[[5,122],[2,123],[2,124],[2,125],[2,136]]},
 {mapId:203,name:'Rocket Hideout Elevator',bank:0x11,cpu:0x5759,count:3,
  expected:[[4,199],[4,200],[2,202]]},
 {mapId:236,name:'Silph Co Elevator',bank:0x11,cpu:0x5811,count:11,
  expected:[[3,181],[2,207],[2,208],[2,209],[2,210],[2,211],[2,212],[2,213],[2,233],[2,234],[1,235]]}
]);
function auditElevatorDestinations(rom,world){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576)
  return {verified:false,reason:'ROM sem 64 bancos completos'};
 const sha256=crypto.createHash('sha256').update(rom).digest('hex');
 if(!KNOWN.has(sha256))return {verified:false,reason:'SHA-256 da ROM não auditado'};
 const maps=world?.maps;
 if(maps?.valid!==true||!Array.isArray(maps.data)||maps.data.length!==248)
  return {verified:false,reason:'Mapas ROM sem evidência'};
 const byId=new Map(maps.data.filter(m=>m.valid).map(m=>[m.mapId,m]));
 const elevators=[];
 for(const t of TABLES){
  if(!byId.has(t.mapId))return {verified:false,reason:'Elevador não localizado no mapa #'+t.mapId};
  const offset=t.bank*0x4000+t.cpu-0x4000,options=[];
  for(let i=0;i<t.count;i++){
   const warpIndex=rom[offset+2*i],destinationMapId=rom[offset+2*i+1];
   if(warpIndex!==t.expected[i][0]||destinationMapId!==t.expected[i][1]||
      !byId.has(destinationMapId)||
      warpIndex>=byId.get(destinationMapId).objects.warps.length)
    return {verified:false,reason:'Tabela de pisos diverge: '+t.name+' índice '+i};
   options.push({floorMenuIndex:i,destinationMapId,destinationWarpIndex:warpIndex,
    destinationRomVerified:true,selectedNow:null,accessibleNow:null});
  }
  elevators.push({mapId:t.mapId,name:t.name,sourceBank:t.bank,
   sourceCpuAddress:t.cpu,sourceFileOffset:offset,
   availableFloorOptions:options,
   currentFloorFromRamVerified:false,currentSelectionFromRamVerified:false,
   allTravelConditionsVerified:false});
 }
 return {verified:true,romSha256:sha256,elevators,totalElevators:elevators.length,
  totalMenuFloorChoices:elevators.reduce((n,x)=>n+x.availableFloorOptions.length,0),
  source:'SHA verified ROM script data: RocketHideoutElevatorWarpMaps, CeladonMartElevatorWarpMaps, SilphCoElevatorWarpMaps',
  warning:'Menu choices are ROM possibilities; the script modifies wWarpEntries and the current destination requires RAM'};
}
module.exports={auditElevatorDestinations};