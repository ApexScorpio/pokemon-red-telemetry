'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const RetroArchClient=require('../retroarchClient');
function fixture(){
 return {
  connected:true,isSimulation:false,lastUpdate:'2026-10-31T22:45:00Z',
  trainerName:'RED',areaInfo:{name:'Route 4'},mapId:15,
  party:[{name:'PIKACHU',level:20}],badges:[],
  actionHistory:[{text:'Action retained'}],
  dialogHistory:[{text:'Dialog retained'}],
  videoMemory:{tilePatterns:Array(6144).fill(12),
   bgTileMap:Array(1024).fill(3),oam:Array(160).fill(1)},
  worldRecentFlagChanges:{verified:true,events:[{stale:true}]},
  globalCampaignLedger:{verified:true,mapProgress:Array(226).fill({})}
 };
}
function interceptWrite(state){
 const captured=[];
 const original=fs.writeFileSync;
 fs.writeFileSync=(p,data,encoding)=>{
  captured.push({path:String(p),value:JSON.parse(data),encoding});
 };
 try{RetroArchClient.prototype.persistState(state);}
 finally{fs.writeFileSync=original;}
 return captured;
}
function interceptLoad(value){
 const oldExists=fs.existsSync,oldRead=fs.readFileSync;
 fs.existsSync=()=>true;
 fs.readFileSync=()=>JSON.stringify(value);
 try{return RetroArchClient.prototype.loadPersistedState();}
 finally{fs.existsSync=oldExists;fs.readFileSync=oldRead;}
}
test('live video canvas is excluded from both disk snapshots',()=>{
 const writes=interceptWrite(fixture());
 assert.equal(writes.length,2);
 assert.ok(writes.every(w=>!Object.hasOwn(w.value,'videoMemory')));
});
test('excluding VRAM does not remove it from the live state',()=>{
 const state=fixture(),video=state.videoMemory;
 interceptWrite(state);
 assert.equal(state.videoMemory,video);
 assert.equal(state.videoMemory.tilePatterns.length,6144);
});
test('trainer party map and history remain available for restart cache',()=>{
 const writes=interceptWrite(fixture());
 for(const {value} of writes){
  assert.equal(value.trainerName,'RED');
  assert.equal(value.mapId,15);
  assert.equal(value.party[0].level,20);
  assert.equal(value.actionHistory[0].text,'Action retained');
  assert.equal(value.dialogHistory[0].text,'Dialog retained');
 }
});
test('both saved JSON snapshots have identical compact content',()=>{
 const writes=interceptWrite(fixture());
 assert.deepEqual(writes[0].value,writes[1].value);
 assert.ok(writes[0].path.endsWith(path.join('data','last_known_state.json')));
 assert.ok(writes[1].path.endsWith(path.join('data','last_known_state.json')));
});
test('world-campaign snapshots still remain transient',()=>{
 const writes=interceptWrite(fixture());
 for(const {value} of writes){
  assert.equal(Object.hasOwn(value,'globalCampaignLedger'),false);
  assert.equal(Object.hasOwn(value,'worldRecentFlagChanges'),false);
 }
});
test('disconnected or simulated state writes no cache files',()=>{
 for(const state of [
  {...fixture(),connected:false},
  {...fixture(),isSimulation:true}
 ])assert.equal(interceptWrite(state).length,0);
});
test('legacy persisted canvas is discarded on load',()=>{
 const state=fixture();
 const loaded=interceptLoad(state);
 assert.equal(loaded.connected,false);
 assert.equal(Object.hasOwn(loaded,'videoMemory'),false);
 assert.equal(loaded.party[0].name,'PIKACHU');
});
test('legacy memory diagnostics are not promoted to live evidence',()=>{
 const saved=fixture();
 saved.memoryReadStatus={verified:true,scriptedBattleReadback:{verified:true}};
 saved.romScriptedBattleReadbackStatus={verified:true};
 const loaded=interceptLoad(saved);
 assert.equal(loaded.connected,false);
 assert.equal(Object.hasOwn(loaded,'romScriptedBattleReadbackStatus'),false);
 assert.equal(Object.hasOwn(loaded.memoryReadStatus,'scriptedBattleReadback'),false);
 assert.equal(Object.hasOwn(loaded,'videoMemory'),false);
});
test('fresh cache without video still loads trainer and party',()=>{
 const s=fixture();delete s.videoMemory;
 const loaded=interceptLoad(s);
 assert.equal(loaded.party.length,1);
 assert.equal(loaded.areaInfo.name,'Route 4');
 assert.equal(loaded.connected,false);
});
test('source enforces VRAM exclusion on load and on serialization',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const load=source.indexOf('loadPersistedState() {');
 const persist=source.indexOf('persistState(state) {');
 assert.ok(load>0&&persist>load);
 assert.match(source.slice(load,persist),/delete saved\.videoMemory/);
 const end=source.indexOf('loadPersistedActionHistory() {',persist);
 assert.match(source.slice(persist,end),/'videoMemory'/);
});
