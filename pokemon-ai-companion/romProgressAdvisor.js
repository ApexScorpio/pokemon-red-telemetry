'use strict';
// Alertas extraídos dos learnsets e evoluções da ROM exata carregada.
// Não confundir previsão por nível com a janela "aprender golpe" aberta no jogo.
const {expAtLevel}=require('./gen1EngineMath');
function speciesInRom(profile,internalId){
 if(!profile||!Array.isArray(profile.species)||!Number.isInteger(internalId)||internalId<1||
    internalId>profile.species.length)return null;
 const p=profile.species[internalId-1];
 return p?.internalId===internalId?p:null;
}
function milestones(profile,internalId){
 const species=speciesInRom(profile,internalId);
 if(!species||!Array.isArray(species.learnset)||!Array.isArray(species.evolutions))return null;
 const output=[];
 for(const m of species.learnset){
  if(!Number.isInteger(m.level)||m.level<1||m.level>100||!Number.isInteger(m.moveId))continue;
  output.push({level:m.level,kind:'MOVE',name:profile.moveNames?.[m.moveId-1]||null,
    moveId:m.moveId,source:'ROM_PERFIL_CRC32'});
 }
 for(const e of species.evolutions){
  if(e.method===1&&Number.isInteger(e.args?.[0])&&e.args[0]>=1&&e.args[0]<=100){
   const next=speciesInRom(profile,e.args[1]);
   output.push({level:e.args[0],kind:'EVOLUTION',name:next?.name||null,
     evolveToInternalId:e.args[1],source:'ROM_PERFIL_CRC32'});
  }
  if(e.method===2&&Number.isInteger(e.args?.[0])){
   const next=speciesInRom(profile,e.args[1]);
   output.push({level:null,kind:'EVOLUTION_ITEM',name:next?.name||null,
     itemId:e.args[0],evolveToInternalId:e.args[1],source:'ROM_PERFIL_CRC32'});
  }
  if(e.method===3&&Number.isInteger(e.args?.[0])){
   const next=speciesInRom(profile,e.args[0]);
   output.push({level:null,kind:'EVOLUTION_TRADE',name:next?.name||null,
     evolveToInternalId:e.args[0],source:'ROM_PERFIL_CRC32'});
  }
 }
 return output.sort((a,b)=>(a.level??999)-(b.level??999));
}
function nextPartyAlerts(profile,party){
 if(!profile||!Array.isArray(party))return {
   source:'ROM_NÃO_IDENTIFICADA',verified:false,alerts:[]};
 const alerts=[];
 for(const mon of party){
  const lv=mon?.level,id=mon?.speciesId;
  if(!Number.isInteger(lv)||lv<1||lv>100)continue;
  const levels=milestones(profile,id);
  if(!levels)continue;
  const upcoming=levels.filter(e=>Number.isInteger(e.level)&&e.level>lv);
  const next=upcoming[0]||null;
  if(next)alerts.push({
    partyIndex:mon.partyIndex??null,speciesId:id,
    speciesName:speciesInRom(profile,id).name,
    currentLevel:lv,levelsRemaining:next.level-lv,nextMilestone:next,
    urgent:next.level-lv<=2,source:'ROM_CRC32+NÍVEL_RAM'
  });
 }
 return {source:'ROM_CRC32+NÍVEIS_RAM',verified:true,alerts,
   urgent:alerts.filter(a=>a.urgent)};
}
function daycareAdvice(profile,{speciesId,experience,depositedLevel}={}){
 if(!profile)return {verified:false,reason:'ROM atual não reconhecida por CRC32'};
 const species=speciesInRom(profile,speciesId);
 const rate=profile.growthRates?.[species?.stats?.growthRateId];
 if(!species||!rate||!Number.isInteger(experience)||experience<0||experience>0xFFFFFF||
    !Number.isInteger(depositedLevel)||depositedLevel<1||depositedLevel>100)
    return {verified:false,reason:'Espécie/experiência/curva de crescimento indisponível'};
 let currentLevel=null;
 try{
  for(let lv=100;lv>=1;lv--)if(experience>=expAtLevel(rate,lv)){currentLevel=lv;break;}
  if(currentLevel===null)return {verified:false,reason:'EXP não compatível com curva'};
 }catch(e){return {verified:false,reason:'Curva de experiência inválida: '+e.message};}
 const history=milestones(profile,speciesId);
 if(!history)return {verified:false,reason:'Learnset não validado nesta ROM'};
 const leveled=history.filter(x=>Number.isInteger(x.level)&&x.level>depositedLevel);
 const overdue=leveled.filter(x=>x.level<=currentLevel);
 const upcoming=leveled.find(x=>x.level>currentLevel)||null;
 const pickupAtLevel=upcoming?Math.max(1,upcoming.level-2):null;
 const expUntilPickup=pickupAtLevel!==null?
   Math.max(0,expAtLevel(rate,pickupAtLevel)-experience):null;
 return {
  verified:true,source:'ROM_EXATA_CRC32+EXP_DA_RAM',
  currentLevel,milestones:leveled,nextMilestone:upcoming,overdueMilestones:overdue,
  pickupAtLevel,expUntilPickup,stepsUntilPickupEstimate:expUntilPickup,
  // 1 EXP / passo válido de Daycare na Gen I, não um contador diretamente observado.
  pickupAlert:overdue.length?
    'ATENÇÃO: marco de nível ultrapassado no Daycare ('+(overdue[0].name||overdue[0].kind)+')':
    upcoming&&currentLevel>=pickupAtLevel?
      'IR BUSCAR AGORA: '+(upcoming.name||upcoming.kind)+' no nível '+upcoming.level:null
 };
}
module.exports={speciesInRom,milestones,nextPartyAlerts,daycareAdvice};
