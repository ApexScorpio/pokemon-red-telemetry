'use strict';
// Per-map checklist: static ROM inventory + independently verified event evidence.
// Never turns a geometric route into proof that the item is available now.
// The same (kind,x,y,id) must identify one object on both sides before joining.
const {getMapContents}=require('./romWorldContentsIndex');
const KINDS=Object.freeze({
 visibleItems:'ITEM',hiddenItems:'HIDDEN_ITEM',trainers:'TRAINER',
 npcs:'NPC',stationaryPokemon:'STATIC_POKEMON',signs:'SIGN',warps:'WARP'
});
const ACTIONS=Object.keys(KINDS);
const validId=n=>Number.isInteger(n)&&n>=0&&n<=247;
function buildMapChecklist({index,mapId,advisor=null,scriptAtlas=null,worldFlagLedger=null}={}){
 const entry=getMapContents(index,mapId);
 if(entry.verified!==true)
  return {verified:false,mapId,reason:entry.reason||'Mapa sem cabecalho normal confirmado',
   unresolvedHiddenReferences:entry.unassignedHiddenItems||[],actions:[]};
 const hash=index.romSha256;
 const scriptMap=scriptAtlas?.verified===true&&
  scriptAtlas.romSha256===hash&&
  Array.isArray(scriptAtlas.maps)&&scriptAtlas.maps.length===248&&
  scriptAtlas.maps[mapId]?.verified===true&&
  Array.isArray(scriptAtlas.maps[mapId].interactions)?
  scriptAtlas.maps[mapId]:null;
 const matchingScript=(kind,obj)=>{
  if(!scriptMap||kind==='HIDDEN_ITEM')return null;
  const matches=scriptMap.interactions.filter(s=>s.kind===kind&&
   s.ordinal===obj.ordinal&&s.x===obj.x&&s.y===obj.y&&
   s.rawTextId===obj.textId);
  return matches.length===1?matches[0]:null;
 };
 const advisorMatches=advisor?.verified===true&&advisor.mapId===mapId&&
  advisor.romSha256===hash&&Array.isArray(advisor.observations);
 // One-to-one matching only. Two observations sharing a position are ambiguous.
 const observations=advisorMatches?advisor.observations:[];
 // Global wEventFlags is one 320-byte RAM bitmap for the whole world,
 // but it must come from a verified same-ROM, map-correlated reading.
 // This is independent of whether the player is in this particular map.
 const ledgerMatches=worldFlagLedger?.verified===true&&
  worldFlagLedger.romSha256===hash&&worldFlagLedger.mapCount===226&&
  Array.isArray(worldFlagLedger.mapProgress)&&
  worldFlagLedger.mapProgress.length===226;
 const ledgerRows=ledgerMatches?worldFlagLedger.mapProgress.filter(x=>x?.mapId===mapId):[];
 const ledgerMap=ledgerRows.length===1?ledgerRows[0]:null;
 const identity=(kind,x,y,id)=>kind+':'+x+':'+y+':'+String(id??'');
 const tag=(kind,obj)=>identity(kind,obj.x,obj.y,
  kind==='ITEM'||kind==='HIDDEN_ITEM'?obj.itemId??obj.itemOrTrainerId:
  kind==='SIGN'?obj.textId:
  kind==='TRAINER'?obj.eventBitIndex:
  kind==='WARP'?obj.destinationMapId??obj.destinationMap:null);
 const directId=(kind,item)=>kind==='ITEM'||kind==='HIDDEN_ITEM'?item.itemId??item.itemOrTrainerId:
  kind==='SIGN'?item.textId:
  kind==='TRAINER'?item.eventBitIndex:
  kind==='WARP'?item.destinationMapId??item.destinationMap:null;
 const bySpot=new Map(),byId=new Map();
 for(const o of observations){
  if(!o||typeof o.kind!=='string'||!Number.isInteger(o.x)||!Number.isInteger(o.y))continue;
  const key=o.kind+':'+o.x+':'+o.y;
  bySpot.set(key,(bySpot.get(key)||[]).concat(o));
  const id=directId(o.kind,o);
  if(id!==null&&id!==undefined){
   const k=identity(o.kind,o.x,o.y,id);
   byId.set(k,(byId.get(k)||[]).concat(o));
  }
 }
 const rows=[];
 for(const group of ACTIONS){
  for(const obj of entry.contents[group]||[]){
   const kind=KINDS[group],key=kind+':'+obj.x+':'+obj.y;
   // The static ROM actor's trainer ID is not an event-bit index.
   // Do not match trainers/npcs/mon by coordinate to infer completion.
   const id=(kind==='ITEM'||kind==='HIDDEN_ITEM')?
     (obj.itemId??obj.itemOrTrainerId):
     kind==='SIGN'?obj.textId:
     kind==='WARP'?obj.destinationMap:null;
   const matches=id===null||id===undefined?[]:byId.get(identity(kind,obj.x,obj.y,id))||[];
   const spot=bySpot.get(key)||[];
   const sameKindStatic=entry.contents[group].filter(o=>o.x===obj.x&&o.y===obj.y);
   // Hidden-item status is the bitmap bit for a ROM event index.
   // Matching map, coordinates and item ID is insufficient without that index.
   const sameHiddenBit=kind!=='HIDDEN_ITEM'||
     (Number.isInteger(obj.hiddenIndex)&&
      matches[0]?.hiddenIndex===obj.hiddenIndex);
   const unique=matches.length===1&&spot.length===1&&
     sameKindStatic.length===1&&sameHiddenBit;
   const proof=unique?matches[0]:null;
   let progress='NOT_PROVEN',evidence='ROM_STATIC_ONLY',routeCondition=null;
   if(proof&&kind==='HIDDEN_ITEM'&&advisor.hiddenFlagsVerified===true){
    if(proof.status==='COLLECTED_FLAG'){progress='COLLECTED_CONFIRMED_FLAG';evidence='VERIFIED_HIDDEN_ITEM_RAM_FLAG';}
    else if(proof.status==='NOT_COLLECTED_FLAG'){
     progress='NOT_COLLECTED_CONFIRMED_FLAG';evidence='VERIFIED_HIDDEN_ITEM_RAM_FLAG';
    }
   }
   if(proof&&kind==='ITEM'&&typeof proof.accessStatus==='string'&&
      ['NEEDS_CUT','NEEDS_SURF','NEEDS_CUT_AND_SURF_POSSIBLY',
       'CUT_CAPABILITY_UNKNOWN','SURF_CAPABILITY_UNKNOWN',
       'POSSIBLE_STRENGTH_BARRIER','CONDITIONAL_PATH',
       'NO_SAME_MAP_PATH'].includes(proof.accessStatus))
    routeCondition=proof.accessStatus;
   const romScript=matchingScript(kind,obj);
   let gateFlag=null,gateSource=null;
   if((kind==='TRAINER'||kind==='STATIC_POKEMON')&&
      romScript?.eventBitBindingVerified===true&&
      Number.isInteger(obj.ordinal)&&
      Array.isArray(ledgerMap?.flagRecords?.[
       kind==='TRAINER'?'trainers':'stationaryPokemon'
      ])){
    const domain=kind==='TRAINER'?'trainers':'stationaryPokemon';
    const candidates=ledgerMap.flagRecords[domain].filter(x=>
     x?.objectOrdinal===obj.ordinal&&
     x.bitIndex===romScript.eventBitIndex&&
     x.x===obj.x&&x.y===obj.y&&
     typeof x.flagSet==='boolean');
    if(candidates.length===1){
     gateFlag=candidates[0].flagSet;
     gateSource='ROM_SCRIPT_EVENT_BIT + VERIFIED_GLOBAL_RAM_D747';
     progress=kind==='TRAINER'?
      gateFlag?'TRAINER_GATE_CLOSED_FLAG':'TRAINER_GATE_OPEN_FLAG':
      gateFlag?'ENCOUNTER_GATE_CLOSED_FLAG':'ENCOUNTER_GATE_OPEN_FLAG';
     evidence=gateSource;
    }
   }
   rows.push({group,kind,ordinal:obj.ordinal??obj.hiddenIndex??null,
    x:obj.x,y:obj.y,staticObject:obj,progress,evidence,
    routeCondition,accessibleNow:null,completedNow:null,
    scriptReferenceBound:!!romScript,
    scriptCommand:romScript?.scriptCommand??null,
    scriptTextPointerVerified:romScript?.textPointerVerified===true,
    scriptStaticText:romScript?.staticText??null,
    scriptAsmCandidate:romScript?.asmCandidate??null,
    // Exact ROM/script event bits may be used by the separate live RAM
    // ledger. A static bit binding does not tell whether the bit is set.
    scriptEventBitIndex:romScript?.eventBitBindingVerified===true?
     romScript.eventBitIndex:null,
    scriptEventBitBindingVerified:romScript?.eventBitBindingVerified===true,
    scriptEventBitBindingSource:romScript?.eventBitBindingSource??null,
    scriptEventBitMeaning:romScript?.eventBitMeaning??null,
    scriptEventFlagSet:gateFlag,
    scriptEventFlagSnapshotVerified:gateFlag!==null,
    scriptEventFlagEvidence:gateSource,
    scriptEffectSemanticsVerified:false,
    predictedOutcomeVerified:false,
    joinProven:!!proof,
    requiresLiveScripts:true});
  }
 }
 return {verified:true,mapId,romSha256:hash,
  staticIndexVerified:true,advisorEvidenceMatched:advisorMatches,
  actions:rows,unresolvedHiddenReferences:[],
  summary:{total:rows.length,
   confirmedCollected:rows.filter(r=>r.progress==='COLLECTED_CONFIRMED_FLAG').length,
   confirmedNotCollected:rows.filter(r=>r.progress==='NOT_COLLECTED_CONFIRMED_FLAG').length,
   needsCutCandidates:rows.filter(r=>r.routeCondition==='NEEDS_CUT').length,
   needsSurfCandidates:rows.filter(r=>r.routeCondition==='NEEDS_SURF').length,
   progressUnverified:rows.filter(r=>r.progress==='NOT_PROVEN').length,
   verifiedTrainerGatesClosed:rows.filter(r=>
    r.progress==='TRAINER_GATE_CLOSED_FLAG').length,
   verifiedTrainerGatesOpen:rows.filter(r=>
    r.progress==='TRAINER_GATE_OPEN_FLAG').length,
   verifiedEncounterGatesClosed:rows.filter(r=>
    r.progress==='ENCOUNTER_GATE_CLOSED_FLAG').length,
   verifiedEncounterGatesOpen:rows.filter(r=>
    r.progress==='ENCOUNTER_GATE_OPEN_FLAG').length,
   verifiedScriptEventFlagStates:rows.filter(r=>
    r.scriptEventFlagSnapshotVerified===true).length,
   scriptReferencesBound:rows.filter(r=>r.scriptReferenceBound).length},
  scriptAtlasBound:scriptMap!==null,
  routeCertainty:'LOCAL_GEOMETRY_ONLY',
  globalStateCertified:false};
}
module.exports={buildMapChecklist};
