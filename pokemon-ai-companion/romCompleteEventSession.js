'use strict';
// Compare all 2,560 RAM event bit positions inside one uninterrupted,
// publication-verified Companion session. A transition is evidence of changed
// bytes between polls, NOT an input, script, action, or completed mission.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const pinned=require('./data/gen1EventNamesPret.json').eventNamesByBit;
const MAX_CHANGES_PER_POLL=64;
const MAX_RECENT=80;
const unavailable=(reason,extra={})=>({
 verified:false,reason,changes:[],changedBits:0,baselineRequired:false,
 resetSuspected:false,playerActionConfirmed:false,gameplayCompleted:false,
 ...extra
});
const guard=id=>Number.isInteger(id)&&id>=0&&id<248;
function inspectBitmap(atlas){
 const sha=String(atlas?.romSha256||'').toLowerCase();
 if(atlas?.verified!==true||!isKnownAuditedRomSha(sha)||
    atlas.allBitPositionsIndexed!==true||
    atlas.gameplaySemanticsCertified!==false||
    atlas.gameplayCompletionCertified!==false||
    atlas.summary?.bitPositionsIndexed!==2560||
    atlas.summary?.namedReferenceBits!==507||
    atlas.summary?.unnamedOrReservedBits!==2053||
    atlas.summary?.ramBytesCorroborated!==320||
    !Array.isArray(atlas.bits)||atlas.bits.length!==2560)
  return null;
 let count=0,named=0;
 const packed=new Uint8Array(320);
 for(let i=0;i<2560;i++){
  const row=atlas.bits[i];
  if(row?.bitIndex!==i||typeof row.flagSet!=='boolean'||
     row.completed!==null||row.semanticMeaningVerified!==false||
     row.availableNow!==null||
     (row.referenceName??null)!==(pinned[i]??null)||
     !Array.isArray(row.candidateMapIds)||
     row.candidateMapIds.some(id=>!guard(id)))
   return null;
  if(row.referenceName!==null)named++;
  if(row.flagSet){packed[i>>3]|=1<<(i&7);count++;}
 }
 if(named!==507||count!==atlas.summary.setBits||
    2560-count!==atlas.summary.clearBits)
  return null;
 return {sha,packed,bits:atlas.bits};
}
function compareCompleteEventBitmaps(before,after,{observedMapId=null}={}){
 const a=inspectBitmap(before),b=inspectBitmap(after);
 if(!a||!b||a.sha!==b.sha)
  return unavailable('ROM/bitmap total não comparáveis');
 if(observedMapId!==null&&!guard(observedMapId))
  return unavailable('ID do mapa observado inválido');
 const changes=[];
 for(let byte=0;byte<320;byte++){
  const diff=a.packed[byte]^b.packed[byte];
  if(!diff)continue;
  for(let bit=0;bit<8;bit++){
   if(!(diff&(1<<bit)))continue;
   const i=byte*8+bit,record=after.bits[i];
   changes.push({
    kind:'WORLD_EVENT_RAM_BIT_TRANSITION',bitIndex:i,
    flagSet:record.flagSet,referenceName:record.referenceName,
    nameFromPinnedReference:record.referenceName!==null,
    candidateMapIds:[...record.candidateMapIds],
    observedPlayerMapId:observedMapId,
    observedPlayerMapIsEventOrigin:false,
    playerActionConfirmed:false,scriptExecutedObserved:false,
    eventCompleted:null
   });
  }
 }
 return {verified:true,romSha256:b.sha,changes,
  changedBits:changes.length,baselineRequired:false,
  resetSuspected:false,playerActionConfirmed:false,
  gameplayCompleted:false,snapshotAtomicVerified:false,
  note:'Diferenças entre duas amostras RAM. Pode ter ocorrido load/reload, scripts ou transições temporárias.'};
}
class CompleteEventBitSession {
 constructor(){this.reset('Aguardar primeiro bitmap válido desta sessão');}
 reset(reason='Sessão RAM interrompida'){
  this.baseline=null;this.sha=null;this.history=[];
  this.reason=reason;return this.status(false);
 }
 status(verified){
  return {verified,romSha256:verified?this.sha:null,
   baselineEstablished:verified&&this.baseline!==null,
   events:this.history.map(e=>({...e,candidateMapIds:[...e.candidateMapIds]})),
   reason:verified?null:this.reason,
   playerActionConfirmed:false,gameplayCompleted:false,
   source:'ONLY_CONSECUTIVE_PUBLICATION_GUARDED_READBACKS'};
 }
 ingest({bitmap,publicationGuardVerified=false,observedMapId=null,
  observedAt=null}={}){
  const b=inspectBitmap(bitmap);
  if(!b||publicationGuardVerified!==true||!guard(observedMapId)){
   const reason='Bitmap, mapa ou leitura final antes da publicação sem prova';
   this.reset(reason);
   return {delta:unavailable(reason),recent:this.status(false)};
  }
  if(this.sha!==b.sha){
   this.reset('ROM mudou: base anterior descartada');
   this.sha=b.sha;
  }
  if(!this.baseline){
   this.baseline=bitmap;
   return {delta:unavailable('Primeira amostra, sem comparação',
    {baselineRequired:true}),recent:this.status(true)};
  }
  const delta=compareCompleteEventBitmaps(this.baseline,bitmap,{observedMapId});
  if(delta.verified!==true){
   this.reset(delta.reason);
   return {delta,recent:this.status(false)};
  }
  // A large jump can mean save/load, core reload, or loss of continuity:
  // never turn hundreds of arbitrary changes into observed game actions.
  if(delta.changedBits>MAX_CHANGES_PER_POLL){
   this.history=[];this.baseline=bitmap;
   return {delta:unavailable(
    'Mais de 64 bits mudaram: possível load/reset ou lacuna entre leituras',
    {resetSuspected:true}),recent:this.status(true)};
  }
  const time=typeof observedAt==='string'&&
   Number.isFinite(Date.parse(observedAt))?observedAt:null;
  for(const event of delta.changes)
   this.history.push({...event,observedAt:time,
    candidateMapIds:[...event.candidateMapIds]});
  if(this.history.length>MAX_RECENT)
   this.history=this.history.slice(-MAX_RECENT);
  this.baseline=bitmap;
  return {delta,recent:this.status(true)};
 }
}
module.exports={inspectBitmap,compareCompleteEventBitmaps,CompleteEventBitSession};
