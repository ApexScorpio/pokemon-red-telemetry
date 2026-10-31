'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildMapNamedEventEvidence}=require('../romMapNamedEventEvidence');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildNamedEventEvidenceLedger}=require('../romNamedEventEvidenceLedger');
const pinned=require('../data/gen1EventNamesPret.json');
const sha=KNOWN.red;
const names=Object.entries(pinned.eventNamesByBit).map(([bit,name])=>({
 eventBitIndex:Number(bit),name,flagSet:false
}));
const ledger=()=>({
 verified:true,romSha256:sha,summary:{namedReferenceEvents:507},
 flags:names.map(e=>({
  bitIndex:e.eventBitIndex,referenceEventName:e.name,
  boundActorReferences:[],readerPhysicalOpcodes:[],
  writerSetPhysicalOpcodes:[],writerResetPhysicalOpcodes:[]
 }))
});
const live=()=>({verified:true,romSha256:sha,
 summary:{namedEventBits:507},events:names.map(x=>({...x}))});
test('same bit joins only with mapped actor/ROM handler and never certifies action',()=>{
 const l=ledger(),a=live();
 const bit=names.find(x=>x.name==='EVENT_GOT_POKE_FLUTE').eventBitIndex;
 const row=l.flags.find(x=>x.bitIndex===bit);
 row.boundActorReferences=[
  {mapId:20,ordinal:1,kind:'NPC',x:8,y:11,
   coordinatesFromRomHeader:true,bitBindingEvidence:'ROM_HEADER'},
  {mapId:21,ordinal:2,kind:'NPC',x:7,y:9,
   coordinatesFromRomHeader:true,bitBindingEvidence:'ROM_HEADER'}
 ];
 row.readerPhysicalOpcodes=[{
  operation:'BIT_TEST',opcodeFileOffset:3000,referencedMaps:[20,23]
 }];
 a.events.find(x=>x.eventBitIndex===bit).flagSet=true;
 const r=buildMapNamedEventEvidence({
  ledger:l,worldEventAtlas:a,mapId:20
 });
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.events.length,1);
 assert.equal(r.events[0].name,'EVENT_GOT_POKE_FLUTE');
 assert.equal(r.events[0].eventBitIndex,296);
 assert.equal(r.events[0].flagSet,true);
 assert.equal(r.events[0].localEvidence,'ACTOR_AND_OPCODE');
 assert.equal(r.events[0].actorReferences.length,1);
 assert.deepEqual([r.events[0].actorReferences[0].x,
  r.events[0].actorReferences[0].y],[8,11]);
 assert.equal(r.events[0].actorReferences[0].coordinatesFromRomHeader,true);
 assert.equal(r.events[0].romOpcodeReferences.length,1);
 assert.equal(r.events[0].eventCompleted,null);
 assert.equal(r.events[0].playerActionConfirmed,false);
 assert.equal(r.events[0].resultOrRewardCertified,false);
 assert.equal(r.summary.mapEventBitCandidates,1);
 assert.equal(buildMapNamedEventEvidence({
  ledger:l,worldEventAtlas:a,mapId:22
 }).events.length,0);
 const neighbor=buildMapNamedEventEvidence({
  ledger:l,worldEventAtlas:a,mapId:21
 });
 assert.equal(neighbor.events[0].localEvidence,'ACTOR_HEADER_ONLY');
 assert.equal(neighbor.events[0].actorReferences[0].x,7);
 assert.equal(neighbor.events[0].actorReferences[0].y,9);
 assert.equal(buildMapNamedEventEvidence({
  ledger:l,worldEventAtlas:a,mapId:23
 }).events[0].localEvidence,'OPCODE_HANDLER_ONLY');
});
test('reference names cannot be silently used to infer a map by their words',()=>{
 const r=buildMapNamedEventEvidence({
  ledger:ledger(),worldEventAtlas:live(),mapId:20
 });
 assert.equal(r.verified,true);
 assert.equal(r.events.length,0);
 assert.equal(r.summary.flagsSet,0);
});
test('refuse malformed event bits, bad map and wrong ROM identities',()=>{
 for(const changes of [
  {mapId:248},{mapId:-1},{mapId:null},
  {worldEventAtlas:{...live(),romSha256:'0'.repeat(64)}},
  {worldEventAtlas:{...live(),events:[]}},
  {ledger:{...ledger(),flags:[]}}
 ]){
  const input={ledger:ledger(),worldEventAtlas:live(),mapId:20,...changes};
  assert.equal(buildMapNamedEventEvidence(input).verified,false);
 }
 const a=live();a.events[0].eventBitIndex=296;
 assert.equal(buildMapNamedEventEvidence({
  ledger:ledger(),worldEventAtlas:a,mapId:20
 }).verified,false);
 const l=ledger();
 l.flags[0].boundActorReferences=[{
  mapId:20,kind:'TRAINER',ordinal:1,x:6,y:7,
  bitBindingEvidence:'ROM_HEADER'
 }];
 assert.equal(buildMapNamedEventEvidence({
  ledger:l,worldEventAtlas:live(),mapId:20
 }).verified,false,'Missing coordinate provenance must fail closed');
});
test('pipeline passes corroborated event atlas to global map advisor',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const src=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const start=src.indexOf('this.latestState.worldAdvisor=adviseWorld({');
 assert.ok(start>0);
 assert.match(src.slice(start,start+300),
  /namedWorldEventAtlas:this\.latestState\.romWorldEventAtlas/);
});
for(const [variant,env] of [
 ['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('ROM real '+variant+': every mapped event links to an actual header/ASM candidate',
 {skip:!process.env[env]?'Original ROM required':false},()=>{
  const buffer=readRom(process.env[env]);
  const profile=inspectRomBuffer(buffer,variant+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[variant]);
  const l=buildNamedEventEvidenceLedger({
   atlas:profile.world.interactionScriptAtlas
  });
  assert.equal(l.verified,true,l.reason);
  const worldEventAtlas={
   verified:true,romSha256:KNOWN[variant],
   summary:{namedEventBits:507},
   events:names.map(e=>({...e}))
  };
  let seen=0;
  for(let mapId=0;mapId<248;mapId++){
   const result=buildMapNamedEventEvidence({
    ledger:l,worldEventAtlas,mapId
   });
   assert.equal(result.verified,true,result.reason);
   for(const e of result.events){
    assert.ok(e.actorReferences.length+e.romOpcodeReferences.length>0);
    assert.equal(e.flagSet,false);
    assert.equal(e.eventCompleted,null);
    for(const a of e.actorReferences){
     assert.ok(Number.isInteger(a.x)&&a.x>=0&&a.x<=255);
     assert.ok(Number.isInteger(a.y)&&a.y>=0&&a.y<=255);
     assert.equal(a.coordinatesFromRomHeader,true);
    }
    assert.equal(e.playerActionConfirmed,false);
    assert.equal(e.exactEventLocationProven,false);
    seen++;
   }
  }
  assert.ok(seen>0,'ROM actor or opcode mapped event evidence expected');
 });
}
