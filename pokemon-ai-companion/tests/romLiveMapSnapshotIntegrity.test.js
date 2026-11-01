'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=app.indexOf('const mapEntityHistory = new Map();');
const end=app.indexOf('function drawMapEntity(',start);
assert.ok(start>=0&&end>start,'Live sprite snapshot not found');
const ctx=vm.createContext({});
vm.runInContext(app.slice(start,end),ctx,{timeout:1500});
const live=vm.runInContext('getMapEntitySnapshot',ctx);
const RED='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const BLUE='2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d';
const GREEN='aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db';
function state(sha=RED){
 const mapId=15,p={verified:true,mapId,x:10,y:11};
 return {connected:true,mapId,coords:{x:10,y:11},
  lastUpdate:new Date().toISOString(),
  romRuntimeIdentity:{matched:true,profileSha256:sha},
  memoryReadStatus:{verified:true,blocks:{overworldSprites:true},
   positionWindow:{...p},latePositionWindow:{...p},
   publicationPositionWindow:{...p}},
  mapEntities:[{spriteIndex:1,pictureId:10,x:3,y:4,isTrainer:true}]
 };
}
const rows=s=>Array.from(live(s).active);
test('all three exact ROMs permit only same-target fresh RAM sprites',()=>{
 for(const sha of [RED,BLUE,GREEN]){
  const r=rows(state(sha));
  assert.equal(r.length,1);
  assert.equal(r[0].x,3);
  assert.equal(r[0].y,4);
 }
});
test('disconnect, unknown ROM, unverified identity and missing RAM sprites fail closed',()=>{
 for(const change of [
  s=>{s.connected=false;},
  s=>{s.romRuntimeIdentity.matched=false;},
  s=>{s.romRuntimeIdentity.profileSha256='0'.repeat(64);},
  s=>{s.memoryReadStatus.verified=false;},
  s=>{s.memoryReadStatus.blocks.overworldSprites=false;},
  s=>{delete s.memoryReadStatus.blocks;}
 ]){
  const s=state();change(s);assert.equal(rows(s).length,0);
 }
});
test('future, stale or malformed clock denies claimed live actor presence',()=>{
 for(const value of ['2020-01-01T00:00:00Z',
   new Date(Date.now()+60000).toISOString(),'garbage']){
  const s=state();s.lastUpdate=value;
  assert.equal(rows(s).length,0);
 }
});
test('map switching, mismatched RAM positions or player tile fail closed',()=>{
 for(const change of [
  s=>{s.mapId=226;},
  s=>{s.memoryReadStatus.positionWindow.x=2;},
  s=>{s.memoryReadStatus.latePositionWindow.y=2;},
  s=>{s.memoryReadStatus.publicationPositionWindow.mapId=226;},
  s=>{s.coords.x=12;},
  s=>{delete s.memoryReadStatus.publicationPositionWindow;}
 ]){
  const s=state();change(s);assert.equal(rows(s).length,0);
 }
});
test('non-array and malformed sprite coordinates cannot be rendered',()=>{
 for(const change of [
  s=>{s.mapEntities={x:3,y:4};},
  s=>{s.mapEntities=null;},
  s=>{s.mapEntities=[{x:null,y:4}];},
  s=>{s.mapEntities=[{x:300,y:4}];},
  s=>{s.mapEntities=[{x:3,y:-5}];}
 ]){
  const s=state();change(s);assert.equal(rows(s).length,0);
 }
});
test('invalidated RAM clears stale ghosts and does not restore actors on reconnect',()=>{
 const before=state();assert.equal(rows(before).length,1);
 const empty=state();empty.mapEntities=[];
 assert.equal(Array.from(live(empty).ghosts).length,1);
 const disconnected=state();disconnected.connected=false;
 assert.equal(rows(disconnected).length,0);
 assert.equal(Array.from(live(state())).length,0);
 assert.equal(Array.from(live(empty).ghosts).length,0);
});
test('history key separates Red and Green map actors even with same map ID',()=>{
 let a=state(RED);rows(a);
 a=state(RED);a.mapEntities=[];
 assert.equal(Array.from(live(a).ghosts).length,1);
 const b=state(GREEN);b.mapEntities=[];
 assert.equal(Array.from(live(b).ghosts).length,0);
});
function drawActors(s,full){
 const needle='  const entitySnapshot = getMapEntitySnapshot(state);';
 const a=app.indexOf(needle);
 const start=full?app.indexOf(needle,a+1):a;
 const end=app.indexOf(full?'  // 4. Jogador':'  // 5. Desenha o Jogador',start);
 assert.ok(start>=0&&end>start);
 const calls=[];
 vm.runInNewContext(app.slice(start,end),{
  state:s,getMapEntitySnapshot:live,drawMapEntity:(c,e)=>calls.push(e),
  camX:0,camY:0,tileSize:24,originX:0,originY:0,tilePx:24,
  gtaZoom:1,ctxFog:{},ctxGta:{},cw:1500,ch:1500
 },{timeout:1500});
 return calls;
}
test('both map views stop showing a sprite after stale RAM snapshot',()=>{
 for(const full of [false,true]){
  assert.equal(drawActors(state(),full).length,1);
  const stale=state();stale.lastUpdate='2020-01-01T00:00:00Z';
  assert.equal(drawActors(stale,full).length,0);
 }
});
test('both map views reject a sprite from invalid ROM SHA even if map matches',()=>{
 for(const full of [false,true]){
  const s=state();s.romRuntimeIdentity.profileSha256='a'.repeat(64);
  assert.equal(drawActors(s,full).length,0);
 }
});
