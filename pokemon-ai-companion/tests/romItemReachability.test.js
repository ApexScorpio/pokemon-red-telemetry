'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {computeReach,candidatePath,planItemAccess}=require('../romItemReachability');
const sha=['5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'];
const dataNames=['red','blue','green'];
function makeGrid(type='cut'){
 const width=8,height=5,n=width*height;
 const tiles=Buffer.alloc(n,0x2c),bits=Buffer.alloc(Math.ceil(n/8),0);
 for(let i=0;i<n;i++)bits[i>>3]|=1<<(i&7);
 for(let y=0;y<height;y++){
  const index=y*width+3;
  tiles[index]=type==='cut'?0x3d:type==='surf'?0x14:0x2c;
  if(type!=='boulder')bits[index>>3]&=~(1<<(index&7));
 }
 return {width,height,tilesetId:0,mapId:15,tiles,bits,pairs:[],romSha256:sha[0]};
}
function toTerrain(g){
 const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
 return {verified:true,mapId:g.mapId,tilesetId:g.tilesetId,
  width:g.width,height:g.height,landBlockedTilePairs:g.pairs,
  tileIdsBase64:g.tiles.toString('base64'),walkingBitsBase64:g.bits.toString('base64'),
  tileIdsSha256:digest(g.tiles),walkingBitsSha256:digest(g.bits)};
}
function check(g,{canCut=false,canSurf=false,actors=[],spritesVerified=true,
  position={x:1,y:2},items=[{name:'TEST ITEM',x:6,y:2,type:'visible'}]}={}){
 return planItemAccess({terrain:toTerrain(g),romSha256:sha[0],position,
  items:items.map(i=>({romItemCoordinatesVerified:true,...i})),modeByte:0,mapSnapshotVerified:true,positionVerified:true,
  spritesVerified,mapEntities:actors,canCut,canSurf});
}
test('Cut: só a rota hipotética através de arbusto gera NEEDS_CUT',()=>{
 const g=makeGrid('cut');
 const without=check(g);
 assert.equal(without.verified,true);
 assert.equal(without.results[0].accessStatus,'NEEDS_CUT');
 assert.equal(without.results[0].accessibleNow,null);
 assert.equal(without.results[0].route.usesCut,true);
 const learned=check(g,{canCut:true});
 assert.equal(learned.results[0].accessStatus,'CONDITIONAL_PATH');
 assert.equal(learned.results[0].route.usesCut,true);
 assert.equal(learned.results[0].accessibleNow,null);
});
test('Surf: tile de água divide as zonas e exige habilidade para plano teórico',()=>{
 const g=makeGrid('surf');
 assert.equal(check(g).results[0].accessStatus,'NEEDS_SURF');
 const x=check(g,{canSurf:true}).results[0];
 assert.equal(x.accessStatus,'CONDITIONAL_PATH');
 assert.equal(x.route.usesSurf,true);
});
test('Strength: rocha observada é obstáculo, mas não permite presumir empurrão',()=>{
 const g=makeGrid('boulder');
 const actors=Array.from({length:5},(_,y)=>({
  x:3,y,type:'boulder',pictureId:63}));
 const x=check(g,{actors,spritesVerified:true}).results[0];
 assert.equal(x.accessStatus,'POSSIBLE_STRENGTH_BARRIER');
 assert.equal(x.accessibleNow,null);
 const unknown=check(g,{actors,spritesVerified:false}).results[0];
 assert.equal(unknown.accessStatus,'CONDITIONAL_PATH');
 assert.match(unknown.reason,/sprites sem confirmação RAM/i);
});
test('flags recolhido e objeto removido não são sinónimos',()=>{
 const g=makeGrid('boulder');
 const p=check(g,{items:[
  {name:'Hidden',x:5,y:2,type:'hidden',isCollected:true},
  {name:'Ground',x:5,y:3,type:'visible',removedFromMap:true}
 ]});
 assert.equal(p.results[0].accessStatus,'COLLECTED_FLAG');
 assert.equal(p.results[1].accessStatus,'REMOVED_FLAG');
});
test('sem mapa, posição ou modo corroborados recusa classificar como disponível',()=>{
 const g=makeGrid('boulder'),terrain=toTerrain(g);
 const a=planItemAccess({terrain,romSha256:sha[0],position:{x:1,y:2},
   items:[{x:6,y:2}],positionVerified:false,mapSnapshotVerified:true,modeByte:0});
 assert.equal(a.verified,false);assert.equal(a.results[0].accessibleNow,null);
 const b=planItemAccess({terrain:{...terrain,walkingBitsSha256:'0'.repeat(64)},
   romSha256:sha[0],position:{x:1,y:2},positionVerified:true,
   mapSnapshotVerified:true,modeByte:0,items:[{x:6,y:2}]});
 assert.equal(b.verified,false);
});
test('ledge de sentido único: salto só a favor e pouso seguro',()=>{
 const g=makeGrid('boulder');
 // Uma fileira de ledge sul que separa parte superior/inferior do mapa.
 for(let x=0;x<g.width;x++){
  g.tiles[1*g.width+x]=0x2c;
  g.tiles[2*g.width+x]=0x37;
  g.bits[(2*g.width+x)>>3]&=~(1<<((2*g.width+x)&7));
 }
 const forward=computeReach(g,{x:2,y:1},{});
 const down=candidatePath(forward,{x:2,y:4},{hidden:false});
 assert.ok(down);
 assert.equal(down.usesLedge,true);
 const backward=computeReach(g,{x:2,y:4},{});
 assert.equal(candidatePath(backward,{x:2,y:0},{hidden:true}),null);
});
test('Route 4: três grelhas reais têm o mesmo mapa e nenhum tile Cut',()=>{
 for(let i=0;i<3;i++){
  const atlas=require('../data/romTerrain_'+dataNames[i]+'.json');
  const terrain=atlas.maps.find(x=>x.mapId===15);
  assert.equal(terrain.width,90);
  assert.equal(terrain.height,18);
  assert.equal(terrain.tilesetId,0);
  const tiles=Buffer.from(terrain.tileIdsBase64,'base64');
  assert.equal(tiles.includes(0x3d),false);
  const g={width:terrain.width,height:terrain.height,tilesetId:0,mapId:15,
   tiles,bits:Buffer.from(terrain.walkingBitsBase64,'base64'),
   pairs:terrain.landBlockedTilePairs,romSha256:sha[i]};
  // Da zona alta do planalto há solução geométrica para o TM04,
  // mas da zona oeste não existe caminho direto por tiles dentro do mapa.
  const east=computeReach(g,{x:40,y:3},{});
  assert.ok(candidatePath(east,{x:57,y:3},{hidden:false}));
  const west=computeReach(g,{x:11,y:5},{});
  assert.equal(candidatePath(west,{x:57,y:3},{hidden:false}),null);
 }
});
test('Route 4: depois do salto da encosta, não prometer recuperar TM04 por Cut',()=>{
 const atlas=require('../data/romTerrain_red.json');
 const m=atlas.maps.find(x=>x.mapId===15);
 const g={width:m.width,height:m.height,tilesetId:0,mapId:15,
   tiles:Buffer.from(m.tileIdsBase64,'base64'),
   bits:Buffer.from(m.walkingBitsBase64,'base64'),
   pairs:m.landBlockedTilePairs};
 const fromBelow=computeReach(g,{x:75,y:12},{canCut:true,canSurf:false});
 assert.equal(candidatePath(fromBelow,{x:57,y:3},{hidden:false}),null);
});

test('um item com coordenadas apenas manuais não recebe caminho certificado',()=>{
 const g=makeGrid('boulder');
 const result=check(g,{items:[{name:'Manual',x:6,y:2,
   type:'visible',romItemCoordinatesVerified:false}]});
 assert.equal(result.results[0].accessStatus,'UNVERIFIED_ROM_ITEM');
 assert.equal(result.results[0].route,null);
});


test('confirmed sprite RAM rejects malformed actor arrays instead of inventing routes',()=>{
 const g=makeGrid('boulder'),terrain=toTerrain(g);
 for(const mapEntities of [null,undefined,{},'actors']){
  const result=planItemAccess({terrain,romSha256:sha[0],
   position:{x:1,y:2},items:[{x:6,y:2,romItemCoordinatesVerified:true}],
   positionVerified:true,mapSnapshotVerified:true,modeByte:0,
   spritesVerified:true,mapEntities,canCut:false,canSurf:false});
  assert.equal(result.verified,false);
  assert.equal(result.results[0].accessStatus,'UNKNOWN');
  assert.equal(result.results[0].accessibleNow,null);
  assert.match(result.reason,/Sprites RAM incoerentes/);
 }
});
test('confirmed sprite RAM rejects even one invalid actor coordinate',()=>{
 const invalid=[
  {x:null,y:1},{x:1,y:undefined},{x:NaN,y:2},
  {x:-5,y:2},{x:256,y:2},{x:1.5,y:2},
  {x:4,y:Infinity},null
 ];
 for(const actor of invalid){
  const r=check(makeGrid('boulder'),{actors:[
   {x:3,y:2,type:'boulder',pictureId:63},actor]});
  assert.equal(r.verified,false);
  assert.equal(r.results[0].accessStatus,'UNKNOWN');
  assert.equal(r.results[0].route,undefined);
 }
});
test('valid offscreen RAM actors do not contaminate same-map occupancy',()=>{
 const g=makeGrid('boulder');
 for(const actors of [
  [{x:-4,y:2,type:'npc'}],
  [{x:255,y:255,type:'npc'}],
  []
 ]){
  const r=check(g,{actors,spritesVerified:true});
  assert.equal(r.verified,true);
  assert.equal(r.results[0].accessStatus,'CONDITIONAL_PATH');
  assert.equal(r.results[0].accessibleNow,null);
 }
});
test('unverified RAM sprite block never asserts obstacle-free live access',()=>{
 const g=makeGrid('boulder');
 const r=planItemAccess({terrain:toTerrain(g),romSha256:sha[0],
   position:{x:1,y:2},
   items:[{x:6,y:2,romItemCoordinatesVerified:true}],
   positionVerified:true,mapSnapshotVerified:true,modeByte:0,
   spritesVerified:false,mapEntities:null});
 assert.equal(r.verified,true);
 assert.equal(r.results[0].accessStatus,'CONDITIONAL_PATH');
 assert.equal(r.results[0].accessibleNow,null);
 assert.equal(r.currentMapRouteVerified,false);
 assert.equal(r.accessibleNowGuaranteed,false);
 assert.match(r.results[0].reason,/sprites sem confirmação RAM/i);
});
