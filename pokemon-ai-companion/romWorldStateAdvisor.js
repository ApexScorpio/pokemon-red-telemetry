'use strict';
// Global advisor: covers any map ID, refuses to fabricate event outcomes.
const {findStaticWarpRoute}=require('./romWarpGraph');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const byte=n=>Number.isInteger(n)&&n>=0&&n<=255;
function adviseWorld({profile,mapId,position,areaEvidence,hiddenItems=[],trainers=[],
 warpGraph,hiddenFlagsVerified=false,trainerFlagsVerified=false,
 itemAccess=null,itemAccessInputs=[],hiddenStartIndex=0,
 positionVerified=false}={}){

 const hash=profile?.hash?.sha256;
 const maps=profile?.world?.maps;
 if(!isKnownAuditedRomSha(hash)||profile?.unknownLayout===true||maps?.valid!==true||!Array.isArray(maps.data)||maps.data.length!==248||!byte(mapId))
  return {verified:false,mapId,observations:[],reason:'ROM ou mapa não comprovados'};
 const map=maps.data[mapId];
 if(!map?.valid)return {verified:false,mapId,observations:[],reason:'Mapa reservado ou não descodificado'};
 // Association is positional in the exact accessInput sequence used by the
 // reachability planner, and only when *every* source index, map and SHA match.
 // One ambiguous coordinate must never inherit another object's reachability.
 const accessByKey=new Map();
 if(itemAccess?.verified===true&&itemAccess.mapId===mapId&&
    itemAccess.romSha256===hash&&Array.isArray(itemAccess.results)&&
    Array.isArray(itemAccessInputs)&&
    itemAccess.results.length===itemAccessInputs.length&&
    Number.isInteger(hiddenStartIndex)&&hiddenStartIndex>=0&&
    hiddenStartIndex<=itemAccessInputs.length){
   for(let i=0;i<itemAccess.results.length;i++){
     const row=itemAccess.results[i],input=itemAccessInputs[i];
     if(row?.index!==i||row.x!==input?.x||row.y!==input?.y||
        input?.romItemCoordinatesVerified!==true)continue;
     const key=(i>=hiddenStartIndex?'HIDDEN_ITEM:':'ITEM:')+row.x+':'+row.y;
     if(accessByKey.has(key))accessByKey.set(key,null);
     else accessByKey.set(key,{accessStatus:row.accessStatus,
       accessRoute:row.route||null,accessReason:row.reason||null});
   }
 }
 const observations=[];
 const accessFor=(kind,x,y)=>accessByKey.get(kind+':'+x+':'+y)||{};
 const add=(kind,status,what,consequence,evidence,extra={})=>
   observations.push({kind,status,what,consequence,evidence,accessibleNow:null,...extra});
 const liveArea=areaEvidence?.verified===true&&areaEvidence.mapId===mapId?
   areaEvidence:null;
 for(const item of liveArea?.items||[]){
   if(!byte(item.x)||!byte(item.y))continue;
   const state=item.removedFromMap===true?'REMOVED_NOT_PROOF_OF_COLLECTION':
     item.removedFromMap===false?'NOT_REMOVED_FLAG':'STATIC_ROM_ONLY';
   add('ITEM',state,item.itemName||'Item #'+item.itemId,
     'Interagir pode atribuir o item indicado no script; resultado real requer flags e execução.',
     item.source||'ROM', {x:item.x,y:item.y,itemId:item.itemId,
       ...accessFor('ITEM',item.x,item.y)});
 }
 for(const item of hiddenItems){
   if(item.mapId!==mapId||!byte(item.x)||!byte(item.y))continue;
   add('HIDDEN_ITEM',hiddenFlagsVerified&&item.isCollected===true?'COLLECTED_FLAG':
      hiddenFlagsVerified&&item.isCollected===false?'NOT_COLLECTED_FLAG':'UNKNOWN',
      item.itemName||'Item oculto #'+item.itemId,
      hiddenFlagsVerified&&item.isCollected===true?'Flag específica de obtenção confirmada.':
      'Pesquisar na coordenada pode acionar o evento; acesso e resultado ainda não confirmados.',
      item.collectionEvidence||'ROM + RAM', {x:item.x,y:item.y,itemId:item.itemId,
       ...accessFor('HIDDEN_ITEM',item.x,item.y)});
 }
 for(const t of [...(liveArea?.trainers||[]),...trainers]) {
   if(!byte(t.x)||!byte(t.y))continue;
   // Hidden-item flags can NEVER attest a trainer outcome. Even a trainer
   // event bit often means only that the battle gate has been disabled.
   const status=trainerFlagsVerified&&t.victoryRecorded===true?'VICTORY_SCRIPT_FLAG':
     trainerFlagsVerified&&t.battleWasPlayed===true?'BATTLE_PLAYED_SCRIPT_FLAG':
     trainerFlagsVerified&&t.eventFlagSet===true?'TRAINER_GATE_CLOSED':
     trainerFlagsVerified&&t.eventFlagSet===false?'TRAINER_GATE_OPEN':'UNKNOWN';
   add('TRAINER',status,t.trainerClassName||t.name||'Treinador',
     'Aproximação pode iniciar combate; flag de portão não prova vitória nem resultado.',
     t.completionSource||t.source||'ROM',{x:t.x,y:t.y,
       eventBitIndex:t.eventBitIndex??null});
 }
 for(const npc of liveArea?.npcs||[]){
   if(!byte(npc.x)||!byte(npc.y))continue;
   add('NPC','INTERACTION_UNRESOLVED','NPC #'+npc.objectOrdinal,
     'O resultado do diálogo depende do script e do estado da partida.',
     npc.source,{x:npc.x,y:npc.y});
 }
 for(const mon of liveArea?.stationaryPokemon||[]){
   if(!byte(mon.x)||!byte(mon.y))continue;
   add('STATIC_POKEMON',liveArea.stationaryEncounterRamVerified&&mon.encounterGateClosed===true?'ENCOUNTER_GATE_CLOSED':'EVENT_CONDITIONAL',
     mon.speciesName||'Pokémon fixo',
     'Interagir pode iniciar encontro; capturado/derrotado não é inferido da remoção.',
     mon.completionSource,{x:mon.x,y:mon.y});
 }
 for(const w of map.objects?.warps||[]){
   if(!byte(w.x)||!byte(w.y))continue;
   const dest=w.destinationMap??w.map;
   add('WARP','STATIC_TRANSITION', 'Saída para mapa '+dest,
     'Entrar pode mudar de mapa; destino dinâmico, portas e scripts requerem RAM.',
     'ROM_WARP', {x:w.x,y:w.y,destinationMapId:dest});
 }
 const connections=profile.world?.outdoorConnections?.edges||[];
 for(const edge of connections.filter(e=>e.sourceMapId===mapId))
   add('BORDER','STATIC_TRANSITION','Fronteira '+edge.direction,
     'Cruzar a fronteira pode entrar no mapa '+edge.destinationMapId+
     '; movimento e scripts não comprovados.', 'ROM_BORDER',
     {destinationMapId:edge.destinationMapId});
 const routes=warpGraph?.verified?Array.from(new Set(observations
   .filter(o=>o.destinationMapId!==undefined&&byte(o.destinationMapId))
   .map(o=>o.destinationMapId))).slice(0,32).map(dest=>
     findStaticWarpRoute(warpGraph,mapId,dest,{maxHops:24})): [];
 return {verified:true,mapId,mapName:map.name||null,romSha256:hash,
   position:positionVerified?position:null,observations,
   liveAreaEvidenceVerified:!!liveArea,
   itemReachabilityEvidenceVerified:accessByKey.size>0,
   hiddenFlagsVerified:hiddenFlagsVerified===true,
   trainerFlagsVerified:trainerFlagsVerified===true,
   counts:observations.reduce((a,o)=>(a[o.status]=(a[o.status]||0)+1,a),{}),
   routes:routes.filter(r=>r.verified),progressCompleteness:'PARTIAL',
   futureOutcomeGuaranteed:false,globalCoverage:'248_IDS_226_NORMAL_HEADERS',
   limitations:['Scripts e ramificações não interpretados integralmente',
     'Percursos geométricos são condicionais, não demonstram acesso imediato',
     'Provas de itens ocultos e treinadores são independentes',
     'Flags de progresso só são conclusivas quando lidas e ligadas ao evento',
     'Uma consequência prevista não é prova de execução']};
}
module.exports={adviseWorld};
