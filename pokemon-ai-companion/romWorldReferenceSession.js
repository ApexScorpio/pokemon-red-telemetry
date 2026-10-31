'use strict';
// Session-scoped changes to all named Gen I reference event/toggle bits.
// A bit transition is not proof that a move, battle, pickup or script ran.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const EMPTY_REASON='Aguardar duas leituras verificadas da mesma ROM';
// Same conservative bulk-change threshold as romCompleteEventSession.js.
// More than this many changed reference records may signal save/load/reset;
// neither source proves causality or an atomic frame.
const MAX_PUBLISHED_CHANGES=64;
const unavailable=(reason)=>({verified:false,reason,changes:[],
  baselineEstablished:false,actionConfirmed:false});
const validAtlas=a=>a?.verified===true&&isKnownAuditedRomSha(a.romSha256)&&
  a.summary?.namedEventBits===507&&a.summary?.referenceToggleBits===228&&
  Array.isArray(a.events)&&a.events.length===507&&
  Array.isArray(a.toggleFlags)&&a.toggleFlags.length===228&&
  a.events.every(x=>typeof x.name==='string'&&Number.isInteger(x.eventBitIndex)&&
    x.eventBitIndex>=0&&x.eventBitIndex<2560&&typeof x.flagSet==='boolean')&&
  a.toggleFlags.every((x,i)=>x.toggleIndex===i&&
    Number.isInteger(x.mapId)&&x.mapId>=0&&x.mapId<248&&
    typeof x.name==='string'&&typeof x.removedFlagSet==='boolean');
function compareReferenceBits(before,after){
 if(!validAtlas(before)||!validAtlas(after)||before.romSha256!==after.romSha256)
   return unavailable('Catálogos ROM/RAM não comparáveis');
 const events=[],seen=new Set();
 for(let i=0;i<507;i++){
   const old=before.events[i],now=after.events[i];
   if(old.name!==now.name||old.eventBitIndex!==now.eventBitIndex||
      seen.has(now.eventBitIndex))return unavailable('Atlas dos eventos alterado');
   seen.add(now.eventBitIndex);
   if(old.flagSet!==now.flagSet)events.push({
     kind:'NAMED_EVENT_BIT_CHANGED',name:now.name,
     eventBitIndex:now.eventBitIndex,flagSet:now.flagSet,
     locationFromRomVerified:false,playerActionConfirmed:false});
 }
 for(let i=0;i<228;i++){
   const old=before.toggleFlags[i],now=after.toggleFlags[i];
   if(old.name!==now.name||old.mapId!==now.mapId)
     return unavailable('Atlas dos toggles alterado');
   if(old.removedFlagSet!==now.removedFlagSet)events.push({
     kind:'OBJECT_TOGGLE_BIT_CHANGED',name:now.name,
     mapId:now.mapId,toggleIndex:i,flagSet:now.removedFlagSet,
     itemCollectedConfirmed:false,currentVisibilityConfirmed:false,
     playerActionConfirmed:false});
 }
 return {verified:true,romSha256:after.romSha256,
   changes:events,changedBits:events.length,actionConfirmed:false,
   snapshotAtomicVerified:false,scriptEffectsComplete:false,
   note:'Transições de flags ROM/RAM; não são prova causal de ação nem conclusão de missão.'};
}
class WorldReferenceFlagSession{
 constructor(){this.reset();}
 reset(reason=EMPTY_REASON){
   this.baseline=null;this.events=[];this.sha=null;this.reason=reason;
   this.publishedScope=null;
   return this.status(false);
 }
 status(verified){
   return {verified,romSha256:verified?this.sha:null,
     baselineEstablished:verified&&!!this.baseline,
     events:this.events.map(x=>({...x})),
     reason:verified?null:this.reason,
     actionConfirmed:false,scriptEffectsComplete:false};
 }
 ingest({atlas,observedAt=null}={}){
   if(!validAtlas(atlas)){
     this.reset('Referências, identidade ou RAM não verificadas');
     return {delta:unavailable(this.reason),recent:this.status(false)};
   }
   if(this.sha!==atlas.romSha256){
     this.reset('Perfil ROM alterado: reiniciar provas');
     this.sha=atlas.romSha256;
   }
   if(!this.baseline){
     this.baseline=atlas;
     return {delta:unavailable(EMPTY_REASON),recent:this.status(true)};
   }
   const delta=compareReferenceBits(this.baseline,atlas);
   if(!delta.verified){
     this.reset(delta.reason);
     return {delta,recent:this.status(false)};
   }
   const when=typeof observedAt==='string'&&!Number.isNaN(Date.parse(observedAt))?
     observedAt:null;
   if(delta.changes.length){
     this.events.push(...delta.changes.map(x=>({...x,observedAt:when})));
     this.events=this.events.slice(-80);
   }
   this.baseline=atlas;
   return {delta,recent:this.status(true)};
 }
 // This is the only path the live client uses. A valid event atlas alone
 // does not prove a publishable RAM sample or consecutive observation.
 ingestPublished({atlas,observedAt=null,romIdentityMatched=false,
   positionVerified=false,publicationGuardVerified=false,
   targetHost,targetPort,targetGeneration,pollSequence}={}){
   const deny=reason=>{
     this.reset(reason);
     return {delta:unavailable(reason),recent:this.status(false)};
   };
   if(!validAtlas(atlas)||romIdentityMatched!==true||
      positionVerified!==true||publicationGuardVerified!==true||
      typeof targetHost!=='string'||!targetHost||
      !Number.isInteger(targetPort)||targetPort<1||targetPort>65535||
      !Number.isSafeInteger(targetGeneration)||targetGeneration<0||
      !Number.isSafeInteger(pollSequence)||pollSequence<1)
     return deny('MISSING_PUBLISHED_NAMED_EVENT_PROOF');
   const scope={sha:atlas.romSha256,targetHost,targetPort,
     targetGeneration,pollSequence};
   const prior=this.publishedScope;
   // Any scope change or lost poll breaks comparison; the next valid
   // sample becomes a fresh baseline, never an inferred event transition.
   if(prior&&(prior.sha!==scope.sha||
      prior.targetHost!==scope.targetHost||
      prior.targetPort!==scope.targetPort||
      prior.targetGeneration!==scope.targetGeneration||
      prior.pollSequence+1!==scope.pollSequence))
     this.reset('NAMED_EVENT_PUBLICATION_SCOPE_CHANGED');
   if(!prior&&this.baseline)
     this.reset('UNGUARDED_BASELINE_NOT_REUSABLE');
   if(this.baseline){
     const batch=compareReferenceBits(this.baseline,atlas);
     if(batch.verified===true&&batch.changedBits>MAX_PUBLISHED_CHANGES){
       // Two individually valid readbacks can still bracket a save load,
       // core reset or other discontinuity. Do not publish bulk events as
       // campaign progress; keep only the new baseline and its scope.
       const reason='NAMED_EVENTS_BULK_JUMP_POSSIBLE_SAVE_LOAD_OR_RESET';
       this.reset(reason);
       this.sha=atlas.romSha256;
       this.baseline=atlas;
       this.publishedScope=scope;
       return {delta:{
         ...unavailable(reason),changedBits:batch.changedBits,
         resetSuspected:true,comparisonSuppressed:true,
         publishedChangeLimit:MAX_PUBLISHED_CHANGES,
         playerActionConfirmed:false,gameplayCompleted:false
       },recent:this.status(true)};
     }
   }
   const report=this.ingest({atlas,observedAt});
   if(report.recent.verified===true)this.publishedScope=scope;
   return report;
 }
}
module.exports={compareReferenceBits,WorldReferenceFlagSession,MAX_PUBLISHED_CHANGES};
