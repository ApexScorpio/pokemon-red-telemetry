'use strict';
// Menu destinations for Gen I elevators compiled from the three audited ROMs.
// Destination is a ROM possibility, not a current menu selection or free route.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const DATA=require('./data/gen1ElevatorsAudited.json');
const fail=reason=>({verified:false,reason,options:[],
  usableNow:null,selectedFloorVerified:false});
function elevatorOptionsForMap({profile,mapId,romIdentityMatched=false,
 mapWindowVerified=false}={}){
 const sha=String(profile?.hash?.sha256||'').toLowerCase();
 if(!isKnownAuditedRomSha(sha)||profile?.unknownLayout===true||
    !romIdentityMatched||!mapWindowVerified||
    !Number.isInteger(mapId)||mapId<0||mapId>=248)
   return fail('ROM, identidade emulada ou janela RAM por confirmar');
 const maps=profile?.world?.maps?.data;
 if(profile?.world?.maps?.valid!==true||!Array.isArray(maps)||
    maps.length!==248||maps.some((m,i)=>m?.mapId!==i))
   return fail('Cabeçalhos ROM não comprovados');
 const variant=DATA.variants?.[sha];
 if(variant?.verified!==true||variant.romSha256!==sha||
    variant.totalElevators!==3||variant.totalMenuFloorChoices!==19||
    !Array.isArray(variant.elevators)||variant.elevators.length!==3)
   return fail('Catálogo dos três elevadores não auditado para esta ROM');
 const expected=[127,203,236];
 let count=0;
 for(let i=0;i<3;i++){
   const el=variant.elevators[i];
   if(el?.mapId!==expected[i]||!maps[el.mapId]?.valid||
      !Array.isArray(el.availableFloorOptions))
     return fail('Elevador ou mapa de origem divergente da ROM');
   for(let j=0;j<el.availableFloorOptions.length;j++){
     const option=el.availableFloorOptions[j];
     const dest=maps[option?.destinationMapId];
     if(option?.floorMenuIndex!==j||option.destinationRomVerified!==true||
        !dest?.valid||!Array.isArray(dest.objects?.warps)||
        !Number.isInteger(option.destinationWarpIndex)||
        option.destinationWarpIndex<0||
        option.destinationWarpIndex>=dest.objects.warps.length)
       return fail('Destino ou índice de warp do elevador não corresponde ao mapa ROM');
     count++;
   }
 }
 if(count!==19)return fail('Lista de 19 escolhas de pisos incompleta');
 const elevator=variant.elevators.find(x=>x.mapId===mapId);
 return {verified:true,romSha256:sha,mapId,
   elevatorName:elevator?.name||null,
   hasElevator:elevator!==undefined,
   options:elevator?elevator.availableFloorOptions.map(x=>({
     floorMenuIndex:x.floorMenuIndex,
     destinationMapId:x.destinationMapId,
     destinationWarpIndex:x.destinationWarpIndex,
     destinationRomVerified:true,
     currentlySelectable:null,selectedNow:null,
     accessibleNow:null,selectedFloorVerified:false,
     warpingScriptExecuted:false
   })):[],
   usableNow:null,selectedFloorVerified:false,
   routeNavigableNowProven:false,snapshotAtomicVerified:false,
   source:'GEN1_ROM_SHA_AUDITED_ELEVATOR_MENU + MAP_HEADER_DESTINATION_CHECK',
   warning:'Pisos do menu são possibilidades da ROM. A escolha atual, portas e requisitos precisam de RAM e script.'};
}
module.exports={elevatorOptionsForMap};
