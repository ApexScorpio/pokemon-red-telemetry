'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const RetroArchClient=require('../retroarchClient');
const keys=[
 'romMap','romWildEncounters','mapEntities','romStaticMapGuide',
 'romItemAccess','romTerrainCurrentTile','romTerrainWarpHints',
 'romMovementOptions','romAreaEvidence','romLiveActorIdentification',
 'romTrainerFlags','romHiddenItems','romHiddenCoins'
];
function snapshot(){
 const state={
  connected:true,isSimulation:false,
  trainerName:'RED',areaInfo:{name:'Route 4'},
  mapId:15,mapName:'Route 4',party:[{name:'PIKACHU',level:20}],
  badges:[{name:'Boulder',obtained:true}],
  actionHistory:[{text:'old history'}],
  dialogHistory:[{text:'old dialog'}],
  lastUpdate:'2026-10-31T22:48:00Z',
  videoMemory:{tilePatterns:[12]}
 };
 for(const key of keys)state[key]=
  key==='romMap'?{mapId:15,valid:true}:
  key==='romWildEncounters'?{verified:true,slots:[1]}:
  key==='mapEntities'?[{x:1,y:1}]:{verified:true,items:[{x:1,y:1}]};
 return state;
}
function interceptPersist(state){
 const writes=[],old=fs.writeFileSync;
 fs.writeFileSync=(p,content)=>writes.push({
  path:String(p),state:JSON.parse(content)
 });
 try{RetroArchClient.prototype.persistState(state);}
 finally{fs.writeFileSync=old;}
 return writes;
}
function interceptLoad(state){
 const e=fs.existsSync,r=fs.readFileSync;
 fs.existsSync=()=>true;fs.readFileSync=()=>JSON.stringify(state);
 try{return RetroArchClient.prototype.loadPersistedState();}
 finally{fs.existsSync=e;fs.readFileSync=r;}
}
function fakeLive(){
 const c=Object.create(RetroArchClient.prototype);
 c.latestState=snapshot();
 return c;
}
test('cache projection omits every stale observed world UI field',()=>{
 const writes=interceptPersist(snapshot());
 assert.equal(writes.length,2);
 for(const {state} of writes)
  for(const key of keys)assert.equal(Object.hasOwn(state,key),false,key);
});
test('cached metadata continues to preserve trainer party and map location',()=>{
 for(const {state} of interceptPersist(snapshot())){
  assert.equal(state.trainerName,'RED');
  assert.equal(state.party[0].name,'PIKACHU');
  assert.equal(state.mapId,15);
  assert.equal(state.mapName,'Route 4');
  assert.equal(state.badges[0].obtained,true);
 }
});
test('live map UI is not changed by persistence-only projection',()=>{
 const state=snapshot(),original=state.romMap;
 interceptPersist(state);
 assert.equal(state.romMap,original);
 assert.equal(state.mapEntities.length,1);
});
test('two snapshots exclude same ephemeral fields consistently',()=>{
 const writes=interceptPersist(snapshot());
 assert.deepEqual(writes[0].state,writes[1].state);
 assert.ok(writes.every(x=>x.path.endsWith(
  path.join('data','last_known_state.json'))));
});
test('legacy disk snapshot cannot restore old ROM map and encounters',()=>{
 const out=interceptLoad(snapshot());
 assert.equal(Object.hasOwn(out,'romMap'),false);
 assert.equal(Object.hasOwn(out,'romWildEncounters'),false);
 assert.equal(Object.hasOwn(out,'mapEntities'),false);
});
test('legacy disk snapshot cannot restore stale world UI guide fields',()=>{
 const out=interceptLoad(snapshot());
 for(const key of keys)assert.equal(Object.hasOwn(out,key),false,key);
});
test('old cache still carries party and historical metadata as disconnected',()=>{
 const out=interceptLoad(snapshot());
 assert.equal(out.connected,false);
 assert.equal(out.mapName,'Route 4');
 assert.equal(out.party.length,1);
 assert.equal(out.actionHistory[0].text,'old history');
});
test('world invalidation drops live map drawing and wild encounter slots',()=>{
 const c=fakeLive();c.invalidateWorldEvidence('SCOPE_INVALID');
 assert.equal(c.latestState.romMap,null);
 assert.equal(c.latestState.romWildEncounters,null);
 assert.deepEqual(c.latestState.mapEntities,[]);
});
test('world invalidation marks all access and visibility evidence unverified',()=>{
 const c=fakeLive();c.invalidateWorldEvidence('RAM_INCOMPLETE');
 for(const key of keys.filter(x=>![
  'romMap','romWildEncounters','mapEntities'
 ].includes(x)))
  assert.equal(c.latestState[key].verified,false,key);
});
test('world invalidation does not delete party, map text, badges or logs',()=>{
 const c=fakeLive();c.invalidateWorldEvidence('TARGET_SWITCH');
 assert.equal(c.latestState.party[0].name,'PIKACHU');
 assert.equal(c.latestState.mapName,'Route 4');
 assert.equal(c.latestState.badges[0].obtained,true);
 assert.equal(c.latestState.actionHistory[0].text,'old history');
});
test('invalidating twice leaves all observed world UI evidence discarded',()=>{
 const c=fakeLive();
 c.invalidateWorldEvidence('ONE');c.invalidateWorldEvidence('TWO');
 assert.equal(c.latestState.romMap,null);
 assert.equal(c.latestState.romItemAccess.verified,false);
 assert.equal(c.latestState.romItemAccess.reason,'TWO');
 assert.deepEqual(c.latestState.mapEntities,[]);
});
test('source keeps all stale fields out of load and persisted projections',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const load=source.slice(source.indexOf('  loadPersistedState() {'),
  source.indexOf('  persistState(state) {'));
 const persist=source.slice(source.indexOf('  persistState(state) {'),
  source.indexOf('  loadPersistedActionHistory() {'));
 for(const key of keys){
  assert.ok(load.includes("'"+key+"'"),key+' load');
  assert.ok(persist.includes("'"+key+"'"),key+' persist');
 }
});
