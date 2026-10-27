'use strict';
// Auditoria de cobertura por mapa a partir dos OBJETOS da ROM e do atlas
// de scripts comprovados. Não requer RAM nem infere vitórias.
const {trainerFlagsForCurrentMap}=require('./romTrainerEvents');
function auditTrainerCoverage(profile) {
 const maps=profile?.world?.maps?.data;
 if(!Array.isArray(maps))return {verified:false,reason:'MAPAS_ROM_NÃO_DISPONÍVEIS',maps:[]};
 const empty=Array(320).fill('00');
 const results=[];
 let mapped=0,unmapped=0,total=0,complete=0;
 for(const m of maps){
   if(!m?.valid||!Array.isArray(m.objects?.objects))continue;
   const human=m.objects.objects.map((object,i)=>({object,ordinal:i+1}))
     .filter(({object})=>object.kind==='trainer' &&
       Number.isInteger(object.trainerClassOrItemId)&&object.trainerClassOrItemId>=201);
   if(!human.length)continue;
   const evidence=trainerFlagsForCurrentMap(profile,m,empty);
   const matched=new Set(evidence.verified?evidence.entries.map(e=>e.objectOrdinal):[]);
   const missing=human.filter(x=>!matched.has(x.ordinal)).map(x=>({
     objectOrdinal:x.ordinal,x:x.object.x,y:x.object.y,
     trainerClassId:x.object.trainerClassOrItemId,
     trainerNumber:x.object.trainerNumberOrLevel,
     reason:evidence.source
   }));
   total+=human.length;mapped+=human.length-missing.length;unmapped+=missing.length;
   if(!missing.length)complete++;
   results.push({mapId:m.mapId,humanTrainers:human.length,
     matched:human.length-missing.length,unmapped:missing.length,
     fullCoverage:missing.length===0,missing});
 }
 return {verified:true,source:'ROM_MAP_OBJECTS + STRICT_TRAINER_FLAG_ATLAS',
   mapsWithTrainers:results.length,mapsFullyMapped:complete,
   humanTrainerObjects:total,trainerEventLinksMapped:mapped,
   trainerEventLinksUnknown:unmapped,
   maps:results,unmappedMaps:results.filter(x=>x.unmapped>0).map(x=>x.mapId)};
}
function currentMapTrainerCoverage(report,mapId){
 if(!report?.verified)return null;
 return report.maps.find(x=>x.mapId===mapId)||null;
}
module.exports={auditTrainerCoverage,currentMapTrainerCoverage};
