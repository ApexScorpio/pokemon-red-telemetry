'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=app.indexOf('function selectVerifiedMinimapItemMarkers(state) {');
const end=app.indexOf('// Renderizador do Mini-Mapa Tático',start);
assert.ok(start>=0&&end>start,'Static map selectors not found');
const fn=vm.runInNewContext(app.slice(start,end)+
 '\n({selectVerifiedMinimapHiddenCoinMarkers,'+
 'describeVerifiedVramStaticLocationEvidence});',{}, {timeout:1500});
const RED='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const BLUE='2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d';
const GREEN='aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db';
function state(sha=GREEN){
 const mapId=135,p={verified:true,mapId,x:10,y:11};
 const coin=(hiddenIndex,x,y,isCollected=false)=>({
  hiddenIndex,mapId,x,y,coinAmount:hiddenIndex===9?40:10,
  isCollected,collectionEvidence:'ID_EVENTO_ROM + FLAG_RAM_D6FE',
  amountSource:'ROM_ARG+ROTINA_DE_ATRIBUIÇÃO_SE_VALIDADA'});
 return {connected:true,mapId,coords:{x:10,y:11},
  lastUpdate:new Date().toISOString(),
  romRuntimeIdentity:{matched:true,profileSha256:sha},
  memoryReadStatus:{verified:true,positionWindow:{...p},
   latePositionWindow:{...p},publicationPositionWindow:{...p}},
  romHiddenCoins:{verified:true,mapId,romSha256:sha,
   source:'ROM_HIDDEN_COIN_EVENTS_EXTRACTED + RAM_D6FE',
   coins:[coin(0,8,0),coin(9,9,1),coin(11,10,2,true)]},
  areaInfo:{visibleItemCoordinateEvidence:{verified:false},
   visibleItems:[],hiddenItems:[],lockedItems:[]}};
}
const get=s=>Array.from(fn.selectVerifiedMinimapHiddenCoinMarkers(s));
test('Red Blue Green verified hidden coin records yield static ghost locations',()=>{
 for(const sha of [RED,BLUE,GREEN]){
  const r=get(state(sha));
  assert.equal(r.length,2);
  assert.deepEqual(r.map(c=>[c.x,c.y]),[[8,0],[9,1]]);
  assert.equal(r[0].presentNow,null);
  assert.equal(r[1].accessibleNow,null);
  assert.equal(r[0].evidence,'SHA_AUDITED_ROM_HIDDEN_COIN_AND_D6FE_FLAG');
 }
});
test('D6FE collection bit hides already obtained hidden coin',()=>{
 const s=state();
 assert.ok(!get(s).some(c=>c.hiddenIndex===11));
 s.romHiddenCoins.coins[0].isCollected=true;
 assert.equal(get(s).length,1);
});
test('unknown ROM or cross-variant SHA never creates coin markers',()=>{
 for(const mutate of [
  s=>{s.romRuntimeIdentity.profileSha256='0'.repeat(64);},
  s=>{s.romHiddenCoins.romSha256=RED;},
  s=>{s.romRuntimeIdentity.matched=false;},
  s=>{s.romHiddenCoins.source='MANUAL_COORDINATES';},
  s=>{s.romHiddenCoins.verified=false;}
 ]){const s=state();mutate(s);assert.equal(get(s).length,0);}
});
test('stale RAM, inconsistent position or map transition suppresses coin markers',()=>{
 for(const mutate of [
  s=>{s.connected=false;},
  s=>{s.lastUpdate='2020-01-01T00:00:00Z';},
  s=>{s.mapId=15;},
  s=>{s.romHiddenCoins.mapId=15;},
  s=>{s.memoryReadStatus.positionWindow.x=7;},
  s=>{s.memoryReadStatus.publicationPositionWindow.mapId=15;},
  s=>{s.coords.y=10;}
 ]){const s=state();mutate(s);assert.equal(get(s).length,0);}
});
test('duplicate coin ordinal or tile is rejected, not drawn twice',()=>{
 const s=state(),row=s.romHiddenCoins.coins[0];
 s.romHiddenCoins.coins.push({...row});
 assert.equal(get(s).length,0);
 s.romHiddenCoins.coins.pop();
 s.romHiddenCoins.coins.push({...row,hiddenIndex:2});
 assert.equal(get(s).length,0);
});
test('invalid coin ID amount flag and coordinates fail closed',()=>{
 for(const mutate of [
  c=>{c.hiddenIndex=12;},c=>{c.coinAmount=999;},
  c=>{c.isCollected=null;},c=>{c.collectionEvidence='MANUAL';},
  c=>{c.x=-1;},c=>{c.y=256;}
 ]){const s=state();mutate(s.romHiddenCoins.coins[0]);assert.equal(get(s).length,0);}
});
test('absent table or different map does not invent coins',()=>{
 const s=state();delete s.romHiddenCoins;assert.equal(get(s).length,0);
 const t=state();t.romHiddenCoins.coins=[];
 assert.equal(get(t).length,0);
});
test('minimap draws uncollected hidden coin ghost and no live sprite',()=>{
 const a=app.indexOf('  // Separate hidden coin table (ROM)');
 const b=app.indexOf('  const entitySnapshot = getMapEntitySnapshot(state);',a);
 assert.ok(a>=0&&b>a);
 const calls=[];
 vm.runInNewContext(app.slice(a,b),{
  state:state(),camX:0,camY:0,tileSize:24,cw:1500,ch:1500,ctxFog:{},
  selectVerifiedMinimapHiddenCoinMarkers:fn.selectVerifiedMinimapHiddenCoinMarkers,
  drawMapEntity:(ctx,ent,x,y,scale,ghost)=>calls.push({ent,ghost})
 },{timeout:1500});
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.ent.icon==='🪙'&&c.ent.hiddenCoin===true));
 assert.ok(calls.every(c=>c.ent.presentNow===null&&c.ghost===true));
});
test('enlarged map uses the same coin guard and no invented live actor',()=>{
 const a=app.indexOf('  // Enlarged map uses the identical SHA/ROM/D6FE');
 const b=app.indexOf('  const entitySnapshot = getMapEntitySnapshot(state);',a);
 assert.ok(a>=0&&b>a);
 const calls=[];
 vm.runInNewContext(app.slice(a,b),{
  state:state(),originX:0,originY:0,tilePx:24,cw:1500,ch:1500,
  gtaZoom:1,ctxGta:{},
  selectVerifiedMinimapHiddenCoinMarkers:fn.selectVerifiedMinimapHiddenCoinMarkers,
  drawMapEntity:(ctx,ent,x,y,scale,ghost)=>calls.push({ent,ghost})
 },{timeout:1500});
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.ent.isGhost===true&&c.ent.hiddenCoin===true));
});
test('VRAM fallback lists coin map coordinates without overlaying image pixels',()=>{
 const s=state();
 const text=fn.describeVerifiedVramStaticLocationEvidence(s);
 assert.match(text,/Coordenadas ROM, NÃO sobrepostas à VRAM \(2\)/);
 assert.match(text,/🪙 X:8 Y:0/);
 assert.match(text,/🪙 X:9 Y:1/);
 assert.doesNotMatch(text,/presente agora|disponível agora/i);
});
test('no coin markers leak through missing confirmed ROM flag data',()=>{
 const s=state();
 s.romHiddenCoins={verified:false,mapId:135,romSha256:GREEN,
  source:'ROM_HIDDEN_COIN_EVENTS_EXTRACTED + RAM_D6FE',coins:[]};
 assert.equal(get(s).length,0);
 assert.match(fn.describeVerifiedVramStaticLocationEvidence(s),/Posições ROM não confirmadas/);
});
