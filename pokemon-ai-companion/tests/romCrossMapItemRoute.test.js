'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {findCrossMapItemPath}=require('../romCrossMapItemRoute');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function terrain(mapId,{wall=false}={}){
 const width=5,height=5,n=width*height;
 const tiles=Buffer.alloc(n,0x2c),bits=Buffer.alloc(Math.ceil(n/8),0);
 for(let i=0;i<n;i++)bits[i>>3]|=1<<(i&7);
 if(wall)for(let y=0;y<height;y++){
   const i=y*width+2;tiles[i]=0x10;
   bits[i>>3]&=~(1<<(i&7));
 }
 return {mapId,width,height,tilesetId:0,
   tileIdsBase64:tiles.toString('base64'),walkingBitsBase64:bits.toString('base64'),
   tileIdsSha256:hash(tiles),walkingBitsSha256:hash(bits),
   landBlockedTilePairs:[]};
}
function fixture(){
 const maps=Array.from({length:226},(_,mapId)=>terrain(mapId,{wall:mapId===0}));
 const graph={
   verified:true,romSha256:sha,totalWarpEntries:813,normalMapHeaders:226,
   edges:Array.from({length:813},()=>({status:'LAST_MAP_RAM_REQUIRED'}))
 };
 graph.edges[0]={sourceMapId:0,sourceWarpIndex:0,x:1,y:1,
  destinationMapId:1,status:'STATIC_DESTINATION_WARP_VALIDATED',
  landing:{mapId:1,warpIndex:0,x:1,y:1}};
 graph.edges[1]={sourceMapId:1,sourceWarpIndex:0,x:1,y:1,
  destinationMapId:0,status:'STATIC_DESTINATION_WARP_VALIDATED',
  landing:{mapId:0,warpIndex:1,x:4,y:3}};
 return {romSha256:sha,terrainAtlas:{verified:true,romSha256:sha,maps},
   warpGraph:graph,sourceMapId:0,position:{x:0,y:2},
   target:{mapId:0,x:4,y:2,hidden:false},
   positionVerified:true,currentModeByte:0,canCut:false,canSurf:false};
}
test('item behind one-way barrier can have a conditional two-warp detour',()=>{
 const r=findCrossMapItemPath(fixture());
 assert.equal(r.verified,true);
 assert.equal(r.found,true);
 assert.equal(r.warpTransitions,2);
 assert.deepEqual(r.segments.map(x=>x.destinationMapId),[1,0]);
 assert.equal(r.routeNavigableNowProven,false);
 assert.equal(r.accessibleNow,null);
 assert.ok(r.theoreticalSteps>=0);
});
test('disabled or missing second warp never implies permanent inaccessibility',()=>{
 const f=fixture();f.warpGraph.edges[1].status='LAST_MAP_RAM_REQUIRED';
 const r=findCrossMapItemPath(f);
 assert.equal(r.verified,true);assert.equal(r.found,false);
 assert.equal(r.accessibleNow,null);
 assert.match(r.reason,/não prova bloqueio/i);
});
test('one transition limit cannot invent return trip',()=>{
 const r=findCrossMapItemPath({...fixture(),maxTransitions:1});
 assert.equal(r.found,false);
});
test('wrong SHA, stale RAM or partial warps reject all routing',()=>{
 const f=fixture();
 assert.equal(findCrossMapItemPath({...f,romSha256:'0'.repeat(64)}).verified,false);
 assert.equal(findCrossMapItemPath({...f,positionVerified:false}).verified,false);
 assert.equal(findCrossMapItemPath({...f,terrainAtlas:{...f.terrainAtlas,
   romSha256:'0'.repeat(64)}}).verified,false);
 const corrupt=fixture();corrupt.warpGraph.edges.pop();
 assert.equal(findCrossMapItemPath(corrupt).verified,false);
});
test('observed actor blocking source warp prevents this static route',()=>{
 const f=fixture();
 f.spritesVerified=true;
 f.currentMapEntities=[{x:1,y:1,type:'npc',pictureId:17}];
 const r=findCrossMapItemPath(f);
 assert.equal(r.found,false);
});
test('route is not confused with a local unreachable item',()=>{
 const f=fixture();f.warpGraph.edges[0].status='LAST_MAP_RAM_REQUIRED';
 const r=findCrossMapItemPath(f);
 assert.equal(r.found,false);
});
