'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {elevatorOptionsForMap}=require('../romElevatorChoices');
const records=require('../data/gen1ElevatorsAudited.json');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function fixture(version=sha){
 const maps=Array.from({length:248},(_,mapId)=>({
   mapId,valid:mapId<226,objects:{warps:[]}
 }));
 for(const e of records.variants[version].elevators){
   maps[e.mapId].valid=true;
   for(const o of e.availableFloorOptions){
     const m=maps[o.destinationMapId];
     m.valid=true;
     while(m.objects.warps.length<=o.destinationWarpIndex)
       m.objects.warps.push({x:0,y:0,destinationMap:0,destinationWarp:0});
   }
 }
 // Keep exactly 226 normal headers after replacing any previously invalid ID.
 let count=maps.filter(m=>m.valid).length;
 for(let i=225;i>=0&&count>226;i--)if(![127,203,236].includes(i)){
   const needed=records.variants[version].elevators.some(e=>
     e.availableFloorOptions.some(o=>o.destinationMapId===i));
   if(!needed){maps[i].valid=false;count--;}
 }
 return {profile:{hash:{sha256:version},world:{maps:{valid:true,data:maps}}},
   romIdentityMatched:true,mapWindowVerified:true,mapId:127};
}
test('three elevator menus in the audited Red ROM expose exactly 5,3,11 destinations',()=>{
 const x=fixture(),counts=[[127,5],[203,3],[236,11]];
 for(const [mapId,n] of counts){
   const r=elevatorOptionsForMap({...x,mapId});
   assert.equal(r.verified,true);
   assert.equal(r.hasElevator,true);
   assert.equal(r.options.length,n);
   assert.ok(r.options.every(x=>x.accessibleNow===null&&
     x.selectedNow===null&&x.warpingScriptExecuted===false));
 }
});
test('regular map has no implied elevator or extra unlocked routes',()=>{
 const r=elevatorOptionsForMap({...fixture(),mapId:15});
 assert.equal(r.verified,true);
 assert.equal(r.hasElevator,false);
 assert.deepEqual(r.options,[]);
});
test('unknown ROM or no active CRC association does not expose floors',()=>{
 const x=fixture();
 assert.equal(elevatorOptionsForMap({...x,
   profile:{...x.profile,hash:{sha256:'0'.repeat(64)}}}).verified,false);
 assert.equal(elevatorOptionsForMap({...x,romIdentityMatched:false}).verified,false);
 assert.equal(elevatorOptionsForMap({...x,mapWindowVerified:false}).verified,false);
});
test('missing map header, incomplete graph or bad landing index fails closed',()=>{
 const x=fixture();
 x.profile.world.maps.data[15].valid=false;
 assert.equal(elevatorOptionsForMap(x).verified,false);
 const y=fixture();
 const target=records.variants[sha].elevators[0].availableFloorOptions[0];
 y.profile.world.maps.data[target.destinationMapId].objects.warps=[];
 assert.equal(elevatorOptionsForMap(y).verified,false);
});
test('no menu current floor may be asserted from static ROM option lists',()=>{
 const x=fixture(),v=elevatorOptionsForMap(x);
 assert.equal(v.usableNow,null);
 assert.equal(v.selectedFloorVerified,false);
 assert.equal(v.routeNavigableNowProven,false);
 assert.equal(v.snapshotAtomicVerified,false);
});

test('all three SHA-audited ROM variants expose their own 19 menu destinations',()=>{
 for(const version of Object.keys(records.variants)){
   const rig=fixture(version);
   const all=[127,203,236].map(mapId=>elevatorOptionsForMap({...rig,mapId}));
   assert.ok(all.every(r=>r.verified===true&&r.romSha256===version));
   assert.equal(all.reduce((n,r)=>n+r.options.length,0),19);
   assert.ok(all.every(r=>r.selectedFloorVerified===false));
 }
});
