'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=app.indexOf('function selectVerifiedMinimapTrainerGateMarkers(state) {');
const end=app.indexOf('// Renderizador do Mini-Mapa Tático',start);
assert.ok(start>=0&&end>start,'Trainer ROM map-site selector absent');
const select=vm.runInNewContext(app.slice(start,end)+
 '\nselectVerifiedMinimapTrainerGateMarkers;',{}, {timeout:1500});
const SHAS=[
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
];
function sample(sha=SHAS[0],gate=null){
 const mapId=15,p={verified:true,mapId,x:10,y:11};
 const actor={source:'ROM_MAP_OBJECT_BYTES',kind:'trainer',
  ordinal:2,x:9,y:2,spriteId:15,textId:65};
 const entry={kind:'TRAINER',group:'trainers',ordinal:2,x:9,y:2,
  staticObject:actor,scriptReferenceBound:true,
  scriptTextPointerVerified:true,scriptEventFlagSnapshotVerified:gate!==null,
  scriptEventFlagSet:gate,
  scriptEventFlagEvidence:gate===null?null:
   'ROM_SCRIPT_EVENT_BIT + VERIFIED_GLOBAL_RAM_D747',
  scriptEventBitBindingVerified:gate!==null,
  scriptEventBitIndex:gate===null?null:155,
  progress:gate===null?'NOT_PROVEN':
    gate?'TRAINER_GATE_CLOSED_FLAG':'TRAINER_GATE_OPEN_FLAG',
  accessibleNow:null,completedNow:null};
 return {connected:true,mapId,coords:{x:10,y:11},
  lastUpdate:new Date().toISOString(),
  romRuntimeIdentity:{matched:true,profileSha256:sha},
  memoryReadStatus:{verified:true,positionWindow:{...p},
   latePositionWindow:{...p},publicationPositionWindow:{...p}},
  worldAdvisor:{verified:true,mapId,romSha256:sha,
   fullWorldStaticIndexVerified:true,mapChecklist:{
    verified:true,mapId,romSha256:sha,staticIndexVerified:true,
    scriptAtlasBound:true,actions:[entry]}}
 };
}
const markers=s=>Array.from(select(s));
test('Red Blue Green ROM trainer sites show only matching static map coordinates',()=>{
 for(const sha of SHAS){
  const got=markers(sample(sha));
  assert.equal(got.length,1);
  assert.equal(got[0].x,9);assert.equal(got[0].y,2);
  assert.equal(got[0].kind,'TRAINER_ROM_SITE');
  assert.equal(got[0].ordinal,2);
  assert.equal(got[0].gateFlagSet,null);
 }
});
test('trainer gate closed is not battle won, sprite present or quest completed',()=>{
 const t=markers(sample(SHAS[0],true))[0];
 assert.equal(t.gateFlagSet,true);
 assert.equal(t.gateVerified,true);
 assert.equal(t.battleWon,null);
 assert.equal(t.presentNow,null);
 assert.equal(t.accessibleNow,null);
 assert.equal(t.completedNow,null);
});
test('trainer gate open is flag evidence only and does not guarantee fight',()=>{
 const t=markers(sample(SHAS[1],false))[0];
 assert.equal(t.gateFlagSet,false);
 assert.equal(t.gateVerified,true);
 assert.equal(t.battleWon,null);
 assert.equal(t.accessibleNow,null);
});
test('unknown gate is safe and does not assert a RAM bit',()=>{
 const t=markers(sample())[0];
 assert.equal(t.gateFlagSet,null);
 assert.equal(t.gateVerified,false);
 assert.equal(t.presentNow,null);
});
test('unknown ROM, disconnected state and wrong map suppress trainer site',()=>{
 const mutate=[
  s=>{s.connected=false;},
  s=>{s.romRuntimeIdentity.matched=false;},
  s=>{s.romRuntimeIdentity.profileSha256='0'.repeat(64);},
  s=>{s.worldAdvisor.romSha256=SHAS[2];},
  s=>{s.worldAdvisor.mapChecklist.romSha256=SHAS[2];},
  s=>{s.worldAdvisor.mapChecklist.scriptAtlasBound=false;},
  s=>{s.worldAdvisor.fullWorldStaticIndexVerified=false;},
  s=>{s.mapId=14;}
 ];
 for(const change of mutate){const s=sample();change(s);assert.equal(markers(s).length,0);}
});
test('stale or inconsistent triple RAM position never creates trainer ghost',()=>{
 const mutate=[
  s=>{s.lastUpdate='2020-01-01T00:00:00Z';},
  s=>{s.memoryReadStatus.verified=false;},
  s=>{s.memoryReadStatus.positionWindow.x=1;},
  s=>{s.memoryReadStatus.latePositionWindow.y=1;},
  s=>{s.memoryReadStatus.publicationPositionWindow.mapId=14;},
  s=>{s.coords.x=11;}
 ];
 for(const change of mutate){const s=sample();change(s);assert.equal(markers(s).length,0);}
});
test('unverified trainer script is excluded rather than guessed',()=>{
 for(const change of [
  a=>{a.scriptReferenceBound=false;},
  a=>{a.scriptTextPointerVerified=false;}
 ]){
  const s=sample();change(s.worldAdvisor.mapChecklist.actions[0]);
  assert.equal(markers(s).length,0);
 }
});
test('forged ROM trainer actor ordinal, kind, tile and source fail closed',()=>{
 for(const change of [
  a=>{a.staticObject.source='MANUAL';},
  a=>{a.staticObject.kind='npc';},
  a=>{a.staticObject.ordinal=3;},
  a=>{a.staticObject.x=8;},
  a=>{a.x=255;},
  a=>{a.group='npcs';},
  a=>{a.staticObject.spriteId=300;},
  a=>{a.staticObject.textId=null;}
 ]){
  const s=sample();change(s.worldAdvisor.mapChecklist.actions[0]);
  assert.equal(markers(s).length,0);
 }
});
test('contradictory D747 bit and gate evidence never claim victory',()=>{
 for(const change of [
  a=>{a.progress='TRAINER_GATE_OPEN_FLAG';},
  a=>{a.scriptEventFlagSet=null;},
  a=>{a.scriptEventBitIndex=-1;},
  a=>{a.scriptEventFlagEvidence='MANUAL';},
  a=>{a.scriptEventBitBindingVerified=false;},
  a=>{a.scriptEventFlagSnapshotVerified=false;}
 ]){
  const s=sample(SHAS[0],true);
  change(s.worldAdvisor.mapChecklist.actions[0]);
  assert.equal(markers(s).length,0);
 }
});
test('duplicate ordinal or tile suppresses competing trainer ghosts',()=>{
 for(const make of [
  a=>({...a}),
  a=>({...a,ordinal:3,staticObject:{...a.staticObject,ordinal:3}})
 ]){
  const s=sample(),row=s.worldAdvisor.mapChecklist.actions[0];
  s.worldAdvisor.mapChecklist.actions.push(make(row));
  assert.equal(markers(s).length,0);
 }
});
test('other maps and empty world trainer lists do not invent a trainer',()=>{
 const s=sample();s.worldAdvisor.mapChecklist.actions=[];
 assert.equal(markers(s).length,0);
 const other=sample();other.worldAdvisor.mapChecklist.actions[0].kind='STATIC_POKEMON';
 assert.equal(markers(other).length,0);
});
test('minimap draws trainer site as a ghost distinct from live sprite RAM',()=>{
 const a=app.indexOf('  // Physical trainer reference, NOT an old/live sprite');
 const b=app.indexOf('  // Only SHA-verified static encounter ghosts',a);
 assert.ok(a>=0&&b>a);
 const calls=[];
 vm.runInNewContext(app.slice(a,b),{
  state:sample(SHAS[0],true),camX:0,camY:0,tileSize:24,
  cw:1500,ch:1500,ctxFog:{},
  selectVerifiedMinimapTrainerGateMarkers:select,
  drawMapEntity:(ctx,e,x,y,scale,ghost)=>calls.push({e,ghost})
 },{timeout:1500});
 assert.equal(calls.length,1);
 assert.equal(calls[0].e.icon,'⚔️');
 assert.equal(calls[0].e.trainerRomSite,true);
 assert.equal(calls[0].e.battleWon,null);
 assert.equal(calls[0].ghost,true);
});
test('enlarged map uses the same trainer-gate selection and faded marker',()=>{
 const a=app.indexOf('  // Same static trainer references in the enlarged map');
 const b=app.indexOf('  // Enlarged map uses the same exact ROM/RAM guard',a);
 assert.ok(a>=0&&b>a);
 const calls=[];
 vm.runInNewContext(app.slice(a,b),{
  state:sample(SHAS[2],false),originX:0,originY:0,tilePx:24,
  cw:1500,ch:1500,gtaZoom:1,ctxGta:{},
  selectVerifiedMinimapTrainerGateMarkers:select,
  drawMapEntity:(ctx,e,x,y,scale,ghost)=>calls.push({e,ghost})
 },{timeout:1500});
 assert.equal(calls.length,1);
 assert.equal(calls[0].e.trainerRomSite,true);
 assert.equal(calls[0].e.gateFlagSet,false);
 assert.equal(calls[0].ghost,true);
});
test('VRAM camera caption gives trainer tile without fabricated pixel alignment',()=>{
 const a=app.indexOf('function selectVerifiedMinimapItemMarkers(state)');
 const b=app.indexOf('// Renderizador do Mini-Mapa Tático',a);
 assert.ok(a>=0&&b>a);
 const funcs=vm.runInNewContext(app.slice(a,b)+
  '\ndescribeVerifiedVramStaticLocationEvidence;',{}, {timeout:1500});
 const desc=funcs(sample(SHAS[0],true));
 assert.match(desc,/⚔️ X:9 Y:2/);
 assert.match(desc,/portão fechado por flag, vitória não comprovada/);
 assert.doesNotMatch(desc,/derrotado|vitória confirmada/i);
});
