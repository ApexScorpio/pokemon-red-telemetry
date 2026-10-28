'use strict';
const {isKnownAuditedRomSha}=require('./romKnownSha256');
// Gen I TryDoWildEncounter (pret/pokered/engine/battle/wild_encounters.asm).
// Probabilidade teórica por verificação elegível, NÃO por passo universal.
// Não prevê o valor RNG que sairá; a aplicação live deve provar pré-condições.
const SLOT_WEIGHTS=Object.freeze([51,51,39,25,25,25,13,13,11,3]);
const DENOMINATOR=65536;
function fraction(n,d) {
  if(n===0)return {numerator:0,denominator:1,probability:0,percent:0};
  let a=n,b=d;while(b)[a,b]=[b,a%b];
  return {numerator:n/a,denominator:d/a,probability:n/d,percent:100*n/d};
}
const refuse=reason=>({verified:false,reason});
function wildEncounterCheckOdds({rateByteFromRom,slotsFromRom,
  repelStepsFromRam,firstPartyLevelFromRam,evidence}={}) {
  if(!evidence||evidence.identifiedRomSha256Verified!==true||
     !isKnownAuditedRomSha(evidence.romSha256)||
     evidence.encounterTableFromSameRomVerified!==true||
     evidence.liveRamSnapshotVerified!==true||
     evidence.preEncounterChecksPassedVerified!==true||
     evidence.encounterMediumResolvedVerified!==true||
     evidence.slotRngUniformModelAppliesVerified!==true)
    return refuse('ROM, RAM, meio, terreno, movimento ou modelo RNG não comprovados');
  if(!Number.isInteger(rateByteFromRom)||rateByteFromRom<0||rateByteFromRom>255||
     !Number.isInteger(repelStepsFromRam)||repelStepsFromRam<0||repelStepsFromRam>255||
     !Number.isInteger(firstPartyLevelFromRam)||firstPartyLevelFromRam<1||
     firstPartyLevelFromRam>100)
    return refuse('Taxa, repelente ou nível do primeiro Pokémon inválidos');
  if(!Array.isArray(slotsFromRom)||
     (rateByteFromRom===0&&slotsFromRom.length!==0)||
     (rateByteFromRom>0&&slotsFromRom.length!==10))
    return refuse('Slots incompatíveis com a taxa da ROM');
  for(let i=0;i<slotsFromRom.length;i++){
    const s=slotsFromRom[i];
    if(!s||s.slot!==i||s.rollWeight!==SLOT_WEIGHTS[i]||
       !Number.isInteger(s.internalId)||s.internalId<1||s.internalId>190||
       !Number.isInteger(s.level)||s.level<1||s.level>100)
      return refuse('Ordem/peso/espécie/nível do slot ROM inválido');
  }
  // Ao passar de 1 para 0, o código mostra "Repel wore off" e
  // regressa antes do sorteio (mesmo que houvesse terreno elegível).
  const lastRepelStep=repelStepsFromRam===1;
  const repelFilters=repelStepsFromRam>1;
  const eligible=lastRepelStep?[]:slotsFromRom.filter(s=>
    !repelFilters||s.level>=firstPartyLevelFromRam);
  const weight=eligible.reduce((n,s)=>n+s.rollWeight,0);
  const discarded=(rateByteFromRom>0&&!lastRepelStep)?256-weight:0;
  const acceptedPairs=lastRepelStep?0:rateByteFromRom*weight;
  const blockedPairs=lastRepelStep?0:rateByteFromRom*discarded;
  const basePairs=lastRepelStep?0:rateByteFromRom*256;
  const grouped=new Map();
  for(const s of eligible){
    const key=s.internalId+':'+s.level;
    const value=grouped.get(key);
    if(value)value.weight+=s.rollWeight;
    else grouped.set(key,{internalId:s.internalId,level:s.level,weight:s.rollWeight});
  }
  const conditionalSpeciesLevel=[...grouped.values()].map(s=>({
    internalId:s.internalId,level:s.level,slotWeightOutOf256:s.weight,
    probabilityPerEligibleCheck:fraction(rateByteFromRom*s.weight,DENOMINATOR),
    probabilityGivenAcceptedEncounter:weight?fraction(s.weight,weight):null
  })).sort((a,b)=>a.internalId-b.internalId||a.level-b.level);
  return {
    verified:true,romSha256:evidence.romSha256.toLowerCase(),
    scope:'Verificação de encontro pré-validada; NÃO probabilidade universal por passo',
    assumption:'Modelo teórico de hRandomAdd/hRandomSub uniformes e independentes; não prevê RNG futuro',
    repelRemainingAtStart:repelStepsFromRam,
    repelWearsOffWithoutEncounter:lastRepelStep,
    repelFiltersWildLevels:repelFilters,
    firstPartyLevel:firstPartyLevelFromRam,
    encounterRngCheck:fraction(basePairs,DENOMINATOR),
    encounterAccepted:fraction(acceptedPairs,DENOMINATOR),
    blockedByRepel:fraction(blockedPairs,DENOMINATOR),
    noAcceptedEncounter:fraction(DENOMINATOR-acceptedPairs,DENOMINATOR),
    acceptedSlotWeightsOutOf256:weight,conditionalSpeciesLevel,
    source:'pret/pokered/engine/battle/wild_encounters.asm + ROM WildDataPointers'
  };
}
module.exports={wildEncounterCheckOdds,SLOT_WEIGHTS};