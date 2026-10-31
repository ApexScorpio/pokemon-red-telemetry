'use strict';
// An observed map-script byte transition is NOT a battle, victory, item,
// button press, actor removal, or causally proven story event. No I/O here.
// Consecutive published polls, matching ROM/map/target, are mandatory.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const LABELS=Object.freeze({
 96:['SCRIPT_SSANNE2F_DEFAULT','SCRIPT_SSANNE2F_RIVAL_START_BATTLE',
  'SCRIPT_SSANNE2F_RIVAL_AFTER_BATTLE','SCRIPT_SSANNE2F_RIVAL_EXIT',
  'SCRIPT_SSANNE2F_NOOP'],
 135:['SCRIPT_GAMECORNER_DEFAULT','SCRIPT_GAMECORNER_ROCKET_BATTLE',
  'SCRIPT_GAMECORNER_ROCKET_EXIT']
});
const MAX_EVENTS=40;
const fail=(reason,more={})=>({
 verified:false,reason,changes:[],changedBytes:0,
 baselineRequired:false,playerActionConfirmed:false,
 battleWon:null,gameplayCompleted:false,...more});
function checked(sample,sha,mapId){
 if(!isKnownAuditedRomSha(sha)||(mapId!==96&&mapId!==135)||
    sample?.verified!==true||
    sample.status!=='SCRIPT_BYTE_REPEATED_REFERENCE_ONLY'||
    sample.mapId!==mapId||
    sample.readOnly!==true||sample.readOnlyReadCalls!==2||
    sample.readOnlyRequests!==2||
    sample.snapshotAtomicVerified!==false||
    sample.gameProgressCertified!==false||sample.battleWon!==null||
    sample.source!=='TWO_MATCHING_READ_ONLY_RAM_SAMPLES_FROM_MATCHED_ROM_AND_MAP'||
    !Number.isInteger(sample.scriptValue)||
    sample.scriptValue<0||sample.scriptValue>255||
    sample.referenceStateName!==(LABELS[mapId][sample.scriptValue]??null))
  return null;
 return {mapId,sha,value:sample.scriptValue,
  referenceLabel:sample.referenceStateName};
}
class ScriptedBattleStateSession{
 constructor(){this.reset('Aguardar duas publicacoes consecutivas comprovadas');}
 reset(reason='Leitura ou contexto interrompido'){
  this.scope=null;this.baseline=null;this.events=[];
  this.reason=reason;
  return this.status(false);
 }
 status(active){
  const ok=active===true&&this.baseline!==null;
  return {verified:ok,baselineEstablished:ok,
   mapId:ok?this.scope.mapId:null,
   romSha256:ok?this.scope.sha:null,
   currentScriptByte:ok?this.baseline.value:null,
   referenceStateName:ok?this.baseline.referenceLabel:null,
   events:this.events.map(x=>({...x})),reason:ok?null:this.reason,
   snapshotAtomicVerified:false,playerActionConfirmed:false,
   battleWon:null,gameplayCompleted:false,
   source:'CONSECUTIVE_PUBLICATION_GUARDED_SCRIPT_BYTE_READBACKS'};
 }
 ingest({sample,romSha256,mapId,targetHost,targetPort,
  publicationGuardVerified=false,pollSequence,observedAt=null}={}){
  const value=checked(sample,romSha256,mapId);
  const timestamp=typeof observedAt==='string'&&
   Number.isFinite(Date.parse(observedAt))?Date.parse(observedAt):null;
  if(!value||publicationGuardVerified!==true||
     typeof targetHost!=='string'||!targetHost||
     !Number.isInteger(targetPort)||targetPort<1||targetPort>65535||
     !Number.isSafeInteger(pollSequence)||pollSequence<1||
     timestamp===null){
   const reason='Amostra RAM, alvo ou publicacao do mapa sem continuidade';
   this.reset(reason);
   return {delta:fail(reason),recent:this.status(false)};
  }
  const key={sha:value.sha,mapId,targetHost,targetPort};
  const prior=this.scope;
  const comparable=prior!==null&&this.baseline!==null&&
   prior.sha===key.sha&&prior.mapId===key.mapId&&
   prior.targetHost===key.targetHost&&prior.targetPort===key.targetPort&&
   pollSequence===this.baseline.pollSequence+1&&
   timestamp>this.baseline.timestamp;
  if(!comparable){
   this.reset('Mudanca de ROM, mapa, alvo ou intervalo entre publicacoes');
   this.scope=key;
   this.baseline={...value,pollSequence,timestamp};
   return {delta:fail('Primeira amostra da sequencia; nenhuma transicao',
    {baselineRequired:true}),recent:this.status(true)};
  }
  const changes=[];
  if(value.value!==this.baseline.value){
   changes.push({
    kind:'SCRIPT_BYTE_CHANGED_BETWEEN_VERIFIED_POLLS',
    romSha256:value.sha,mapId,
    fromScriptByte:this.baseline.value,toScriptByte:value.value,
    fromReferenceState:this.baseline.referenceLabel,
    toReferenceState:value.referenceLabel,
    referenceStateNamesOnly:true,
    observedAt:new Date(timestamp).toISOString(),
    observedPollSequence:pollSequence,
    snapshotAtomicVerified:false,
    controlFlowVerified:false,playerActionConfirmed:false,
    battleWon:null,gameplayCompleted:false,
    wasCausedByPlayer:null
   });
   this.events.push(changes[0]);
   if(this.events.length>MAX_EVENTS)
    this.events=this.events.slice(-MAX_EVENTS);
  }
  this.baseline={...value,pollSequence,timestamp};
  return {delta:{verified:true,romSha256:value.sha,mapId,changes,
   changedBytes:changes.length,baselineRequired:false,
   snapshotAtomicVerified:false,playerActionConfirmed:false,
   battleWon:null,gameplayCompleted:false,
   warning:'Mudanca observada entre polls; sem prova de acao ou vitoria.'},
   recent:this.status(true)};
 }
}
module.exports={ScriptedBattleStateSession};
