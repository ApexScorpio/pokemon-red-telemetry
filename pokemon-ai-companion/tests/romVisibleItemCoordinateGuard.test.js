'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reconcileVisibleItemCoordinates}=require('../romVisibleItemCoordinateGuard');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const RED=AUDITED_ROM_SHA256.RED;
const BLUE=AUDITED_ROM_SHA256.BLUE;
const GREEN=AUDITED_ROM_SHA256.GREEN_INTERNATIONAL_1_2_1;
const pairs={
 226:{red:[[29,9],[4,15],[13,6]],green:[[5,15],[25,13],[29,9]]},
 227:{red:[[16,9],[18,9]],green:[[24,7],[24,9]]}
};
function proof(mapId,positions){
 return {verified:true,mapId,
  items:positions.map(([x,y],i)=>({
   mapId,kind:'item',x,y,objectOrdinal:i+1,
   itemId:25+i,source:'OBJETO_DEFINIDO_NA_ROM_COM_CRC32_CORRESPONDENTE',
   existsInRom:true,
   observedInRam:null,removedFromMap:null,collected:null
  }))};
}
function manual(positions){
 return positions.map(([x,y],i)=>({
  name:'Referência '+i,x,y,hint:'Não confirmar recolha',itemId:25+i
 }));
}
function run(mapId,sha,manualItems,items){
 return reconcileVisibleItemCoordinates({mapId,romSha256:sha,
  romIdentityMatched:true,romAreaEvidence:proof(mapId,items),
  manualItems});
}
test('Red item coordinates are paired one-to-one with active Red map 226',()=>{
 const positions=pairs[226].red;
 const x=run(226,RED,manual(positions),positions);
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.matchedManualItems.length,3);
 assert.equal(x.remainingRomItems.length,0);
 assert.equal(x.unmatchedManualReferences.length,0);
 assert.equal(x.matchedManualItems[0].coordinateSource,
  'SHA_AUDITED_ACTIVE_ROM_ITEM_OBJECT');
 assert.equal(x.matchedManualItems[0].romObjectOrdinal,1);
 assert.equal(x.gameplayAccessCertified,false);
});
test('Red manual coordinates cannot be advertised as Green map 226 pickups',()=>{
 const x=run(226,GREEN,manual(pairs[226].red),pairs[226].green);
 assert.equal(x.verified,true,x.reason);
 assert.equal(x.matchedManualItems.length,0);
 assert.equal(x.remainingRomItems.length,3);
 assert.equal(x.unmatchedManualReferences.length,3);
 for(const r of x.unmatchedManualReferences){
  assert.equal(r.x,null);assert.equal(r.y,null);
  assert.equal(r.romItemCoordinatesVerified,false);
  assert.equal(r.accessibleNow,null);
  assert.equal(r.collected,null);
 }
 assert.deepEqual(x.remainingRomItems.map(o=>[o.x,o.y]),pairs[226].green);
});
test('one coincident Red map-227 coordinate must not hide the other Green item',()=>{
 const x=run(227,GREEN,manual(pairs[227].red),pairs[227].green);
 assert.equal(x.verified,true);
 assert.equal(x.matchedManualItems.length,0);
 assert.equal(x.remainingRomItems.length,2);
 assert.deepEqual(x.remainingRomItems.map(o=>[o.x,o.y]),pairs[227].green);
});
test('Blue uses Blue ROM profile and must not borrow Green positions',()=>{
 const x=run(226,BLUE,manual(pairs[226].red),pairs[226].red);
 assert.equal(x.verified,true);
 assert.equal(x.matchedManualItems.length,3);
});
test('same coordinates but wrong item ID must not attach a manual item label',()=>{
 const c=[[5,5]];
 const m=manual(c);m[0].itemId=99;
 const x=run(4,GREEN,m,c);
 assert.equal(x.verified,true);
 assert.equal(x.matchedManualItems.length,0);
 assert.equal(x.remainingRomItems.length,1);
 assert.equal(x.unmatchedManualReferences.length,1);
});
test('ambiguous overlapping ROM item tiles never become an arbitrary manual match',()=>{
 const c=[[2,2],[2,2]];
 const x=run(40,RED,[{name:'Item',x:2,y:2}],c);
 assert.equal(x.verified,true);
 assert.equal(x.matchedManualItems.length,0);
 assert.equal(x.remainingRomItems.length,2);
});
test('no matching ROM item leaves the manual location outside actionable pins',()=>{
 const x=run(50,RED,[{name:'Manual',x:24,y:29}],[]);
 assert.equal(x.verified,true);
 assert.equal(x.matchedManualItems.length,0);
 assert.equal(x.unmatchedManualReferences.length,1);
 assert.equal(x.unmatchedManualReferences[0].referenceX,24);
 assert.equal(x.unmatchedManualReferences[0].x,null);
});
test('unknown SHA, unproven identity or wrong map fail closed',()=>{
 const m=manual([[2,3]]);
 const p=proof(226,[[2,3]]);
 for(const options of [
  {mapId:226,romSha256:'0'.repeat(64),romIdentityMatched:true},
  {mapId:226,romSha256:RED,romIdentityMatched:false},
  {mapId:227,romSha256:RED,romIdentityMatched:true},
  {mapId:226,romSha256:RED,romIdentityMatched:true,
   romAreaEvidence:{...p,verified:false}}
 ]){
  const x=reconcileVisibleItemCoordinates({
   mapId:226,romSha256:RED,romIdentityMatched:true,
   romAreaEvidence:p,manualItems:m,...options});
  assert.equal(x.verified,false);
  assert.equal(x.matchedManualItems.length,0);
  assert.equal(x.remainingRomItems.length,0);
  assert.equal(x.unmatchedManualReferences[0].x,null);
 }
});
test('duplicate object ordinals or inconsistent map object evidence fail closed',()=>{
 for(const mutation of [
  p=>p.items[1].objectOrdinal=1,
  p=>p.items[1].mapId=227,
  p=>p.items[1].source='MANUAL',
  p=>p.items[1].x=900,
  p=>p.items[1].kind='trainer'
 ]){
  const p=proof(226,pairs[226].red);
  mutation(p);
  const x=reconcileVisibleItemCoordinates({mapId:226,romSha256:RED,
   romIdentityMatched:true,romAreaEvidence:p,
   manualItems:manual(pairs[226].red)});
  assert.equal(x.verified,false);
  assert.equal(x.matchedManualItems.length,0);
 }
});
test('manual references with invalid coordinates never create map targets',()=>{
 const p=proof(5,[[1,1]]);
 const x=reconcileVisibleItemCoordinates({
  mapId:5,romSha256:RED,romIdentityMatched:true,
  romAreaEvidence:p,manualItems:[{name:'Invalid',x:999,y:1}]});
 assert.equal(x.verified,true);
 assert.equal(x.matchedManualItems.length,0);
 assert.equal(x.remainingRomItems.length,1);
 assert.equal(x.unmatchedManualReferences[0].referenceX,null);
});

test('runtime and cockpit use the ROM guard for both pins and manual warnings',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const client=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const ui=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(client,/const visibleCoordinateGuard=reconcileVisibleItemCoordinates\(\{/);
 assert.match(client,/const allVisItems=visibleCoordinateGuard\.matchedManualItems\.map/);
 assert.match(client,/const extraRomItems=visibleCoordinateGuard\.remainingRomItems/);
 assert.match(client,/manualVisibleItemReferences:\s*visibleCoordinateGuard\.unmatchedManualReferences/);
 assert.match(client,/visibleItemCoordinateEvidence:\{/);
 assert.match(ui,/const visibleProof=state\.areaInfo\?\.visibleItemCoordinateEvidence/);
 assert.match(ui,/não aparecem como itens para recolher nem como destinos de percurso/);
 assert.doesNotMatch(client,/const allVisItems = \(areaData\.visibleItems \|\| \[\]\)\.map/);
});

test('audited Red Blue Green ROMs preserve their own 226/227 item tiles',
 {skip:!['POKEMON_RED_ROM','POKEMON_BLUE_ROM','POKEMON_GREEN_ROM']
  .every(x=>process.env[x])?'Original three ROMs required':false},()=>{
 const {readRom,KNOWN}=require('../romComprehensiveAudit');
 const {inspectRomBuffer}=require('../romVariantRegistry');
 const {buildRomAreaEvidence}=require('../romAreaEvidence');
 const variants=[['red','POKEMON_RED_ROM',RED],
  ['blue','POKEMON_BLUE_ROM',BLUE],
  ['green','POKEMON_GREEN_ROM',GREEN]];
 const positions={
  red:{226:pairs[226].red,227:pairs[227].red},
  blue:{226:pairs[226].red,227:pairs[227].red},
  green:{226:pairs[226].green,227:pairs[227].green}
 };
 const proven={};
 for(const [variant,env,sha] of variants){
  const p=inspectRomBuffer(readRom(process.env[env]),variant+'.gb');
  assert.equal(p.hash.sha256,KNOWN[variant]);
  assert.equal(p.hash.sha256,sha);
  for(const mapId of [226,227]){
   const evidence=buildRomAreaEvidence(p.world.maps.data[mapId],
    [],null,{romIdentityMatched:true});
   assert.equal(evidence.verified,true);
   assert.deepEqual(evidence.items.map(x=>[x.x,x.y]),
    positions[variant][mapId]);
   const x=reconcileVisibleItemCoordinates({
    mapId,romSha256:sha,romIdentityMatched:true,
    romAreaEvidence:evidence,
    manualItems:manual(pairs[mapId].red)
   });
   assert.equal(x.verified,true,x.reason);
   assert.equal(x.romObjectCount,positions[variant][mapId].length);
   if(variant==='green'){
    assert.equal(x.matchedManualItems.length,0);
    assert.equal(x.remainingRomItems.length,positions.green[mapId].length);
   }else{
    assert.equal(x.matchedManualItems.length,positions[variant][mapId].length);
    assert.equal(x.remainingRomItems.length,0);
   }
   proven[variant+mapId]=true;
  }
 }
 assert.equal(Object.keys(proven).length,6);
});
