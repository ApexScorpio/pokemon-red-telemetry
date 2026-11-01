'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=app.indexOf('function selectVerifiedMinimapStaticEncounterMarkers(state) {');
const end=app.indexOf('// Renderizador do Mini-Mapa Tático',start);
assert.ok(start>=0&&end>start,'Missing static encounter selector');
const select=vm.runInNewContext(app.slice(start,end)+
 '\nselectVerifiedMinimapStaticEncounterMarkers;',{}, {timeout:1500});
const RED='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const BLUE='2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d';
const GREEN='aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db';
function state(sha=GREEN,x=5,y=10){
 const mapId=227,window={verified:true,mapId,x:10,y:11};
 const action={kind:'STATIC_POKEMON',ordinal:1,x,y,
  romActorCoordinateAndAttributeVerified:true,
  romActorVariantEvidence:'SAME_SHA_ROM_MAP_OBJECT_AND_SCRIPT_REFERENCE',
  romActorSpeciesInternalId:131,romActorLevel:70,
  scriptReferenceBound:true,scriptTextPointerVerified:true,
  progress:'NOT_PROVEN',accessibleNow:null,completedNow:null,
  staticObject:{source:'ROM_MAP_OBJECT_BYTES',kind:'wildPokemon',
   ordinal:1,x,y,wildSpeciesInternalId:131,wildLevel:70}};
 return {connected:true,mapId,coords:{x:10,y:11},
  lastUpdate:new Date().toISOString(),
  romRuntimeIdentity:{matched:true,profileSha256:sha},
  memoryReadStatus:{verified:true,positionWindow:{...window},
   latePositionWindow:{...window},publicationPositionWindow:{...window}},
  worldAdvisor:{verified:true,mapId,romSha256:sha,
   fullWorldStaticIndexVerified:true,mapChecklist:{
    verified:true,mapId,romSha256:sha,
    actorAttributeAtlasBound:true,scriptAtlasBound:true,
    summary:{boundStaticActorAttributes:1},actions:[action]}}
 };
}
const list=s=>Array.from(select(s));
test('Red and Green fixed encounter sites use their own ROM coordinates',()=>{
 const red=list(state(RED,27,13)),green=list(state(GREEN,5,10));
 assert.deepEqual(red.map(m=>[m.x,m.y]),[[27,13]]);
 assert.deepEqual(green.map(m=>[m.x,m.y]),[[5,10]]);
 assert.equal(red[0].speciesInternalId,131);
 assert.equal(green[0].level,70);
});
test('Blue exact ROM can show a static site without live presence claims',()=>{
 const b=list(state(BLUE,27,13));
 assert.equal(b.length,1);
 assert.equal(b[0].presentNow,null);
 assert.equal(b[0].accessibleNow,null);
 assert.equal(b[0].completedNow,null);
 assert.equal(b[0].evidence,'STATIC_ENCOUNTER_FROM_SHA_AUDITED_ACTIVE_ROM');
});
test('a closed encounter event flag remains only a static gate hint',()=>{
 const s=state();
 s.worldAdvisor.mapChecklist.actions[0].progress='ENCOUNTER_GATE_CLOSED_FLAG';
 const a=list(s);
 assert.equal(a.length,1);
 assert.equal(a[0].eventGateClosedCandidate,true);
 assert.equal(a[0].presentNow,null);
});
test('disconnect, stale RAM or switched map and ROM all fail closed',()=>{
 const bad=[
  s=>{s.connected=false;},s=>{s.lastUpdate='2020-01-01T00:00:00Z';},
  s=>{s.mapId=226;},s=>{s.memoryReadStatus.publicationPositionWindow.mapId=226;},
  s=>{s.coords.x=11;},s=>{s.romRuntimeIdentity.matched=false;},
  s=>{s.romRuntimeIdentity.profileSha256=RED;},
  s=>{s.worldAdvisor.mapChecklist.romSha256=RED;},
  s=>{s.worldAdvisor.fullWorldStaticIndexVerified=false;},
  s=>{s.worldAdvisor.mapChecklist.scriptAtlasBound=false;},
  s=>{s.worldAdvisor.mapChecklist.actorAttributeAtlasBound=false;}
 ];
 for(const f of bad){const s=state();f(s);assert.equal(list(s).length,0);}
});
test('forged species, level, map position and access status are refused',()=>{
 const bad=[
  a=>{a.romActorSpeciesInternalId=25;},a=>{a.romActorLevel=50;},
  a=>{a.romActorCoordinateAndAttributeVerified=false;},
  a=>{a.scriptTextPointerVerified=false;},
  a=>{a.romActorVariantEvidence='MANUAL';},
  a=>{a.staticObject.x=27;},a=>{a.staticObject.source='MANUAL';},
  a=>{a.accessibleNow=true;},a=>{a.completedNow=true;},
  a=>{a.ordinal=2;}
 ];
 for(const f of bad){const s=state();f(s.worldAdvisor.mapChecklist.actions[0]);assert.equal(list(s).length,0);}
});
test('duplicate object ordinal or tile does not double the marker',()=>{
 for(const alter of [
  a=>({...a}),
  a=>({...a,ordinal:2,staticObject:{...a.staticObject,ordinal:2}})
 ]){
  const s=state(),a=s.worldAdvisor.mapChecklist.actions[0];
  s.worldAdvisor.mapChecklist.actions.push(alter(a));
  assert.equal(list(s).length,0);
 }
});
test('maps without stationary encounters do not invent markers',()=>{
 const s=state();s.worldAdvisor.mapChecklist.actions=[];
 s.worldAdvisor.mapChecklist.summary.boundStaticActorAttributes=0;
 assert.equal(list(s).length,0);
});
test('small minimap draws a faded static ghost, never a present sprite',()=>{
 const a=app.indexOf('  const fixedEncounters=selectVerifiedMinimapStaticEncounterMarkers(state);');
 const b=app.indexOf('  const entitySnapshot = getMapEntitySnapshot(state);',a);
 assert.ok(a>=0&&b>a);
 const calls=[];
 vm.runInNewContext(app.slice(a,b),{
  state:state(),camX:0,camY:0,tileSize:24,cw:1500,ch:1500,ctxFog:{},
  selectVerifiedMinimapStaticEncounterMarkers:select,
  drawMapEntity:(ctx,ent,x,y,scale,ghost)=>calls.push({ent,ghost})
 },{timeout:1500});
 assert.equal(calls.length,1);
 assert.equal(calls[0].ent.icon,'✨');
 assert.equal(calls[0].ent.staticEncounter,true);
 assert.equal(calls[0].ent.isGhost,true);
 assert.equal(calls[0].ent.presentNow,null);
 assert.equal(calls[0].ghost,true);
});
test('enlarged map uses the same exact site and faded ghost evidence',()=>{
 const first=app.indexOf('  const fixedEncounters=selectVerifiedMinimapStaticEncounterMarkers(state);');
 const second=app.indexOf('  const fixedEncounters=selectVerifiedMinimapStaticEncounterMarkers(state);',first+20);
 const end=app.indexOf('  const entitySnapshot = getMapEntitySnapshot(state);',second);
 assert.ok(first>=0&&second>first&&end>second);
 const calls=[];
 vm.runInNewContext(app.slice(second,end),{
  state:state(RED,27,13),originX:0,originY:0,tilePx:24,
  cw:1500,ch:1500,gtaZoom:1,ctxGta:{},
  selectVerifiedMinimapStaticEncounterMarkers:select,
  drawMapEntity:(ctx,ent,x,y,scale,ghost)=>calls.push({ent,ghost})
 },{timeout:1500});
 assert.equal(calls.length,1);
 assert.equal(calls[0].ent.x,27);assert.equal(calls[0].ent.y,13);
 assert.equal(calls[0].ent.icon,'✨');assert.equal(calls[0].ghost,true);
});
test('both map views share the same static encounter selector',()=>{
 assert.equal((app.match(/const fixedEncounters=selectVerifiedMinimapStaticEncounterMarkers\(state\)/g)||[]).length,2);
 assert.equal((app.match(/staticEncounter:true,presentNow:null/g)||[]).length,2);
});

test('existing pickup marker renderer slices remain isolated from new encounter drawing',()=>{
 const first=app.indexOf('  const markers=selectVerifiedMinimapItemMarkers(state);');
 const firstEnd=app.indexOf('  // Só mostrar entidades lidas agora da RAM.',first);
 const second=app.indexOf('  const markers=selectVerifiedMinimapItemMarkers(state);',first+20);
 const secondEnd=app.indexOf('  // 3. Apenas entidades reais presentes na RAM',second);
 assert.ok(first>=0&&firstEnd>first&&second>first&&secondEnd>second);
 assert.doesNotMatch(app.slice(first,firstEnd),/fixedEncounters/);
 assert.doesNotMatch(app.slice(second,secondEnd),/fixedEncounters/);
});
