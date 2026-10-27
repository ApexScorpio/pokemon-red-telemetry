'use strict';
// Sumário de progresso baseado estritamente em ROM+RAM verificadas.
// Não converter ausência de sprite em item recolhido ou batalha vencida.
function makeAreaProgress(romEvidence,hiddenEvidence,romIdentity){
 const identity=romIdentity?.matched===true;
 if(!identity||!romEvidence?.verified)return {
   verified:false,source:'ROM/RAM_NÃO_CONFIRMADAS',hiddenItems:null,
   visibleItemObjects:null,trainers:null,remainingConfirmed:null
 };
 const items=romEvidence.items||[],trainers=romEvidence.trainers||[];
 const hidden=hiddenEvidence?.verified ? hiddenEvidence.items||[] : null;
 const hiddenResult=hidden?{
   total: hidden.length,
   obtainedConfirmed:hidden.filter(x=>x.isCollected===true).length,
   stillAvailableConfirmed:hidden.filter(x=>x.isCollected===false).length,
   source:hiddenEvidence.source
 }:null;
 const removed=items.filter(x=>x.removedFromMap===true).length;
 const shown=items.filter(x=>x.removedFromMap===false).length;
 const unknown=items.length-removed-shown;
 return {
   verified:true,
   source:'ROM_PERFIL_CRC32 + FLAGS_RAM',
   mapId:romEvidence.mapId,
   hiddenItems:hiddenResult,
   visibleItemObjects:{
     total:items.length, removedFromMapConfirmed:removed,
     notRemovedConfirmed:shown,unknownFlag:unknown,
     collectedConfirmed:null,
     explanation:'Removido do mapa não significa necessariamente recolhido.'
   },
   trainers:{
     totalInRom:trainers.length,
     defeatedConfirmed:null,pendingConfirmed:null,
     statusUnknown:trainers.length,
     explanation:'É necessário ligar os cabeçalhos dos treinadores às event flags.'
   },
   remainingConfirmed:hidden?hiddenResult.stillAvailableConfirmed:null,
   remainingScope:'Apenas itens ocultos com bitmap verificado; não é o total da zona.',
   needs:{trainerEventHeaders:true,fullVisibleItemPickupLog:true,npcScriptProgress:true}
 };
}
module.exports={makeAreaProgress};
