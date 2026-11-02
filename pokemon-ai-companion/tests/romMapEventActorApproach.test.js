'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const {planEventActorApproaches}=require('../romMapEventActorApproach');
const sha=require('../romComprehensiveAudit').KNOWN.red;
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function terrain(type='cut'){
 const width=8,height=5,n=width*height;
 const tiles=Buffer.alloc(n,0x2c),walk=Buffer.alloc(Math.ceil(n/8),255);
 for(let y=0;y<height;y++){
  const i=y*width+3;
  tiles[i]=type==='cut'?0x3d:type==='surf'?0x14:0x2c;
  walk[i>>3]&=~(1<<(i&7));
 }
 return {verified:true,mapId:15,width,height,tilesetId:0,
  tileIdsBase64:tiles.toString('base64'),walkingBitsBase64:walk.toString('base64'),
  tileIdsSha256:digest(tiles),walkingBitsSha256:digest(walk),
  landBlockedTilePairs:[]};
}
const events=()=>({verified:true,mapId:15,romSha256:sha,
 summary:{mapEventBitCandidates:1},
 events:[{name:'EVENT_GOT_POKE_FLUTE',eventBitIndex:296,flagSet:false,
  actorReferences:[{x:6,y:2,ordinal:1,kind:'NPC',
   coordinatesFromRomHeader:true}]}]});
const input=(extra={})=>({
 namedEventMap:events(),terrain:terrain(),romSha256:sha,mapId:15,
 position:{x:1,y:2},mapSnapshotVerified:true,positionVerified:true,
 latePositionVerified:true,modeByte:0,
 canCut:false,canSurf:false,spritesVerified:true,mapEntities:[],
 ...extra
});
test('Cut blocks only hypothetical adjacent actor access, not the story event',()=>{
 const result=planEventActorApproaches(input());
 assert.equal(result.verified,true,result.reason);
 assert.equal(result.entries.length,1);
 assert.equal(result.entries[0].accessStatus,'NEEDS_CUT');
 assert.equal(result.entries[0].conditionalRoute.usesCut,true);
 assert.equal(result.entries[0].accessibleNow,null);
 assert.equal(result.entries[0].actorVisibleNow,null);
 assert.equal(result.entries[0].eventCompleted,null);
 assert.equal(result.accessibilityCertified,false);
 assert.equal(result.interactionExecuted,false);
 const withCut=planEventActorApproaches(input({canCut:true}));
 assert.equal(withCut.entries[0].accessStatus,'CONDITIONAL_PATH');
 assert.equal(withCut.entries[0].accessibleNow,null);
});
test('Surf yields only an unconfirmed geometric route',()=>{
 const result=planEventActorApproaches(input({terrain:terrain('surf')}));
 assert.equal(result.verified,true,result.reason);
 assert.equal(result.entries[0].accessStatus,'NEEDS_SURF');
 assert.equal(result.entries[0].conditionalRoute.usesSurf,true);
});
test('static proximity gives conditional path, not available-now access',()=>{
 const t=terrain('none');
 // Restore the empty bridge tiles to walking ground.
 const tiles=Buffer.from(t.tileIdsBase64,'base64'),
   bits=Buffer.from(t.walkingBitsBase64,'base64');
 for(let y=0;y<t.height;y++){
  const i=y*t.width+3;bits[i>>3]|=1<<(i&7);
 }
 t.walkingBitsBase64=bits.toString('base64');
 t.walkingBitsSha256=digest(bits);
 const result=planEventActorApproaches(input({terrain:t}));
 assert.equal(result.entries[0].accessStatus,'CONDITIONAL_PATH');
 assert.equal(result.entries[0].accessibleNow,null);
 assert.equal(result.entries[0].eventCompleted,null);
});
test('must reject stale position, wrong map/sha, missing provenance and invalid ROM bytes',()=>{
 const variations=[
  {latePositionVerified:false},{positionVerified:false},
  {mapSnapshotVerified:false},{romSha256:'f'.repeat(64)},
  {mapId:16},{terrain:{...terrain(),walkingBitsSha256:'0'.repeat(64)}},
  {modeByte:null},
  {namedEventMap:{...events(),romSha256:'f'.repeat(64)}},
  {namedEventMap:{...events(),events:[]}},
  {namedEventMap:{...events(),events:[{
   ...events().events[0],actorReferences:[{x:6,y:2,kind:'NPC',ordinal:1}]
  }]}}
 ];
 for(const variation of variations){
  const result=planEventActorApproaches(input(variation));
  assert.equal(result.verified,false,
   'Expected refusal for '+JSON.stringify(Object.keys(variation)));
  assert.equal(result.entries.length,0);
 }
});
test('handler-only associations have no invented actor coordinates or route',()=>{
 const noActor={...events(),events:[{...events().events[0],actorReferences:[]}]};
 const result=planEventActorApproaches(input({namedEventMap:noActor}));
 assert.equal(result.verified,true);
 assert.equal(result.entries.length,0);
});
test('runtime and UI wire the planner after map advice, with position guards',()=>{
 const client=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const i=client.indexOf('this.latestState.worldAdvisor=adviseWorld({');
 const j=client.indexOf('planEventActorApproaches({',i);
 assert.ok(i>=0&&j>i);
 assert.match(client.slice(j,j+1400),/latePositionVerified:latePositionWindow\.verified===true/);
 const ui=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(ui,/--- PERCURSOS CONDICIONAIS PARA ATORES DE EVENTOS ---/);
 assert.match(ui,/não confirma interação/);
});
