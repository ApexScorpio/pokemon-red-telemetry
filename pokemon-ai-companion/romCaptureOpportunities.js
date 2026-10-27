'use strict';
// Encontros da ROM identificada + Pokédex Owned/Seen lida da RAM.
// As probabilidades são condicionais a haver encontro naquele meio;
// rateByte NÃO é uma probabilidade percentual direta.
// Não declarar "capturável já" se faltam condições de Surf/entrada na zona.
const SUM_WEIGHTS=256;
function captureOpportunities(romWild,owned,seen,{romMatched=false,partyRamVerified=false}={}){
 if(!romMatched||!romWild||!Array.isArray(owned)||!Array.isArray(seen)||!partyRamVerified)
  return {verified:false,reason:'ROM CRC32 ou Pokédex da RAM não confirmados',zones:[]};
 const ownedSet=new Set(owned.filter(x=>Number.isInteger(x)&&x>=1&&x<=151));
 const seenSet=new Set(seen.filter(x=>Number.isInteger(x)&&x>=1&&x<=151));
 const zones=[];
 for(const kind of ['grass','water']){
  const data=romWild[kind];
  if(!data||!Array.isArray(data.slots)||!Number.isInteger(data.rateByte))continue;
  const entries=new Map();
  for(const s of data.slots){
   if(!Number.isInteger(s.dex)||s.dex<1||s.dex>151||
      !Number.isInteger(s.level)||s.level<1||s.level>100||
      !Number.isInteger(s.rollWeight)||s.rollWeight<0||s.rollWeight>256)continue;
   if(!entries.has(s.dex))entries.set(s.dex,{
     dex:s.dex,name:s.speciesName||'Espécie #'+s.dex,
     levels:[],weight:0,caught:ownedSet.has(s.dex),seen:seenSet.has(s.dex)
   });
   const row=entries.get(s.dex);
   row.levels.push(s.level);row.weight+=s.rollWeight;
  }
  zones.push({kind,encounterRateByte:data.rateByte,
   encounterChanceExact:false,
   requires:kind==='water'?'Acesso a água e Surf':'Acesso à relva do mapa',
   species:[...entries.values()].map(e=>({
     dex:e.dex,name:e.name,levels:[...new Set(e.levels)].sort((a,b)=>a-b),
     conditionalChancePercent:Math.round(e.weight*10000/SUM_WEIGHTS)/100,
     alreadyCaught:e.caught,alreadySeen:e.seen
   })).sort((a,b)=>a.alreadyCaught-b.alreadyCaught||
     b.conditionalChancePercent-a.conditionalChancePercent)
  });
 }
 return {verified:true,source:'PERFIL_ROM_CRC32 + POKEDEX_RAM',
  mapId:romWild.mapId,zones,missingSpecies:[...new Set(zones.flatMap(z=>
   z.species.filter(s=>!s.alreadyCaught).map(s=>s.dex)))].length,
  warning:'Disponibilidade depende da zona acessível e dos meios de deslocação; taxas são condicionais ao encontro.'};
}
module.exports={captureOpportunities};
