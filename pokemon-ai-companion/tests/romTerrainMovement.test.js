'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {inspectMovementOptions}=require('../romTerrainMovement');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture({tiles=[0x14,0x48,0x2c,0x32],pass=[0x14,0x48,0x2c,0x32],tilesetId=0,
 landPairs=[],waterPairs=[]}={}){
 const b=Buffer.from(tiles),bits=Buffer.alloc(1);
 for(let i=0;i<4;i++)if(pass.includes(b[i]))bits[0]|=1<<i;
 const m={mapId:0,tilesetId,width:2,height:2,tileIdsBase64:b.toString('base64'),
  tileIdsSha256:sha(b),walkingBitsBase64:bits.toString('base64'),
  walkingBitsSha256:sha(bits),landBlockedTilePairs:landPairs,source:'TEST'};
 return {m,atlas:{verified:true,maps:[m],waterTilePairs:waterPairs.map(([tile1,tile2])=>({tilesetId,tile1,tile2}))}};
}
test('SURF water tiles 0x14/0x48, walking shore dismount, and 0x32 special case',()=>{
 const {m,atlas}=fixture();
 const r=inspectMovementOptions(m,atlas,{x:0,y:0},2,{mapSnapshotVerified:true});
 assert.equal(r.verified,true);assert.equal(r.actualMovementVerified,false);
 assert.equal(r.neighbors.find(x=>x.direction==='east').staticOutcome,'SURF_CAN_CONTINUE_IF_NO_DYNAMIC_OBSTACLE');
 assert.equal(r.neighbors.find(x=>x.direction==='south').staticOutcome,'SURF_CAN_DISEMBARK_IF_NO_DYNAMIC_OBSTACLE');
 const p=fixture({tiles:[0x14,0x32,0x14,0x14],tilesetId:14});
 const port=inspectMovementOptions(p.m,p.atlas,{x:0,y:0},2,{mapSnapshotVerified:true});
 assert.equal(port.neighbors.find(x=>x.direction==='east').staticOutcome,'SURF_CAN_DISEMBARK_IF_NO_DYNAMIC_OBSTACLE');
});
test('underwater forbidden tile pair blocks an otherwise water-class tile',()=>{
 const {m,atlas}=fixture({waterPairs:[[0x14,0x48]]});
 const r=inspectMovementOptions(m,atlas,{x:0,y:0},2,{mapSnapshotVerified:true});
 assert.equal(r.neighbors.find(x=>x.direction==='east').pairCollision,true);
 assert.equal(r.neighbors.find(x=>x.direction==='east').staticOutcome,'SURF_PAIR_COLLISION');
});
test('on land a forbidden pair dominates target tileset passability',()=>{
 const {m,atlas}=fixture({landPairs:[[0x14,0x48]]});
 const r=inspectMovementOptions(m,atlas,{x:0,y:0},0,{mapSnapshotVerified:true});
 assert.equal(r.neighbors.find(x=>x.direction==='east').staticOutcome,'LAND_PAIR_COLLISION_POSSIBLE_LEDGE_EXCEPTION');
 assert.equal(r.neighbors.find(x=>x.direction==='south').staticOutcome,'LAND_STATIC_PERMITTED_IF_NO_DYNAMIC_OBSTACLE');
});
test('invalid/missing RAM or movement byte fails closed, not defaulting to WALK',()=>{
 const {m,atlas}=fixture();
 for(const v of [null,undefined,-1,3,255,'02'])assert.equal(inspectMovementOptions(m,atlas,{x:0,y:0},v,{mapSnapshotVerified:true}).verified,false);
 assert.equal(inspectMovementOptions(m,atlas,{x:0,y:0},0).verified,false);
 assert.equal(inspectMovementOptions(m,atlas,{x:-1,y:0},0,{mapSnapshotVerified:true}).verified,false);
});
test('neighbors outside map are not considered traversable',()=>{
 const {m,atlas}=fixture();const r=inspectMovementOptions(m,atlas,{x:0,y:0},1,{mapSnapshotVerified:true});
 assert.equal(r.neighbors.find(x=>x.direction==='north').staticOutcome,'OUTSIDE_MAP_NEEDS_BORDER');
 assert.equal(r.neighbors.find(x=>x.direction==='west').traversableNowVerified,false);
 assert.equal(r.mode,'BIKE');
});