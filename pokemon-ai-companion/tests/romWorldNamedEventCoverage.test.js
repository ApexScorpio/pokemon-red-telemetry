'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {buildWorldwideNamedEventCoverage}=require('../romWorldNamedEventCoverage');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildNamedEventEvidenceLedger}=require('../romNamedEventEvidenceLedger');
const names=require('../data/gen1EventNamesPret.json').eventNamesByBit;
const mockMaps=()=>Array.from({length:248},(_,mapId)=>({
 mapId,valid:mapId<226,name:mapId<226?'Map '+mapId:null
}));
const bits=()=>Object.entries(names).map(([bit,name])=>({
 eventBitIndex:Number(bit),name,flagSet:false
}));
const fixture=(sha=KNOWN.red)=>{
 const events=bits(),flags=events.map(e=>({
  bitIndex:e.eventBitIndex,referenceEventName:e.name,
  boundActorReferences:[],readerPhysicalOpcodes:[],
  writerSetPhysicalOpcodes:[],writerResetPhysicalOpcodes:[]
 }));
 return {ledger:{verified:true,romSha256:sha,
   summary:{namedReferenceEvents:507,namedBitsWithoutAnyDirectEvidence:507},
   flags},
  worldEventAtlas:{verified:true,romSha256:sha,
   summary:{namedEventBits:507},events},
  mapReferences:mockMaps()};
};
test('248 map IDs and 507 exact names with no ROM bindings yield zero invented locations',()=>{
 const r=buildWorldwideNamedEventCoverage(fixture());
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.maps.length,248);
 assert.equal(r.summary.normalHeaders,226);
 assert.equal(r.maps[61].mapName,'MT_MOON_B2F');
 assert.equal(r.maps[148].mapName,'POKEMON_TOWER_7F');
 assert.equal(r.maps[149].mapName,'MR_FUJIS_HOUSE');
 assert.equal(r.maps[61].mapNameOrigin,'pret/pokered');
 assert.equal(r.maps[61].mapNameIntrinsicToRom,false);
 assert.equal(r.summary.namedBitsWithMapEvidence,0);
 assert.equal(r.unmappedEvents.length,507);
 assert.equal(r.maps.every(x=>x.namedCandidateBits===0),true);
 assert.equal(r.actionsObserved,false);
 assert.equal(r.gameplayComplete,false);
});
test('shared bit creates map candidates in both places without certifying gameplay',()=>{
 const a=fixture(),row=a.ledger.flags.find(x=>x.referenceEventName==='EVENT_GOT_POKE_FLUTE');
 row.boundActorReferences=[
  {mapId:7,x:4,y:9,kind:'NPC',ordinal:1,
   coordinatesFromRomHeader:true,bitBindingEvidence:'ROM_TRAINER_HEADER'}
 ];
 row.writerSetPhysicalOpcodes=[
  {operation:'SET_BIT',opcodeFileOffset:321,referencedMaps:[7,9]}
 ];
 a.ledger.summary.namedBitsWithoutAnyDirectEvidence=506;
 a.worldEventAtlas.events.find(x=>x.name==='EVENT_GOT_POKE_FLUTE').flagSet=true;
 const r=buildWorldwideNamedEventCoverage(a);
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.summary.namedBitsWithMapEvidence,1);
 assert.equal(r.summary.worldCandidateAssociations,2);
 assert.equal(r.summary.multiMapReferencedBits,1);
 assert.equal(r.maps[7].namedCandidateBits,1);
 assert.equal(r.maps[7].flagSetBits,1);
 assert.equal(r.maps[7].events[0].association,'ACTOR_AND_OPCODE');
 assert.equal(r.maps[7].events[0].actorReferences[0].x,4);
 assert.equal(r.maps[9].events[0].association,'OPCODE_HANDLER_ONLY');
 assert.equal(r.maps[9].events[0].eventCompleted,null);
 assert.equal(r.maps[9].events[0].accessibleNow,null);
 assert.equal(r.unmappedEvents.length,506);
});
test('unverified coordinates, conflicting indices and wrong ROM fail closed',()=>{
 for(const invalid of [
  o=>o.mapReferences.pop(),
  o=>o.mapReferences[1].mapId=2,
  o=>o.ledger.flags.pop(),
  o=>o.worldEventAtlas.events.pop(),
  o=>o.worldEventAtlas.romSha256=KNOWN.blue,
  o=>o.worldEventAtlas.events[0].name='EVENT_WRONG',
  o=>o.worldEventAtlas.events[0].eventBitIndex=296,
  o=>o.ledger.flags[0].boundActorReferences=[{
   mapId:12,x:9,y:3,kind:'NPC',ordinal:1,
   bitBindingEvidence:'ROM',coordinatesFromRomHeader:false
  }],
  o=>o.ledger.flags[0].writerSetPhysicalOpcodes=[{
   operation:'SET_BIT',opcodeFileOffset:2,referencedMaps:[248]
  }]
 ]){
  const f=fixture();invalid(f);
  assert.equal(buildWorldwideNamedEventCoverage(f).verified,false);
 }
});
test('advisor and renderer explicitly keep worldwide index as candidates only',()=>{
 const advisor=fs.readFileSync(path.join(__dirname,'../romWorldStateAdvisor.js'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(advisor,/buildWorldwideNamedEventCoverage\(/);
 assert.match(advisor,/romWorldwideNamedEventCoverage:worldwideNamedCoverage/);
 assert.match(app,/MAPAS COM REFERÊNCIAS DE EVENTOS/);
 assert.match(app,/não são missões por concluir/);
});
for(const [variant,env] of [
 ['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
]){
 test('real '+variant+' ROM: all 507 bits classified across 248 map IDs',
 {skip:!process.env[env]?'Original ROM required':false},()=>{
  const buffer=readRom(process.env[env]);
  const profile=inspectRomBuffer(buffer,variant+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[variant]);
  const ledger=buildNamedEventEvidenceLedger({
   atlas:profile.world.interactionScriptAtlas
  });
  assert.equal(ledger.verified,true,ledger.reason);
  const worldEventAtlas={
   verified:true,romSha256:KNOWN[variant],
   summary:{namedEventBits:507},
   // Synthetic zeros are used only to validate the static mapping. They
   // are not reported as measurements from an emulator save.
   events:bits()
  };
  const r=buildWorldwideNamedEventCoverage({
   ledger,worldEventAtlas,mapReferences:profile.world.maps.data
  });
  assert.equal(r.verified,true,r.reason);
  assert.equal(r.summary.mapIds,248);
  assert.equal(r.summary.normalHeaders,226);
  assert.equal(r.maps[61].mapName,'MT_MOON_B2F');
  assert.equal(r.maps[61].mapNameOrigin,'pret/pokered');
  assert.equal(r.maps[61].mapNameIntrinsicToRom,false);
  assert.equal(r.maps[148].mapName,'POKEMON_TOWER_7F');
  assert.equal(r.summary.namedBitsWithNoDirectMapEvidence,107);
  assert.equal(r.summary.namedBitsWithMapEvidence,400);
  assert.equal(r.unmappedEvents.length,107);
  assert.equal(r.summary.worldCandidateAssociations,
   r.maps.reduce((n,m)=>n+m.events.length,0));
  assert.equal(r.summary.namedBitsWithMapEvidence+
   r.summary.namedBitsWithNoDirectMapEvidence,507);
  assert.ok(r.summary.mapIdsWithCandidates>0);
  for(const map of r.maps){
   assert.equal(map.events.length,map.namedCandidateBits);
   assert.equal(map.flagSetBits+map.flagClearBits,map.namedCandidateBits);
   for(const event of map.events){
    assert.equal(event.eventCompleted,null);
    assert.equal(event.accessibleNow,null);
    assert.equal(event.exactLocationProven,false);
    assert.ok(event.actorReferences.length+event.handlerReferences.length>0);
   }
  }
 });
}
