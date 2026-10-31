'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const first=app.indexOf('function selectVerifiedMinimapItemMarkers(state) {');
const last=app.indexOf('// Renderizador do Mini-Mapa Tático',first);
assert.ok(first>=0&&last>first,'Minimap selection source missing');
const select=vm.runInNewContext(app.slice(first,last)+
 '\nselectVerifiedMinimapItemMarkers;',{}, {timeout:1500});
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function state(){
 const p={verified:true,mapId:15,x:10,y:11};
 return {connected:true,mapId:15,coords:{x:10,y:11},
  lastUpdate:new Date().toISOString(),
  romRuntimeIdentity:{matched:true,profileSha256:SHA},
  memoryReadStatus:{verified:true,
   positionWindow:{...p},latePositionWindow:{...p},
   publicationPositionWindow:{...p}},
  areaInfo:{visibleItemCoordinateEvidence:{
   verified:true,mapId:15,romSha256:SHA,gameplayAccessCertified:false},
   visibleItems:[{x:4,y:3,romItemCoordinatesVerified:true,
    isLocked:false,isCollected:null}],hiddenItems:[],lockedItems:[]}};
}
const list=s=>Array.from(select(s));
test('verified item is a static marker with no claimed current presence',()=>{
 const r=list(state());
 assert.equal(r.length,1);assert.equal(r[0].x,4);
 assert.equal(r[0].y,3);assert.equal(r[0].blocked,false);
 assert.equal(r[0].presentNow,null);assert.equal(r[0].accessibleNow,null);
 assert.equal(r[0].evidence,'STATIC_COORDINATE_FROM_AUDITED_ACTIVE_ROM');
});
test('Cut/Surf locked items stay visible on the minimap',()=>{
 const s=state();
 s.areaInfo.lockedItems=[
  {x:5,y:6,romItemCoordinatesVerified:true,isLocked:true,accessStatus:'NEEDS_CUT'},
  {x:9,y:8,romItemCoordinatesVerified:true,isLocked:true,accessStatus:'NEEDS_SURF'}];
 const r=list(s);
 assert.equal(r.length,3);
 assert.deepEqual(r.filter(x=>x.blocked).map(x=>[x.x,x.y]),[[5,6],[9,8]]);
});
test('locked item overrides a coincident static tile and is not duplicated',()=>{
 const s=state();
 s.areaInfo.lockedItems=[{x:4,y:3,romItemCoordinatesVerified:true,isLocked:true}];
 const r=list(s);assert.equal(r.length,1);assert.equal(r[0].blocked,true);
});
test('hidden item requires actual ROM coordinate proof',()=>{
 const s=state();
 s.areaInfo.hiddenItems=[
  {x:6,y:4,romItemCoordinatesVerified:true,isCollected:false},
  {x:7,y:4,romItemCoordinatesVerified:false,isCollected:false}];
 const r=list(s);assert.equal(r.length,2);
 assert.ok(r.some(x=>x.x===6&&x.kind==='hidden'));
 assert.ok(!r.some(x=>x.x===7));
});
test('manual items without ROM proof never become map pins, even if blocked',()=>{
 const s=state();
 s.areaInfo.visibleItems=[{x:4,y:3,romItemCoordinatesVerified:false}];
 s.areaInfo.lockedItems=[{x:8,y:8,romItemCoordinatesVerified:false,isLocked:true}];
 s.areaInfo.manualVisibleItemReferences=[{x:null,y:null,referenceX:8,referenceY:8}];
 assert.equal(list(s).length,0);
});
test('removed and collected objects are omitted without inferring pickup',()=>{
 const s=state();s.areaInfo.visibleItems[0].removedFromMap=true;
 s.areaInfo.hiddenItems=[{x:8,y:9,romItemCoordinatesVerified:true,isCollected:true}];
 assert.equal(list(s).length,0);
});
test('ROM identity mismatch and stale timestamp fail closed',()=>{
 const mutations=[
  s=>s.connected=false,
  s=>s.romRuntimeIdentity.matched=false,
  s=>s.romRuntimeIdentity.profileSha256='0'.repeat(64),
  s=>s.areaInfo.visibleItemCoordinateEvidence.romSha256='0'.repeat(64),
  s=>s.areaInfo.visibleItemCoordinateEvidence.verified=false,
  s=>s.areaInfo.visibleItemCoordinateEvidence.mapId=16,
  s=>s.areaInfo.visibleItemCoordinateEvidence.gameplayAccessCertified=true,
  s=>s.lastUpdate='2020-01-01T00:00:00Z',
  s=>s.lastUpdate='invalid'];
 for(const f of mutations){const s=state();f(s);assert.equal(list(s).length,0);}
});
test('map changes and non-atomic position sequence suppress stale pins',()=>{
 const mutations=[
  s=>s.mapId=16,
  s=>s.coords.x=14,
  s=>s.memoryReadStatus.verified=false,
  s=>s.memoryReadStatus.positionWindow.x=8,
  s=>s.memoryReadStatus.latePositionWindow.y=13,
  s=>s.memoryReadStatus.publicationPositionWindow.mapId=16,
  s=>{delete s.memoryReadStatus.publicationPositionWindow;}];
 for(const f of mutations){const s=state();f(s);assert.equal(list(s).length,0);}
});
test('invalid coordinates and malformed lists fail closed',()=>{
 const s=state();
 s.areaInfo.visibleItems=[
  {x:NaN,y:3,romItemCoordinatesVerified:true},
  {x:256,y:3,romItemCoordinatesVerified:true},
  {x:-5,y:3,romItemCoordinatesVerified:true},
  {x:4,y:null,romItemCoordinatesVerified:true},
  {x:4,y:255,romItemCoordinatesVerified:true}];
 assert.equal(list(s).length,1);
 assert.equal(list(s)[0].y,255);
 const b=state();b.areaInfo.lockedItems={x:8,y:2};
 assert.equal(list(b).length,0);
});
test('renderer paints static pins faded and blocked pins with lock symbol',()=>{
 const s=state();
 s.areaInfo.lockedItems=[{x:6,y:5,romItemCoordinatesVerified:true,isLocked:true}];
 const a=app.indexOf('  const markers=selectVerifiedMinimapItemMarkers(state);');
 const b=app.indexOf('  // Só mostrar entidades lidas agora da RAM.',a);
 assert.ok(a>=0&&b>a);
 const calls=[];
 vm.runInNewContext(app.slice(a,b),{
  state:s,camX:0,camY:0,tileSize:24,cw:1500,ch:1500,ctxFog:{},
  selectVerifiedMinimapItemMarkers:select,
  drawMapEntity:(ctx,ent,x,y,scale,ghost)=>calls.push({ent,ghost})
 },{timeout:1500});
 assert.equal(calls.length,2);
 const regular=calls.find(c=>c.ent.x===4);
 const blocked=calls.find(c=>c.ent.x===6);
 assert.equal(regular.ent.isGhost,true);
 assert.equal(regular.ghost,true);
 assert.equal(blocked.ent.icon,'🔒');
 assert.equal(blocked.ent.isItem,false);
 assert.equal(blocked.ghost,true);
});
test('renderer no longer draws both unguarded item lists directly',()=>{
 assert.match(app,/const markers=selectVerifiedMinimapItemMarkers\(state\)/);
 assert.match(app,/\['blocked',area\.lockedItems\|\|\[\]\]/);
 const renderer=app.slice(app.indexOf('function renderFogMinimap(state) {'),
  app.indexOf('function renderFogMinimap(state) {')+12500);
 assert.ok(!renderer.includes('...(state.areaInfo?.visibleItems || []),'));
 assert.ok(!renderer.includes('...(state.areaInfo?.hiddenItems || [])'));
});

test('enlarged map uses exactly the same ROM guard, blocked pins, and faded markers',()=>{
 const s=state();
 s.areaInfo.lockedItems=[{x:7,y:6,romItemCoordinatesVerified:true,isLocked:true,
  accessStatus:'NEEDS_CUT'}];
 s.areaInfo.hiddenItems=[{x:9,y:6,romItemCoordinatesVerified:false}];
 const first=app.indexOf('  const markers=selectVerifiedMinimapItemMarkers(state);');
 const second=app.indexOf('  const markers=selectVerifiedMinimapItemMarkers(state);',first+20);
 const end=app.indexOf('  // 3. Apenas entidades reais presentes na RAM',second);
 assert.ok(second>first&&end>second);
 const calls=[];
 vm.runInNewContext(app.slice(second,end),{
  state:s,originX:0,originY:0,tilePx:24,cw:1500,ch:1500,
  gtaZoom:1,ctxGta:{},selectVerifiedMinimapItemMarkers:select,
  drawMapEntity:(ctx,ent,x,y,scale,ghost)=>calls.push({ent,ghost})
 },{timeout:1500});
 assert.equal(calls.length,2);
 assert.ok(calls.some(c=>c.ent.x===7&&c.ent.icon==='🔒'&&
  c.ent.isItem===false&&c.ghost===true));
 assert.ok(!calls.some(c=>c.ent.x===9));
 assert.ok(calls.every(c=>c.ent.isGhost===true&&c.ent.presentNow===null));
});
