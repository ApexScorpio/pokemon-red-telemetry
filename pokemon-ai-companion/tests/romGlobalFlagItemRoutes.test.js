'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {selectGlobalFlagTargets,planGlobalFlagItemRoutes}
 =require('../romGlobalFlagItemRoutes');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function fixture(){
 const mapProgress=Array.from({length:226},(_,mapId)=>({
   mapId,name:'Mapa '+mapId,
   flagRecords:{hiddenItems:[],hiddenCoins:[]}
 }));
 mapProgress[10].flagRecords.hiddenItems=[
   {bitIndex:9,flagSet:false,x:5,y:4,recordId:'hidden-item-9'},
   {bitIndex:10,flagSet:true,x:6,y:4,recordId:'hidden-item-10'}];
 mapProgress[10].flagRecords.hiddenCoins=[
   {bitIndex:3,flagSet:false,x:1,y:2,recordId:'hidden-coin-3'}];
 mapProgress[20].flagRecords.hiddenItems=[
   {bitIndex:11,flagSet:false,x:4,y:4,recordId:'hidden-item-11'}];
 return {ledger:{verified:true,romSha256:sha,mapCount:226,
   progressCompleteness:'PARTIAL',mapProgress},
   objectives:{verified:true,romSha256:sha,sourceMapId:0,mapCount:226,
     objectives:[{mapId:10,mapHopCount:2},{mapId:20,mapHopCount:3}]},
   sourceMapId:0};
}
test('selects exact remote hidden flags rather than generic map names',()=>{
 const s=selectGlobalFlagTargets(fixture());
 assert.equal(s.verified,true,s.reason);
 assert.equal(s.items.length,3);
 assert.deepEqual(s.items.map(x=>[x.kind,x.mapId,x.x,x.y]),
   [['HIDDEN_ITEM',10,5,4],['HIDDEN_COIN',10,1,2],
     ['HIDDEN_ITEM',20,4,4]]);
 assert.equal(s.items[0].flagPendingVerified,true);
 assert.equal(s.items[0].accessibleNow,null);
});
test('collected and local records never become remote to-dos',()=>{
 const f=fixture();
 f.objectives.objectives.unshift({mapId:0,mapHopCount:0});
 f.ledger.mapProgress[0].flagRecords.hiddenItems.push({
   bitIndex:0,flagSet:false,x:1,y:1});
 const s=selectGlobalFlagTargets(f);
 assert.equal(s.items.length,3);
 assert.equal(s.items.some(x=>x.mapId===0),false);
});
test('fewer requested targets conservatively truncates without changing order',()=>{
 const s=selectGlobalFlagTargets({...fixture(),maxTargets:2});
 assert.equal(s.items.length,2);assert.equal(s.limited,true);
 assert.equal(s.items[1].kind,'HIDDEN_COIN');
});
test('unknown SHA, mismatched current map or forged ledger fail closed',()=>{
 const f=fixture();
 assert.equal(selectGlobalFlagTargets({...f,
  ledger:{...f.ledger,romSha256:'0'.repeat(64)}}).verified,false);
 assert.equal(selectGlobalFlagTargets({...f,
  objectives:{...f.objectives,sourceMapId:4}}).verified,false);
 assert.equal(selectGlobalFlagTargets({...f,ledger:{...f.ledger,
  mapProgress:f.ledger.mapProgress.slice(0,225)}}).verified,false);
});
test('without proven RAM position no remote map traversal is guessed',()=>{
 const f=fixture();
 const s=planGlobalFlagItemRoutes({...f,position:{x:3,y:3},
   positionVerified:false});
 assert.equal(s.verified,false);
 assert.equal(s.accessibleNow,null);
});

test('remote pending hidden item gets its exact one-warp static route, never guaranteed access',()=>{
 const f=fixture(),crypto=require('node:crypto');
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const maps=Array.from({length:226},(_,mapId)=>{
   const n=25,tiles=Buffer.alloc(n,0x2c);
   const bits=Buffer.alloc(Math.ceil(n/8),0xff);
   return {mapId,width:5,height:5,tilesetId:0,verified:true,
     tileIdsBase64:tiles.toString('base64'),walkingBitsBase64:bits.toString('base64'),
     tileIdsSha256:hash(tiles),walkingBitsSha256:hash(bits),
     landBlockedTilePairs:[]};
 });
 const edges=Array.from({length:813},()=>({status:'LAST_MAP_RAM_REQUIRED'}));
 edges[0]={status:'STATIC_DESTINATION_WARP_VALIDATED',
   sourceMapId:0,sourceWarpIndex:0,x:1,y:1,destinationMapId:10,
   landing:{mapId:10,warpIndex:0,x:1,y:1}};
 const result=planGlobalFlagItemRoutes({...f,
   terrainAtlas:{verified:true,romSha256:sha,maps},
   warpGraph:{verified:true,romSha256:sha,totalWarpEntries:813,
     normalMapHeaders:226,edges},
   sourceMapId:0,position:{x:0,y:0},positionVerified:true,currentModeByte:0,
   canCut:false,canSurf:false,maxStates:20,maxTargets:3});
 assert.equal(result.verified,true,result.reason);
 assert.equal(result.items.length,3);
 assert.equal(result.items[0].route.verified,true);
 assert.equal(result.items[0].route.found,true,result.items[0].route.reason);
 assert.equal(result.items[0].route.transitionCount,1);
 assert.equal(result.items[0].route.target.mapId,10);
 assert.equal(result.items[0].route.target.x,5);
 assert.equal(result.items[0].route.target.y,4);
 assert.equal(result.items[0].accessibleNow,null);
 assert.equal(result.items[0].route.routeNavigableNowProven,false);
});
