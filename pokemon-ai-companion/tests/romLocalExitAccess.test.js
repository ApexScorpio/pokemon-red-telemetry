'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {localExitAccess}=require('../romLocalExitAccess');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function terrain(mapId,{barrier='TREE'}={}){
 const width=5,height=5,n=25;
 const tiles=Buffer.alloc(n,0x2c),bits=Buffer.alloc(4,0);
 for(let i=0;i<n;i++)bits[i>>3]|=1<<(i&7);
 if(mapId===0&&barrier)for(let y=0;y<height;y++){
   const i=y*width+2;
   tiles[i]=barrier==='TREE'?0x3d:0x14;
   bits[i>>3]&=~(1<<(i&7));
 }
 return {mapId,tilesetId:0,width,height,
   tileIdsBase64:tiles.toString('base64'),
   walkingBitsBase64:bits.toString('base64'),
   tileIdsSha256:hash(tiles),walkingBitsSha256:hash(bits),
   landBlockedTilePairs:[]};
}
function fixture({barrier='TREE'}={}){
 const maps=Array.from({length:226},(_,i)=>terrain(i,{barrier}));
 const edges=Array.from({length:813},()=>({status:'LAST_MAP_RAM_REQUIRED'}));
 edges[0]={sourceMapId:0,sourceWarpIndex:0,x:1,y:1,
   destinationMapId:1,destinationWarpIndex:0,
   status:'STATIC_DESTINATION_WARP_VALIDATED',
   landing:{mapId:1,warpIndex:0,x:1,y:1}};
 edges[1]={sourceMapId:0,sourceWarpIndex:1,x:4,y:1,
   destinationMapId:1,destinationWarpIndex:1,
   status:'STATIC_DESTINATION_WARP_VALIDATED',
   landing:{mapId:1,warpIndex:1,x:3,y:2}};
 edges[2]={sourceMapId:0,sourceWarpIndex:2,x:1,y:4,
   destinationMapId:255,destinationWarpIndex:0,
   status:'LAST_MAP_RAM_REQUIRED',landing:null};
 const borders=Array.from({length:78},()=>({
   sourceMapId:1,destinationMapId:2,direction:'west'}));
 borders[0]={sourceMapId:0,destinationMapId:12,direction:'north'};
 return {profile:{hash:{sha256:sha},world:{terrainAtlas:{
    verified:true,romSha256:sha,maps}}},
   warpGraph:{verified:true,romSha256:sha,totalWarpEntries:813,
    normalMapHeaders:226,edges,outdoorConnections:{
      verified:true,romSha256:sha,edgeCount:78,
      reciprocalConnections:78,edges:borders}},
   mapId:0,position:{x:0,y:2},mapSnapshotVerified:true,
   positionVerified:true,modeByte:0,canCut:false,canSurf:false,
   spritesVerified:true,mapEntities:[]};
}
test('all local warps and audited border are listed without claiming entry',()=>{
 const result=localExitAccess(fixture());
 assert.equal(result.verified,true);
 assert.equal(result.counts.WARP,3);
 assert.equal(result.counts.OUTDOOR_BORDER,1);
 assert.equal(result.exits[0].terrainStatus,'THEORETICAL_TERRAIN_PATH');
 assert.equal(result.exits[1].terrainStatus,'CUT_NOT_USABLE_IN_CURRENT_PARTY');
 assert.equal(result.exits[1].accessibleNow,null);
 assert.equal(result.exits[3].terrainStatus,
   'BORDER_CROSSING_TILE_NOT_VERIFIED');
 assert.equal(result.routeNavigableNowProven,undefined);
 assert.equal(result.accessNowProven,false);
});
test('Cut known available changes terrain hypothesis but not route guarantee',()=>{
 const result=localExitAccess({...fixture(),canCut:true});
 assert.equal(result.exits[1].terrainStatus,
   'TERRAIN_PATH_REQUIRES_CUT_ACTION');
 assert.equal(result.exits[1].approach.usesCut,true);
 assert.equal(result.exits[1].routeNavigableNowProven,false);
});
test('unknown Cut ownership stays unknown, not a confirmed obstacle',()=>{
 const result=localExitAccess({...fixture(),canCut:null});
 assert.equal(result.exits[1].terrainStatus,'CUT_CAPABILITY_NOT_VERIFIED');
});
test('water column yields Surf-required exit, distinct from Cut',()=>{
 const base=fixture({barrier:'WATER'});
 const result=localExitAccess(base);
 assert.equal(result.exits[1].terrainStatus,'SURF_NOT_USABLE_IN_CURRENT_PARTY');
 const surf=localExitAccess({...base,canSurf:true});
 assert.equal(surf.exits[1].terrainStatus,
   'TERRAIN_PATH_REQUIRES_SURF_ACTION');
 assert.equal(surf.exits[1].approach.usesSurf,true);
});
test('dynamic LAST_MAP warp does not fabricate a static destination',()=>{
 const result=localExitAccess(fixture());
 const last=result.exits.find(e=>e.sourceWarpIndex===2);
 assert.equal(last.staticDestinationStatus,'LAST_MAP_RAM_REQUIRED');
 assert.equal(last.destinationMapId,null);
 assert.equal(last.destinationRequiresScript,true);
});
test('obstructing live sprite can remove the current terrain candidate',()=>{
 const result=localExitAccess({...fixture(),
   mapEntities:[{x:1,y:1,type:'npc',pictureId:17}]});
 assert.equal(result.exits[0].terrainStatus,
   'NO_LOCAL_TERRAIN_PATH_NOT_PROOF_OF_LOCK');
});
test('floor menus remain labelled unverified even when listed from ROM',()=>{
 const a=fixture();
 a.elevatorChoices={verified:true,romSha256:sha,mapId:0,
   hasElevator:true,options:[{
     floorMenuIndex:0,destinationMapId:122,destinationWarpIndex:5}]};
 const result=localExitAccess(a),option=result.exits.at(-1);
 assert.equal(result.counts.ELEVATOR_MENU_CHOICE,1);
 assert.equal(option.terrainStatus,'FLOOR_SELECTION_AND_SCRIPT_NOT_VERIFIED');
 assert.equal(option.accessibleNow,null);
});
test('wrong ROM, stale map or bad terrain hashes reject local exits',()=>{
 const a=fixture();
 assert.equal(localExitAccess({...a,mapSnapshotVerified:false}).verified,false);
 assert.equal(localExitAccess({...a,position:{x:55,y:3}}).verified,false);
 assert.equal(localExitAccess({...a,profile:{...a.profile,
   hash:{sha256:'0'.repeat(64)}}}).verified,false);
 const bad=fixture();
 bad.profile.world.terrainAtlas.maps[0].walkingBitsSha256='0'.repeat(64);
 assert.equal(localExitAccess(bad).verified,false);
});
test('without validated border graph only static warp candidates appear',()=>{
 const a=fixture();a.warpGraph.outdoorConnections.verified=false;
 const result=localExitAccess(a);
 assert.equal(result.verified,true);
 assert.equal(result.counts.OUTDOOR_BORDER,undefined);
 assert.equal(result.counts.WARP,3);
});
