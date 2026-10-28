'use strict';
// Global advisor: covers any map ID, refuses to fabricate event outcomes.
const {findStaticWarpRoute}=require('./romWarpGraph');
const byte=n=>Number.isInteger(n)&&n>=0&&n<=255;
function adviseWorld({profile,mapId,position,areaEvidence,hiddenItems=[],trainers=[],warpGraph,flagsVerified=false,positionVerified=false}={}){
 const hash=profile?.hash?.sha256;
 const maps=profile?.world?.maps;
 if(!hash||maps?.valid!==true||!Array.isArray(maps.data)||maps.data.length!==248||!byte(mapId))
  return {verified:false,mapId,observations:[],reason:'ROM ou mapa não comprovados'};
 const map=maps.data[mapId];
 if(!map?.valid)return {verified:false,mapId,observations:[],reason:'Mapa reservado ou não descodificado'};
 const observations=[];
 const add=(kind,status,what,consequence,evidence,extra={})=>
   observations.push({kind,status,what,consequence,evidence,accessibleNow:null,...extra});
 for(const item of areaEvidence?.items||[]){
   if(!byte(item.x)||!byte(item.y))continue;
   const state=item.removedFromMap===true?'REMOVED_NOT_PROOF_OF_COLLECTION':
     item.removedFromMap===false?'PRESENT_IN_RAM':'STATIC_ROM_ONLY';
   add('ITEM',state,item.itemName||'Item #'+item.itemId,
     'Interagir pode atribuir o item indicado no script; resultado real requer flags e execução.',
     item.source||'ROM', {x:item.x,y:item.y,itemId:item.itemId});
 }
 for(const item of hiddenItems){
   if(item.mapId!==mapId||!byte(item.x)||!byte(item.y))continue;
   add('HIDDEN_ITEM',item.isCollected===true?'COLLECTED_FLAG':
      item.isCollected===false&&flagsVerified?'NOT_COLLECTED_FLAG':'UNKNOWN',
      item.itemName||'Item oculto #'+item.itemId,
      item.isCollected===true?'Flag de obtenção ativada.':
      'Pesquisar na coordenada pode acionar o evento; acesso e resultado ainda não confirmados.',
      item.collectionEvidence||'ROM + RAM', {x:item.x,y:item.y,itemId:item.itemId});
 }
 for(const t of trainers){
   if(!byte(t.x)||!byte(t.y))continue;
   add('TRAINER',t.defeated===true&&flagsVerified?'DEFEATED_FLAG':
     t.defeated===false&&flagsVerified?'NOT_DEFEATED_FLAG':'UNKNOWN',
     t.name||'Treinador', 'Aproximação pode iniciar combate, sujeita a visão, scripts e flags.',
     t.source||'ROM', {x:t.x,y:t.y});
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
   counts:observations.reduce((a,o)=>(a[o.status]=(a[o.status]||0)+1,a),{}),
   routes:routes.filter(r=>r.verified),progressCompleteness:'PARTIAL',
   futureOutcomeGuaranteed:false,globalCoverage:'248_IDS_226_NORMAL_HEADERS',
   limitations:['Scripts e ramificações não interpretados integralmente',
     'Flags de progresso só são conclusivas quando lidas e ligadas ao evento',
     'Uma consequência prevista não é prova de execução']};
}
module.exports={adviseWorld};
