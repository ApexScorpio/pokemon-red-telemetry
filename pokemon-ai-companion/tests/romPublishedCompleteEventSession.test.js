'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {CompleteEventBitSession}=require('../romCompleteEventSession');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const pinned=require('../data/gen1EventNamesPret.json').eventNamesByBit;
const RED=AUDITED_ROM_SHA256.RED,BLUE=AUDITED_ROM_SHA256.BLUE;
const bitmap=(sha=RED,on=[])=>{
 const active=new Set(on);
 return {verified:true,romSha256:sha,allBitPositionsIndexed:true,
  gameplaySemanticsCertified:false,gameplayCompletionCertified:false,
  summary:{bitPositionsIndexed:2560,namedReferenceBits:507,
   unnamedOrReservedBits:2053,ramBytesCorroborated:320,
   setBits:active.size,clearBits:2560-active.size},
  bits:Array.from({length:2560},(_,bitIndex)=>({
   bitIndex,flagSet:active.has(bitIndex),
   referenceName:pinned[bitIndex]||null,candidateMapIds:[],
   semanticMeaningVerified:false,completed:null,availableNow:null
  }))
 };
};
const publish=(session,b,pollSequence,options={})=>
 session.ingestPublished({
  bitmap:b,observedMapId:15,
  observedAt:'2026-10-31T22:16:00Z',
  romIdentityMatched:true,positionVerified:true,
  publicationGuardVerified:true,targetHost:'192.0.2.20',
  targetPort:55355,targetGeneration:0,pollSequence,...options
 });
test('initial published full bitmap establishes no event transitions',()=>{
 const s=new CompleteEventBitSession(),r=publish(s,bitmap(),1);
 assert.equal(r.delta.verified,false);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.baselineEstablished,true);
 assert.equal(r.recent.events.length,0);
});
test('two consecutive full bitmaps expose changed named and unnamed bits',()=>{
 const s=new CompleteEventBitSession();publish(s,bitmap(),1);
 const r=publish(s,bitmap(RED,[192,2559]),2);
 assert.equal(r.delta.verified,true);
 assert.deepEqual(r.delta.changes.map(x=>x.bitIndex),[192,2559]);
 assert.equal(r.delta.changes[0].playerActionConfirmed,false);
 assert.equal(r.delta.changes[0].eventCompleted,null);
});
test('missing poll number breaks continuity and resets baseline',()=>{
 const s=new CompleteEventBitSession();publish(s,bitmap(),1);
 const r=publish(s,bitmap(RED,[192]),3);
 assert.equal(r.delta.verified,false);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
});
test('host change refuses cross-emulator attribution',()=>{
 const s=new CompleteEventBitSession();publish(s,bitmap(),1);
 const r=publish(s,bitmap(RED,[192]),2,{targetHost:'192.0.2.21'});
 assert.equal(r.delta.verified,false);
 assert.equal(r.recent.events.length,0);
});
test('port change refuses cross-emulator attribution',()=>{
 const s=new CompleteEventBitSession();publish(s,bitmap(),1);
 const r=publish(s,bitmap(RED,[192]),2,{targetPort:55356});
 assert.equal(r.delta.verified,false);
});
test('target generation blocks switching away and back to same socket',()=>{
 const s=new CompleteEventBitSession();publish(s,bitmap(),1);
 const r=publish(s,bitmap(RED,[192]),2,{targetGeneration:2});
 assert.equal(r.delta.verified,false);
 assert.equal(r.recent.events.length,0);
});
test('Red to Blue changes get a new first-sample baseline',()=>{
 const s=new CompleteEventBitSession();publish(s,bitmap(),1);
 const r=publish(s,bitmap(BLUE,[192]),2);
 assert.equal(r.delta.verified,false);
 assert.equal(r.recent.romSha256,BLUE);
});
test('failed last-position proof clears prior session and history',()=>{
 const s=new CompleteEventBitSession();publish(s,bitmap(),1);
 publish(s,bitmap(RED,[192]),2);
 const r=publish(s,bitmap(RED,[192,2559]),3,{positionVerified:false});
 assert.equal(r.delta.verified,false);
 assert.equal(r.recent.verified,false);
 assert.equal(r.recent.events.length,0);
});
test('missing publication guard does not establish a full bitmap baseline',()=>{
 const s=new CompleteEventBitSession();
 const r=publish(s,bitmap(),1,{publicationGuardVerified:false});
 assert.equal(r.recent.verified,false);
 assert.equal(publish(s,bitmap(RED,[192]),2).delta.baselineRequired,true);
});
test('bulk change suppression persists and next poll compares to refreshed baseline',()=>{
 const s=new CompleteEventBitSession();publish(s,bitmap(),1);
 const batch=Array.from({length:65},(_,i)=>i+700);
 const big=publish(s,bitmap(RED,batch),2);
 assert.equal(big.delta.resetSuspected,true);
 assert.equal(big.recent.events.length,0);
 const next=publish(s,bitmap(RED,[...batch,192]),3);
 assert.equal(next.delta.verified,true);
 assert.deepEqual(next.delta.changes.map(x=>x.bitIndex),[192]);
});
test('unpublished legacy sample cannot be reused as published baseline',()=>{
 const s=new CompleteEventBitSession();
 s.ingest({bitmap:bitmap(),publicationGuardVerified:true,observedMapId:15});
 const r=publish(s,bitmap(RED,[192]),2);
 assert.equal(r.delta.verified,false);
 assert.equal(r.delta.baselineRequired,true);
 assert.equal(r.recent.events.length,0);
});
test('Companion full bitmap ingestion is after final position and target gate',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const check=src.indexOf('const targetScopeStable=matchesTargetScope(this,pollTargetScope)');
 const named=src.indexOf('this._worldReferenceSession.ingestPublished({');
 const full=src.indexOf('this._completeEventBitSession.ingestPublished({');
 const persist=src.lastIndexOf('this.persistState(this.latestState);');
 assert.ok(check>0&&named>check&&full>named&&persist>full);
 assert.equal(src.includes('this._completeEventBitSession.ingest({'),false);
 const chunk=src.slice(full,persist);
 assert.match(chunk,/publicationGuardVerified:matchesTargetScope\(this,pollTargetScope\)/);
 assert.match(chunk,/targetGeneration:pollTargetScope\.generation/);
 assert.match(chunk,/pollSequence:this\._scriptedBattlePollSequence/);
});
