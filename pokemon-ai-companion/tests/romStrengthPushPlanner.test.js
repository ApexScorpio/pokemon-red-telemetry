'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {planStrengthPushes}=require('../romStrengthPushPlanner');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function fixture(){
 const width=7,height=3,n=width*height;
 const tiles=Buffer.alloc(n,0x10),bits=Buffer.alloc(Math.ceil(n/8));
 for(let x=0;x<width;x++){const i=width+x;tiles[i]=0x2c;bits[i>>3]|=1<<(i&7);}
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 return {romSha256:sha,terrain:{mapId:21,verified:true,tilesetId:0,
   width,height,tileIdsBase64:tiles.toString('base64'),
   walkingBitsBase64:bits.toString('base64'),
   tileIdsSha256:hash(tiles),walkingBitsSha256:hash(bits),
   landBlockedTilePairs:[]},
   position:{x:1,y:1},target:{x:5,y:1,hidden:false},
   positionVerified:true,spritesVerified:true,
   actors:[{x:2,y:1,type:'boulder',pictureId:63}],canStrength:true,
   maxStates:400,maxPushes:6};
}
test('realistic corridor sequence requires boulder pushes, never certifies execution',()=>{
 const r=planStrengthPushes(fixture());
 assert.equal(r.verified,true,r.reason);assert.equal(r.found,true,r.reason);
 assert.ok(r.pushCount>=1);assert.equal(r.pushCount,r.pushes.length);
 assert.deepEqual(r.pushes[0].from,{x:2,y:1});
 assert.equal(r.strengthActivationVerified,false);
 assert.equal(r.doublePushAttemptRequired,true);
 assert.equal(r.accessibleNow,null);
 assert.equal(r.routeNavigableNowProven,false);
});
test('known missing Rainbow Badge or move gives hypothesis, never current access',()=>{
 const f=fixture();f.canStrength=false;
 const r=planStrengthPushes(f);
 assert.equal(r.found,true);assert.equal(r.abilityKnown,false);
 assert.equal(r.accessibleNow,null);
});
test('stationary NPC occupying push destination prevents route',()=>{
 const f=fixture();f.actors.push({x:3,y:1,type:'npc'});
 const r=planStrengthPushes(f);
 assert.equal(r.verified,true);assert.equal(r.found,false);
});
test('wrong SHA, unverified sprites or player location cannot create plan',()=>{
 const f=fixture();
 assert.equal(planStrengthPushes({...f,romSha256:'0'.repeat(64)}).verified,false);
 assert.equal(planStrengthPushes({...f,spritesVerified:false}).verified,false);
 assert.equal(planStrengthPushes({...f,positionVerified:false}).verified,false);
});
test('insufficient number of pushes is not evidence of permanent blockage',()=>{
 const f=fixture();f.maxPushes=1;
 const r=planStrengthPushes(f);
 assert.equal(r.found,false);assert.equal(r.accessibleNow,null);
 assert.match(r.reason,/não prova bloqueio/i);
});

function itemSpriteFixture(){
 const f=fixture(),width=7,height=5;
 const tiles=Buffer.alloc(width*height,0x10);
 const bits=Buffer.alloc(Math.ceil(width*height/8));
 const allow=(x,y)=>{
   const n=y*width+x;tiles[n]=0x2c;bits[n>>3]|=1<<(n&7);
 };
 for(let x=1;x<=5;x++)allow(x,2);
 for(let x=1;x<=3;x++)allow(x,3);
 allow(3,1);
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 Object.assign(f.terrain,{width,height,
   tileIdsBase64:tiles.toString('base64'),
   walkingBitsBase64:bits.toString('base64'),
   tileIdsSha256:hash(tiles),walkingBitsSha256:hash(bits)});
 f.position={x:1,y:2};f.target={x:5,y:2,hidden:false};
 f.actors=[{x:3,y:2,type:'boulder',pictureId:63},
   {x:5,y:2,type:'item',pictureId:61}];
 return f;
}
test('visible item sprite at target remains interactable after a legal side push',()=>{
 const f=itemSpriteFixture(),r=planStrengthPushes(f);
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.found,true,r.reason);
 assert.equal(r.pushCount,1);
 assert.deepEqual(r.pushes[0].from,{x:3,y:2});
 assert.deepEqual(r.pushes[0].to,{x:3,y:1});
 assert.equal(r.accessibleNow,null);
 assert.equal(r.pushExecutionVerified,false);
});
test('NPC at exact item target remains a genuine blocker, not an item sprite',()=>{
 const f=itemSpriteFixture();
 f.actors[1]={x:5,y:2,type:'npc',pictureId:13};
 const r=planStrengthPushes(f);
 assert.equal(r.verified,true);
 assert.equal(r.found,false);
 assert.equal(r.accessibleNow,null);
});
test('hidden item behind occupied sprite cannot claim a legal interaction',()=>{
 const f=itemSpriteFixture();
 f.target.hidden=true;
 const r=planStrengthPushes(f);
 assert.equal(r.verified,true);
 assert.equal(r.found,false);
});
