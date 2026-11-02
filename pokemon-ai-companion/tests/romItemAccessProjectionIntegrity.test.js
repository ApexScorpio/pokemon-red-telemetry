'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
const start=source.indexOf('    const accessSummary=Array.isArray(itemAccess?.results)?');
const end=source.indexOf('    const visibleWithPath=withPath.slice(',start);
assert.ok(start>=0&&end>start,'Real planner projection missing');
const body='function project(){\n'+source.slice(start,end)+
 '\nreturn withPath;\n}\nproject.call(currentClient);';
const ROM='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function sample(){
 return {
  accessInput:[
   {x:4,y:3,itemId:17,romItemCoordinatesVerified:true,requires:'CUT'},
   {x:9,y:5,itemId:19,romItemCoordinatesVerified:true},
   {x:5,y:6,hiddenIndex:1,romItemCoordinatesVerified:true,isCollected:false}],
  itemAccess:{verified:true,mapId:15,romSha256:ROM,results:[
   {index:0,x:4,y:3,accessStatus:'NEEDS_CUT',reason:'Cut requerido',route:{steps:4}},
   {index:1,x:9,y:5,accessStatus:'CONDITIONAL_PATH',reason:'Geometria',route:{steps:8}},
   {index:2,x:5,y:6,accessStatus:'NEEDS_SURF',reason:'Surf requerido',route:{steps:9}}]},
  currentClient:{activeRomProfile:{hash:{sha256:ROM}},
   latestState:{mapId:15,romRuntimeIdentity:{matched:true},
   memoryReadStatus:{verified:true}}}
 };
}
const run=s=>Array.from(vm.runInNewContext(body,s,{timeout:1500}));
const unknown=row=>{
 assert.equal(row.accessStatus,'UNKNOWN');
 assert.equal(row.isLocked,false);
 assert.equal(row.accessRoute,null);
 assert.equal(row.accessibleNow,null);
 assert.equal(row.lockReason,null);
};
test('verified plans retain own exact item and hidden-item paths but no access claim',()=>{
 const out=run(sample());
 assert.equal(out[0].accessStatus,'NEEDS_CUT');
 assert.equal(out[0].isLocked,true);
 assert.equal(out[0].accessRoute.steps,4);
 assert.equal(out[0].manualRequirementHint,'CUT');
 assert.equal(out[1].accessStatus,'CONDITIONAL_PATH');
 assert.equal(out[1].isLocked,false);
 assert.equal(out[1].accessRoute.steps,8);
 assert.equal(out[2].hiddenIndex,1);
 assert.equal(out[2].isLocked,true);
 assert.equal(out[2].accessRoute.steps,9);
 assert.ok(out.every(r=>r.accessibleNow===null));
});
test('swapped indices cannot transfer a route or Cut lock to another item',()=>{
 const s=sample();s.itemAccess.results[0].index=1;
 s.itemAccess.results[1].index=0;
 const out=run(s);unknown(out[0]);unknown(out[1]);
 assert.equal(out[2].accessStatus,'NEEDS_SURF');
});
test('wrong result X or Y fails closed per item without hiding unrelated paths',()=>{
 for(const change of [r=>{r.x=99;},r=>{r.y=99;}]){
  const s=sample();change(s.itemAccess.results[0]);
  const out=run(s);unknown(out[0]);
  assert.equal(out[1].accessStatus,'CONDITIONAL_PATH');
 }
});
test('moved source item cannot inherit route for old coordinates',()=>{
 const s=sample();s.accessInput[0].x=8;
 const out=run(s);unknown(out[0]);
 assert.equal(out[1].accessRoute.steps,8);
});
test('map or active ROM mismatch suppresses all planner labels',()=>{
 for(const change of [
  s=>{s.itemAccess.mapId=16;},s=>{s.currentClient.latestState.mapId=16;},
  s=>{s.itemAccess.romSha256='0'.repeat(64);},
  s=>{s.currentClient.activeRomProfile.hash.sha256='0'.repeat(64);}
 ]){
  const s=sample();change(s);for(const row of run(s))unknown(row);
 }
});
test('unverified plan, ROM identity or RAM session never applies a blocker',()=>{
 for(const change of [
  s=>{s.itemAccess.verified=false;},
  s=>{s.currentClient.latestState.romRuntimeIdentity.matched=false;},
  s=>{s.currentClient.latestState.memoryReadStatus.verified=false;}
 ]){
  const s=sample();change(s);for(const row of run(s))unknown(row);
 }
});
test('missing, surplus and malformed rows invalidate the entire plan projection',()=>{
 for(const change of [
  s=>{s.itemAccess.results.pop();},
  s=>{s.itemAccess.results.push({index:3,x:6,y:6,accessStatus:'NEEDS_CUT'});},
  s=>{s.itemAccess.results={};},
  s=>{s.itemAccess.results=null;}
 ]){
  const s=sample();change(s);for(const row of run(s))unknown(row);
 }
});
test('unverified coordinates and missing index/status cannot borrow any path',()=>{
 for(const change of [
  s=>{s.accessInput[0].romItemCoordinatesVerified=false;},
  s=>{delete s.accessInput[0].x;},
  s=>{s.itemAccess.results[0].index=null;},
  s=>{s.itemAccess.results[0].accessStatus=null;}
 ]){
  const s=sample();change(s);unknown(run(s)[0]);
 }
});
