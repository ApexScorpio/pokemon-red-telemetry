'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const first=app.indexOf('function selectVerifiedMinimapItemMarkers(state) {');
const end=app.indexOf('// Renderizador do Mini-Mapa Tático',first);
assert.ok(first>=0&&end>first);
const selectors=vm.runInNewContext(app.slice(first,end)+
 '\n({selectVerifiedMinimapItemMarkers,'+
 'selectVerifiedMinimapStaticEncounterMarkers,'+
 'selectVerifiedMinimapHiddenCoinMarkers,'+
 'describeVerifiedVramStaticLocationEvidence});',{},{timeout:1500});
const RED='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const GREEN='aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db';
function state(sha=GREEN,x=24,y=7,mx=5,my=10){
 const mapId=227,p={verified:true,mapId,x:10,y:11};
 const item={x,y,itemId:2,romObjectOrdinal:2,
  coordinateSource:'SHA_AUDITED_ACTIVE_ROM_ITEM_OBJECT',
  romItemCoordinatesVerified:true,isCollected:null};
 const actor={kind:'ITEM',ordinal:2,x,y,romActorItemId:2,
  romActorCoordinateAndAttributeVerified:true,
  romActorVariantEvidence:'SAME_SHA_ROM_MAP_OBJECT_AND_SCRIPT_REFERENCE',
  scriptReferenceBound:true,scriptTextPointerVerified:true};
 const mon={kind:'STATIC_POKEMON',ordinal:1,x:mx,y:my,
  romActorCoordinateAndAttributeVerified:true,
  romActorVariantEvidence:'SAME_SHA_ROM_MAP_OBJECT_AND_SCRIPT_REFERENCE',
  romActorSpeciesInternalId:131,romActorLevel:70,
  scriptReferenceBound:true,scriptTextPointerVerified:true,
  progress:'NOT_PROVEN',accessibleNow:null,completedNow:null,
  staticObject:{source:'ROM_MAP_OBJECT_BYTES',kind:'wildPokemon',
   ordinal:1,x:mx,y:my,wildSpeciesInternalId:131,wildLevel:70}};
 return {connected:true,mapId,mapName:'Caverna',
  coords:{x:10,y:11},lastUpdate:new Date().toISOString(),
  videoMemory:{tilePatterns:[],bgTileMap:[]},
  romRuntimeIdentity:{matched:true,profileSha256:sha},
  memoryReadStatus:{verified:true,positionWindow:{...p},
   latePositionWindow:{...p},publicationPositionWindow:{...p}},
  areaInfo:{visibleItemCoordinateEvidence:{verified:true,mapId,
   romSha256:sha,gameplayAccessCertified:false},visibleItems:[item],
   lockedItems:[],hiddenItems:[]},
  worldAdvisor:{verified:true,mapId,romSha256:sha,
   fullWorldStaticIndexVerified:true,mapChecklist:{
    verified:true,mapId,romSha256:sha,
    actorAttributeAtlasBound:true,scriptAtlasBound:true,
    summary:{boundStaticActorAttributes:2},actions:[actor,mon]}}
 };
}
test('Green VRAM caption contains Green item and static encounter ROM tiles',()=>{
 const line=selectors.describeVerifiedVramStaticLocationEvidence(state());
 assert.match(line,/Coordenadas ROM, NÃO sobrepostas à VRAM \(2\)/);
 assert.match(line,/🎒 X:24 Y:7/);
 assert.match(line,/✨ X:5 Y:10 espécie interna 131 nível 70/);
});
test('Red VRAM caption uses Red object tiles, not Green positions',()=>{
 const line=selectors.describeVerifiedVramStaticLocationEvidence(state(RED,16,9,27,13));
 assert.match(line,/🎒 X:16 Y:9/);
 assert.match(line,/✨ X:27 Y:13/);
 assert.doesNotMatch(line,/X:24 Y:7/);
});
test('stale RAM and mismatching SHA conceal unproven VRAM object locations',()=>{
 for(const change of [
  s=>{s.lastUpdate='2020-01-01T00:00:00Z';},
  s=>{s.romRuntimeIdentity.profileSha256='0'.repeat(64);},
  s=>{s.memoryReadStatus.publicationPositionWindow.x=4;},
  s=>{s.mapId=226;}
 ]){
  const s=state();change(s);
  const line=selectors.describeVerifiedVramStaticLocationEvidence(s);
  assert.match(line,/Posições ROM não confirmadas/);
  assert.doesNotMatch(line,/X:24 Y:7/);
  assert.doesNotMatch(line,/espécie interna 131/);
 }
});
test('VRAM caption limits entries but counts every corroborated candidate',()=>{
 const s=state(),a=s.areaInfo;
 a.hiddenItems=[
  {x:3,y:4,romItemCoordinatesVerified:true,isCollected:null},
  {x:6,y:8,romItemCoordinatesVerified:true,isCollected:null}];
 const line=selectors.describeVerifiedVramStaticLocationEvidence(s);
 assert.match(line,/NÃO sobrepostas à VRAM \(4\)/);
 assert.match(line,/\+1 na checklist/);
});
test('real VRAM-only rendering branch publishes coordinates as text without fake pins',()=>{
 const s=state();
 const first=app.indexOf('  // Muitos interiores ainda não têm arte estática.');
 const last=app.indexOf('  const dims = state.mapDimensions',first);
 assert.ok(first>=0&&last>first);
 const stats={textContent:''},title={textContent:''},coords={textContent:''};
 let drew=0,ghosts=0;
 const ctx={state:s,hasValidMapImg:false,ctxFog:{fillRect(){}},
  canvasFog:{width:160,height:144},drawLiveVramMap:()=>{drew++;return true;},
  elMinimapTitle:title,elMinimapStats:stats,elMinimapCoordsOverlay:coords,
  mapName:s.mapName,coords:s.coords,isGtaMapOpen:false,
  renderGtaFullMap:()=>{throw Error('Unexpected full-map render');},
  describeVerifiedVramStaticLocationEvidence:
   selectors.describeVerifiedVramStaticLocationEvidence,
  drawMapEntity:()=>{ghosts++;}
 };
 vm.runInNewContext('(function(){\n'+app.slice(first,last)+'\n})()',ctx,
  {timeout:1500});
 assert.equal(drew,1);
 assert.equal(ghosts,0);
 assert.match(stats.textContent,/Coordenadas ROM/);
 assert.match(stats.textContent,/X:24 Y:7/);
 assert.match(title.textContent,/VISTA RAM/);
});
test('VRAM fallback text never claims a static Pokémon is present or caught',()=>{
 const line=selectors.describeVerifiedVramStaticLocationEvidence(state());
 assert.doesNotMatch(line,/capturado|encontrado agora|disponível agora/i);
 assert.match(line,/NÃO sobrepostas à VRAM/);
});
