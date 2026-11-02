'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=source.indexOf('function formatCampaignChecklistSection(advice,state) {');
const end=source.indexOf('\nfunction renderWorldAdvisor(state)',start);
assert.ok(start>=0&&end>start,'Campaign formatter unavailable');
const format=vm.runInNewContext(source.slice(start,end)+
  '\nformatCampaignChecklistSection;',{}, {timeout:1500});
const SHAS=[
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
];
function sample(sha=SHAS[0],kind='TRAINER',flag=true){
 const mapId=15,pos={verified:true,mapId,x:10,y:11};
 const isTrainer=kind==='TRAINER';
 const actor={source:'ROM_MAP_OBJECT_BYTES',
  kind:isTrainer?'trainer':'wildPokemon',
  ordinal:2,x:9,y:2,spriteId:15,textId:65};
 const entry={kind,group:isTrainer?'trainers':'stationaryPokemon',
  ordinal:2,x:9,y:2,staticObject:actor,
  scriptReferenceBound:true,scriptTextPointerVerified:true,
  scriptEventBitBindingVerified:true,scriptEventBitIndex:155,
  scriptEventFlagSnapshotVerified:true,scriptEventFlagSet:flag,
  scriptEventFlagEvidence:'ROM_SCRIPT_EVENT_BIT + VERIFIED_GLOBAL_RAM_D747',
  progress:(isTrainer?'TRAINER':'ENCOUNTER')+'_GATE_'+
   (flag?'CLOSED':'OPEN')+'_FLAG',
  accessibleNow:null,completedNow:null};
 const advice={verified:true,mapId,romSha256:sha,
  fullWorldStaticIndexVerified:true,
  campaignSummary:{allStaticActions:1992,normalMaps:226,
   unresolvedMapIds:22,observedMapCount:1,scriptReferencesBound:1126},
  mapChecklist:{verified:true,mapId,romSha256:sha,
   scriptAtlasBound:true,
   summary:{total:1,confirmedCollected:0,confirmedNotCollected:0,
    progressUnverified:0,needsCutCandidates:0,needsSurfCandidates:0},
   actions:[entry]}};
 const state={connected:true,mapId,coords:{x:10,y:11},
  lastUpdate:new Date().toISOString(),
  romRuntimeIdentity:{matched:true,profileSha256:sha},
  memoryReadStatus:{verified:true,
   positionWindow:{...pos},latePositionWindow:{...pos},
   publicationPositionWindow:{...pos}}};
 return {advice,state,entry};
}
const row=x=>Array.from(format(x.advice,x.state))
 .find(line=>line.startsWith('• Treinador')||
   line.startsWith('• Pokémon fixo'))||'';
test('Red Blue Green: treinador com D747 bit assinalado mostra portão fechado',()=>{
 for(const sha of SHAS){
  const s=sample(sha);const out=row(s);
  assert.match(out,/bit D747 assinalado/);
  assert.match(out,/portão de combate fechado por flag/);
  assert.match(out,/vitória, presença, acesso e resultado não comprovados/);
 }
});
test('Red Blue Green: D747 bit não assinalado mostra portão aberto sem garantir combate',()=>{
 for(const sha of SHAS){
  const out=row(sample(sha,'TRAINER',false));
  assert.match(out,/bit D747 não assinalado/);
  assert.match(out,/portão de combate aberto por flag/);
  assert.doesNotMatch(out,/vitória confirmada|derrotado|acesso garantido/i);
 }
});
test('encontro estático usa o seu próprio domínio de gate e não certifica captura',()=>{
 for(const flag of [false,true]){
  const out=row(sample(SHAS[1],'STATIC_POKEMON',flag));
  assert.match(out,/portão de encontro/);
  assert.match(out,/resultado não comprovados/);
  assert.doesNotMatch(out,/capturado|recompensa recebida/i);
 }
});
test('sem prova de evento e bit booleano não há apresentação certificada',()=>{
 for(const mutate of [
  s=>{s.entry.scriptEventFlagSnapshotVerified=false;},
  s=>{s.entry.scriptEventFlagSet=null;},
  s=>{s.entry.scriptEventBitBindingVerified=false;},
  s=>{s.entry.scriptEventBitIndex=2560;},
  s=>{s.entry.scriptEventFlagEvidence='MANUAL';},
  s=>{s.entry.progress='NOT_PROVEN';}
 ]){
  const s=sample();mutate(s);
  assert.doesNotMatch(row(s),/bit D747/);
 }
});
test('ROM desconhecida, sessão offline, mapa incoerente ou RAM antiga apagam rótulos',()=>{
 for(const mutate of [
  s=>{s.state.connected=false;},
  s=>{s.state.romRuntimeIdentity.matched=false;},
  s=>{s.state.romRuntimeIdentity.profileSha256='0'.repeat(64);},
  s=>{s.state.mapId=14;},
  s=>{s.state.lastUpdate='2020-01-01T00:00:00Z';},
  s=>{s.state.memoryReadStatus.verified=false;},
  s=>{s.state.memoryReadStatus.positionWindow.x=9;},
  s=>{s.state.memoryReadStatus.publicationPositionWindow.mapId=14;},
  s=>{s.state.coords.y=12;},
  s=>{s.advice.mapChecklist.scriptAtlasBound=false;}
 ]){
  const s=sample();mutate(s);
  assert.doesNotMatch(row(s),/bit D747/);
 }
});
test('coordenadas, ordinal e proveniência ROM do ator são obrigatórios',()=>{
 for(const mutate of [
  a=>{a.staticObject.source='MANUAL';},
  a=>{a.staticObject.kind='npc';},
  a=>{a.staticObject.ordinal=3;},
  a=>{a.staticObject.x=8;},
  a=>{a.staticObject.y=3;},
  a=>{a.ordinal=null;},
  a=>{a.scriptReferenceBound=false;},
  a=>{a.scriptTextPointerVerified=false;}
 ]){
  const s=sample();mutate(s.entry);
  assert.doesNotMatch(row(s),/bit D747/);
 }
});
test('progress contraditório ou estados de acesso/conclusão inventados falham fechados',()=>{
 for(const mutate of [
  a=>{a.progress='TRAINER_GATE_OPEN_FLAG';},
  a=>{a.progress='ENCOUNTER_GATE_CLOSED_FLAG';},
  a=>{a.accessibleNow=true;},
  a=>{a.completedNow=true;}
 ]){
  const s=sample();mutate(s.entry);
  assert.doesNotMatch(row(s),/bit D747/);
 }
});
test('sem mapa e SHA coincidentes não publica qualquer checklist',()=>{
 for(const mutate of [
  s=>{s.advice.mapChecklist.mapId=16;},
  s=>{s.advice.mapChecklist.romSha256=SHAS[2];},
  s=>{s.advice.fullWorldStaticIndexVerified=false;},
  s=>{s.advice.verified=false;}
 ]){
  const s=sample();mutate(s);
  assert.deepEqual(Array.from(format(s.advice,s.state)),[]);
 }
});
