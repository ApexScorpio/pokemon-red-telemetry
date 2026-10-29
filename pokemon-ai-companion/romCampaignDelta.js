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
// All four fields must be present in each of the 226 maps. Never silently
// downgrade a partially-populated exact ledger to rough aggregate counters.
const RECORD_DOMAINS=['hiddenItems','hiddenCoins','trainers','stationaryPokemon'];
function exactEvidence(previous,current){
 const entries=[...previous.mapProgress,...current.mapProgress];
 const count=entries.filter(m=>RECORD_DOMAINS.every(d=>Array.isArray(m.flagRecords?.[d]))).length;
 if(count===0)return {available:false,changes:[]};
 if(count!==452)return {available:false,reason:'Fichas bit a bit incompletas'};
 // Verify that any counters supplied by the verified ROM ledger match the
 // underlying bits. Comparing a malformed summary can silently hide events.
 for(const row of entries){
   const f=row.flagRecords;
   const on=domain=>f[domain].filter(x=>x.flagSet===true).length;
   const tests=[
     ['hiddenItems','collected',on('hiddenItems')],
     ['hiddenItems','notCollected',f.hiddenItems.length-on('hiddenItems')],
     ['hiddenItems','total',f.hiddenItems.length],
     ['hiddenCoins','collected',on('hiddenCoins')],
     ['hiddenCoins','notCollected',f.hiddenCoins.length-on('hiddenCoins')],
     ['hiddenCoins','total',f.hiddenCoins.length],
     ['trainers','flagsMapped',f.trainers.length],
     ['trainers','gatesClosed',on('trainers')],
     ['trainers','gatesOpen',f.trainers.length-on('trainers')],
     ['trainers','scriptedVictories',f.trainers.filter(x=>
       x.flagSet===true&&x.outcomeEvidence==='SCRIPT_VICTORY').length],
     ['trainers','battlesPlayed',f.trainers.filter(x=>
       x.flagSet===true&&x.outcomeEvidence==='BATTLE_WAS_PLAYED').length],
     ['stationaryPokemon','flagsMapped',f.stationaryPokemon.length],
     ['stationaryPokemon','gatesClosed',on('stationaryPokemon')],
     ['stationaryPokemon','gatesOpen',f.stationaryPokemon.length-on('stationaryPokemon')]
   ];
   for(const [domain,field,expected] of tests){
     const number=row[domain]?.[field];
     if(number!==undefined&&(!good(number)||number!==expected))
       return {reason:'Contador '+domain+'.'+field+
         ' diverge dos bits ROM/RAM no mapa '+row.mapId};
   }
 }
 const before=new Map(previous.mapProgress.map(m=>[m.mapId,m]));
 const changes=[];
 for(const row of current.mapProgress){
   const old=before.get(row.mapId);
   if(!old)return {reason:'Mapa sem estado anterior por bit'};
   for(const domain of RECORD_DOMAINS){
     const oldRows=old.flagRecords[domain],newRows=row.flagRecords[domain];
     if(oldRows.length!==newRows.length)return {reason:'Atlas de eventos alterado entre leituras'};
     const index=new Map();
     for(const record of oldRows){
       if(typeof record?.recordId!=='string'||!record.recordId||
          !good(record.bitIndex)||typeof record.flagSet!=='boolean'||
          index.has(record.recordId))
         return {reason:'Referência do bit ROM anterior inválida'};
       index.set(record.recordId,record);
     }
     const seen=new Set();
     for(const record of newRows){
       const prev=index.get(record?.recordId);
       if(!prev||seen.has(record.recordId)||!good(record.bitIndex)||
          record.bitIndex!==prev.bitIndex||
          typeof record.flagSet!=='boolean'||
          (domain==='trainers'&&record.outcomeEvidence!==prev.outcomeEvidence))
         return {reason:'Referência ROM da flag alterada/inválida'};
       seen.add(record.recordId);
       if(prev.flagSet&&!record.flagSet)return {
         reason:'Flag específica diminuiu: possível save carregado',
         resetSuspected:true};
       if(!prev.flagSet&&record.flagSet){
         let kind=domain==='hiddenItems'?'HIDDEN_ITEM_FLAG_RAISED':
           domain==='hiddenCoins'?'HIDDEN_COIN_FLAG_RAISED':
           domain==='stationaryPokemon'?'STATIONARY_GATE_FLAG_RAISED':
           record.outcomeEvidence==='SCRIPT_VICTORY'?'SCRIPT_VICTORY_FLAG_RAISED':
           record.outcomeEvidence==='BATTLE_WAS_PLAYED'?'BATTLE_PLAYED_FLAG_RAISED':
           'TRAINER_GATE_FLAG_RAISED';
         changes.push({kind,mapId:row.mapId,mapName:row.name||'Mapa #'+row.mapId,
           amount:1,recordId:record.recordId,bitIndex:record.bitIndex,
           x:Number.isInteger(record.x)?record.x:null,
           y:Number.isInteger(record.y)?record.y:null,
           source:'ROM_EVENT_BIT_IDENTIFICADO + RAM_SEQUENCIAL',
           playerActionConfirmed:false});
       }
     }
   }
 }
 return {available:true,changes};
}
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
 const evidence=exactEvidence(previous,current);
 if(evidence.reason)return fail(evidence.reason,
   {resetSuspected:evidence.resetSuspected===true});
 const finalChanges=evidence.available?evidence.changes:changes;
 const time=typeof observedAt==='string'&&!Number.isNaN(Date.parse(observedAt))?
   observedAt:null;
 return {verified:true,romSha256:sha,observedAt:time,
   changes:finalChanges,
   granularity:evidence.available?'EXACT_ROM_EVENT_BIT':'MAP_COUNTER_ONLY',
   totalChangedFlags:finalChanges.reduce((a,e)=>a+e.amount,0),
   playerActionConfirmed:false,actionObserved:false,
   snapshotAtomicVerified:false,
   note:'Mudanças de flags entre leituras, não ações observadas no mesmo frame. '+
     'Sem prova de vitória, captura ou causalidade para além da semântica do bit.'};
}
module.exports={diffCampaignProgress,METRICS};
