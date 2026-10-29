'use strict';
// Strict snapshot-to-snapshot campaign delta. A rising event flag is not
// evidence of a player action, a trainer victory or a captured Pokémon.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const good=n=>Number.isInteger(n)&&n>=0;
const fail=(reason,extra={})=>({verified:false,reason,changes:[],
  actionObserved:false,snapshotAtomicVerified:false,...extra});
const METRICS=[
 ['hiddenItems','collected','HIDDEN_ITEM_FLAG_RAISED'],
 ['hiddenCoins','collected','HIDDEN_COIN_FLAG_RAISED'],
 ['trainers','gatesClosed','TRAINER_GATE_FLAG_RAISED'],
 ['trainers','scriptedVictories','SCRIPT_VICTORY_FLAG_RAISED'],
 ['trainers','battlesPlayed','BATTLE_PLAYED_FLAG_RAISED'],
 ['stationaryPokemon','gatesClosed','STATIONARY_GATE_FLAG_RAISED']
];
function diffCampaignProgress({previous,current,observedAt}={}){
 const sha=String(current?.romSha256||'').toLowerCase();
 if(current?.verified!==true||!isKnownAuditedRomSha(sha)||
    current.mapCount!==226||!Array.isArray(current.mapProgress)||
    current.mapProgress.length!==226)
   return fail('Leitura mundial atual não verificada');
 if(previous?.verified!==true||previous.romSha256!==sha||
    previous.mapCount!==226||!Array.isArray(previous.mapProgress)||
    previous.mapProgress.length!==226)
   return fail('Sem leitura anterior comparável da mesma ROM',{baselineRequired:true});
 const oldById=new Map();
 for(const row of previous.mapProgress){
   if(!good(row?.mapId)||row.mapId>=248||oldById.has(row.mapId))
     return fail('Mapa anterior duplicado ou inválido');
   oldById.set(row.mapId,row);
 }
 const seen=new Set(),changes=[];
 for(const row of current.mapProgress){
   if(!good(row?.mapId)||row.mapId>=248||seen.has(row.mapId))
     return fail('Mapa atual duplicado ou inválido');
   seen.add(row.mapId);
   const before=oldById.get(row.mapId);
   if(!before)return fail('Mapa adicionado/removido entre leituras');
   for(const [domain,metric,kind] of METRICS){
     const a=before[domain]?.[metric],b=row[domain]?.[metric];
     if(!good(a)||!good(b))return fail('Contagens RAM malformadas em '+row.mapId);
     if(b<a)return fail('Flag ou contador diminuiu: possível save carregado, reinício ou amostras inconsistentes',
       {resetSuspected:true});
     if(b>a)changes.push({kind,mapId:row.mapId,
       mapName:row.name||'Mapa #'+row.mapId,amount:b-a,
       source:'DIFERENÇA_DE_FLAGS_ROM_RAM_NÃO_ATÓMICA',
       playerActionConfirmed:false});
   }
 }
 const time=typeof observedAt==='string'&&!Number.isNaN(Date.parse(observedAt))?
   observedAt:null;
 return {verified:true,romSha256:sha,observedAt:time,
   changes,totalChangedFlags:changes.reduce((a,e)=>a+e.amount,0),
   playerActionConfirmed:false,actionObserved:false,
   snapshotAtomicVerified:false,
   note:'Mudanças de flags entre leituras, não ações observadas no mesmo frame. '+
     'Sem prova de vitória, captura ou causalidade para além da semântica do bit.'};
}
module.exports={diffCampaignProgress,METRICS};
