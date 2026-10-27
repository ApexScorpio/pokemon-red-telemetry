'use strict';
// Sumário de progresso baseado estritamente em ROM+RAM verificadas.
// Não converter ausência de sprite em item recolhido ou batalha vencida.
function makeAreaProgress(romEvidence,hiddenEvidence,romIdentity){
 const identity=romIdentity?.matched===true;
 if(!identity||!romEvidence?.verified)return {
   verified:false,source:'ROM/RAM_NÃO_CONFIRMADAS',hiddenItems:null,
   visibleItemObjects:null,trainers:null,remainingConfirmed:null
 };
 const items=romEvidence.items||[],trainers=romEvidence.trainers||[],
   stationary=romEvidence.stationaryPokemon||[];
 const hidden=hiddenEvidence?.verified ? hiddenEvidence.items||[] : null;
 const hiddenResult=hidden?{
   total: hidden.length,
   obtainedConfirmed:hidden.filter(x=>x.isCollected===true).length,
   stillAvailableConfirmed:hidden.filter(x=>x.isCollected===false).length,
   source:hiddenEvidence.source
 }:null;
 const gatesClosed=trainers.filter(x=>x.eventFlagSet===true).length;
 const gatesOpen=trainers.filter(x=>x.eventFlagSet===false).length;
 const trainerUnknown=trainers.length-gatesClosed-gatesOpen;
 const scriptedVictories=trainers.filter(t=>t.victoryRecorded===true).length;
 const scriptedBattleOccurrences=trainers.filter(t=>t.battleWasPlayed===true).length;
 const staticDone=stationary.filter(x=>x.encounterGateClosed===true).length;
 const staticOpen=stationary.filter(x=>x.encounterGateClosed===false).length;
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
     defeatedConfirmed:null, // total geral não comprovado; preservar separação
     pendingConfirmed:null,
     scriptedVictoriesConfirmed:scriptedVictories,
     scriptedBattlesPlayedConfirmed:scriptedBattleOccurrences,
     eventGatesClosed:gatesClosed,eventGatesOpen:gatesOpen,
     eventGatesUnknown:trainerUnknown,
     statusUnknown:trainerUnknown,
     explanation:'Flag de evento 1 = combate desativado ou concluído; não prova combate histórico. Flag 0 = não desativado por esta flag.'
   },
   stationaryPokemon:{
     totalInRom:stationary.length,eventGatesClosed:staticDone,
     eventGatesOpen:staticOpen,
     eventGatesUnknown:stationary.length-staticDone-staticOpen,
     caughtConfirmed:null,defeatedConfirmed:null,
     explanation:'Evento encerrado não prova captura. Consultar Pokédex Owned separadamente.'
   },
   remainingConfirmed:hidden?hiddenResult.stillAvailableConfirmed:null,
   remainingScope:'Apenas itens ocultos com bitmap verificado; não é o total da zona.',
   needs:{trainerEventHeaders:trainerUnknown>0,fullVisibleItemPickupLog:true,npcScriptProgress:true}
 };
}
module.exports={makeAreaProgress};
