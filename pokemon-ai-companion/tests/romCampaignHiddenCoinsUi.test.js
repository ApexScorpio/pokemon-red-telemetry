'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {decodeHiddenCoins}=require('../romEventState');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=app.search(/\bfunction\s+formatCampaignChecklistSection\s*\(/);
const end=app.indexOf('\nfunction renderWorldAdvisor(state)',start);
assert.ok(start>=0&&end>start,'Actual campaign formatter unavailable');
const format=vm.runInNewContext(app.slice(start,end)+'\nformatCampaignChecklistSection;',{}, {timeout:1500});
const SHAS=['5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'];
function sample(sha=SHAS[0],flags=['00','00']){
 const mapId=135,coins=decodeHiddenCoins({hash:{sha256:sha}},mapId,flags);
 assert.equal(coins.verified,true);
 const pos={verified:true,mapId,x:9,y:5};
 const observations=coins.coins.map(c=>({kind:'HIDDEN_COIN',mapId,
  x:c.x,y:c.y,coinAmount:c.actualAwardIfClaimed,
  status:c.isCollected?'COIN_COLLECTED_FLAG':'COIN_NOT_COLLECTED_FLAG'}));
 const advice={verified:true,mapId,romSha256:sha,
  fullWorldStaticIndexVerified:true,observations,
  campaignSummary:{allStaticActions:1992,normalMaps:226,
   unresolvedMapIds:22,observedMapCount:1,scriptReferencesBound:1126},
  mapChecklist:{verified:true,mapId,romSha256:sha,
   summary:{total:0,confirmedCollected:0,confirmedNotCollected:0,
    progressUnverified:0,needsCutCandidates:0,needsSurfCandidates:0},
   actions:[]}};
 const state={connected:true,mapId,coords:{x:9,y:5},
  lastUpdate:new Date().toISOString(),
  romRuntimeIdentity:{matched:true,profileSha256:sha},
  memoryReadStatus:{verified:true,positionWindow:{...pos},
   latePositionWindow:{...pos},publicationPositionWindow:{...pos}},
  romHiddenCoins:coins};
 return {advice,state};
}
const show=x=>Array.from(format(x.advice,x.state)).join('\n');
test('Red Blue Green Game Corner lists twelve original ROM coin locations',()=>{
 for(const sha of SHAS){
  const out=show(sample(sha));
  assert.match(out,/12 EVENTOS DE MOEDAS OCULTAS/);
  assert.equal((out.match(/• Moeda oculta #/g)||[]).length,12);
  assert.match(out,/Bits assinalados: 0\/12/);
  assert.match(out,/não incluídas no contador de objetos/);
 }
});
test('D6FE bit 0 and bit 11 are separate events with no reward claim',()=>{
 const out=show(sample(SHAS[1],['01','08']));
 assert.match(out,/Bits assinalados: 2\/12/);
 assert.match(out,/Moeda oculta #0 [^\n]*assinalado/);
 assert.match(out,/Moeda oculta #11 [^\n]*assinalado/);
 assert.match(out,/Moeda oculta #9 [^\n]*não assinalado/);
 assert.doesNotMatch(out,/recompensa recebida|fichas creditadas/i);
});
test('wrong ROM, stale RAM, map switch and invalid bitmap hide coin checklist',()=>{
 const mutations=[
  x=>{x.state.connected=false;},
  x=>{x.state.lastUpdate='2020-01-01T00:00:00Z';},
  x=>{x.state.mapId=15;},
  x=>{x.state.romRuntimeIdentity.profileSha256=SHAS[2];},
  x=>{x.state.romHiddenCoins.romSha256=SHAS[2];},
  x=>{x.state.romHiddenCoins.verified=false;},
  x=>{x.state.memoryReadStatus.positionWindow.x=5;},
  x=>{x.state.memoryReadStatus.publicationPositionWindow.mapId=15;},
  x=>{x.state.coords.y=6;}
 ];
 for(const mutate of mutations){
  const x=sample();mutate(x);
  assert.doesNotMatch(show(x),/12 EVENTOS DE MOEDAS OCULTAS/);
 }
});
test('duplicate, altered coordinates, stale flag and fake source fail closed',()=>{
 const mutations=[
  x=>{x.state.romHiddenCoins.coins[1].hiddenIndex=0;},
  x=>{x.state.romHiddenCoins.coins[1].x=x.state.romHiddenCoins.coins[0].x;
       x.state.romHiddenCoins.coins[1].y=x.state.romHiddenCoins.coins[0].y;},
  x=>{x.state.romHiddenCoins.coins[0].isCollected=true;},
  x=>{x.state.romHiddenCoins.coins[0].coinAmount=999;},
  x=>{x.state.romHiddenCoins.coins.pop();},
  x=>{x.advice.observations[0].x=255;},
  x=>{x.advice.observations[0].status='UNKNOWN';},
  x=>{x.state.romHiddenCoins.source='MANUAL';}
 ];
 for(const mutate of mutations){
  const x=sample();mutate(x);
  assert.doesNotMatch(show(x),/12 EVENTOS DE MOEDAS OCULTAS/);
 }
});
test('untrusted 64 hex ROM cannot certify coin rows even if other data agree',()=>{
 const x=sample();const unknown='0'.repeat(64);
 x.advice.romSha256=unknown;x.advice.mapChecklist.romSha256=unknown;
 x.state.romRuntimeIdentity.profileSha256=unknown;
 x.state.romHiddenCoins.romSha256=unknown;
 assert.doesNotMatch(show(x),/12 EVENTOS DE MOEDAS OCULTAS/);
});
