'use strict';
// World flag changes only belong to a continuous, verified live observation
// session. Persisted JSON is NEVER a baseline for an event delta.
const {diffCampaignProgress}=require('./romCampaignDelta');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
class CampaignFlagSession {
 constructor(){this.reset('Aguardando primeira amostra RAM desta sessão');}
 reset(reason='Sessão interrompida'){
   this.sha=null;this.baseline=null;this.events=[];
   this.publishedScope=null;
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
 // Only use this entrypoint for the live Companion. A checked ledger and
 // early map read do not prove its RAM read is safe to publish.
 ingestPublished({ledger,romIdentityMatched=false,mapWindowVerified=false,
   publicationGuardVerified=false,targetHost,targetPort,targetGeneration,
   pollSequence,observedAt=null}={}){
   const reject=reason=>{
     this.reset(reason);
     return {delta:{verified:false,changes:[],reason,
       playerActionConfirmed:false},recent:this.status(false)};
   };
   const sha=ledger?.romSha256;
   if(!isKnownAuditedRomSha(sha)||ledger?.verified!==true||
      ledger.mapCount!==226||romIdentityMatched!==true||
      mapWindowVerified!==true||publicationGuardVerified!==true||
      typeof targetHost!=='string'||!targetHost||
      !Number.isInteger(targetPort)||targetPort<1||targetPort>65535||
      !Number.isSafeInteger(targetGeneration)||targetGeneration<0||
      !Number.isSafeInteger(pollSequence)||pollSequence<1)
     return reject('MISSING_PUBLISHED_CAMPAIGN_PROOF');
   const scope={sha,targetHost,targetPort,targetGeneration,pollSequence};
   const prior=this.publishedScope;
   // A missed poll, target swap, or ROM change cannot form evidence of
   // a game action. In all cases keep the next valid reading as baseline.
   if(prior&&(prior.sha!==scope.sha||
      prior.targetHost!==scope.targetHost||
      prior.targetPort!==scope.targetPort||
      prior.targetGeneration!==scope.targetGeneration||
      prior.pollSequence+1!==scope.pollSequence))
     this.reset('CAMPAIGN_PUBLICATION_SCOPE_CHANGED');
   // Never elevate a baseline created by the legacy ingest API.
   if(!prior&&this.baseline)this.reset('UNGUARDED_CAMPAIGN_BASELINE');
   const report=this.ingest({
     ledger,romIdentityMatched:true,mapWindowVerified:true,observedAt
   });
   if(report.recent.verified===true)this.publishedScope=scope;
   return report;
 }
}
module.exports={CampaignFlagSession};
