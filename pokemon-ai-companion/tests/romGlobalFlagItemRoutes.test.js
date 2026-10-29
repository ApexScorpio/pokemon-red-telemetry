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
