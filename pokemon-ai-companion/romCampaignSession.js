'use strict';
// World flag changes only belong to a continuous, verified live observation
// session. Persisted JSON is NEVER a baseline for an event delta.
const {diffCampaignProgress}=require('./romCampaignDelta');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
class CampaignFlagSession {
 constructor(){this.reset('Aguardando primeira amostra RAM desta sessão');}
 reset(reason='Sessão interrompida'){
   this.sha=null;this.baseline=null;this.events=[];
   this.reason=reason;return this.status(false);
 }
 status(verified){
   return {verified,romSha256:verified?this.sha:null,
     events:this.events.map(x=>({...x})),actionsProven:false,
     source:'DIFF_QUE_NUNCA_COMPARA_ESTADO_PERSISTIDO',
     baselineEstablished:verified&&this.baseline!==null,
     reason:verified?null:this.reason};
 }
 ingest({ledger,romIdentityMatched=false,mapWindowVerified=false,
   observedAt=null}={}){
   const sha=ledger?.romSha256;
   if(!romIdentityMatched||!mapWindowVerified||ledger?.verified!==true||
      !isKnownAuditedRomSha(sha)||ledger.mapCount!==226)
     return {delta:{verified:false,changes:[],
       reason:'Identidade, mapa ou progresso atual não confirmado'},
       recent:this.reset('Leitura RAM interrompida ou ROM sem identidade validada')};
   if(this.sha!==sha){
     this.reset('ROM mudou, histórico de flags anterior invalidado');
     this.sha=sha;
   }
   const delta=diffCampaignProgress({
     previous:this.baseline,current:ledger,observedAt
   });
   if(delta.resetSuspected===true){
     this.events=[];this.baseline=ledger;
     this.reason='Contadores diminuíram: referência anterior invalidada';
     return {delta:{...delta,changes:[]},recent:this.status(true)};
   }
   if(delta.verified!==true&&!delta.baselineRequired){
     // Malformed or mismatched bit records invalidate the entire timeline.
     // Do not quietly carry older events into a new inconsistent snapshot.
     this.events=[];
     this.baseline=null;
     this.reason=delta.reason||'Diferença ROM/RAM sem validação';
     return {delta:{...delta,changes:[]},recent:this.status(false)};
   }
   if(delta.verified===true){
     this.events.push(...delta.changes.map(e=>({...e,observedAt})));
     this.events=this.events.slice(-80);
   }
   // A confirmed new reading becomes the baseline even when no prior
   // reading existed; it never generates events on that first reading.
   this.baseline=ledger;
   this.reason=null;
   return {delta,recent:this.status(true)};
 }
}
module.exports={CampaignFlagSession};
