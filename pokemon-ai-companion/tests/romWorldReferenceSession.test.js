'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compareReferenceBits,WorldReferenceFlagSession}=require('../romWorldReferenceSession');
const RED='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const BLUE='2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d';
function atlas(sha=RED){
 return {verified:true,romSha256:sha,summary:{
   namedEventBits:507,referenceToggleBits:228},
   events:Array.from({length:507},(_,i)=>({
     name:'EVENT_DE_TESTE_'+i,eventBitIndex:i,flagSet:false})),
   toggleFlags:Array.from({length:228},(_,i)=>({
     name:'TOGGLE_DE_TESTE_'+i,mapId:i%200,toggleIndex:i,removedFlagSet:false}))};
}
const clone=x=>JSON.parse(JSON.stringify(x));
const feed=(s,a)=>s.ingest({atlas:a,observedAt:'2026-10-29T20:00:00Z'});
test('first RAM frame only establishes a reference baseline',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();
 a.events[34].flagSet=true;
 const r=feed(s,a);
 assert.equal(r.delta.verified,false);
 assert.equal(r.recent.baselineEstablished,true);
 assert.equal(r.recent.events.length,0);
});
test('detects two named event transitions without claiming completed mission',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();feed(s,a);
 const next=clone(a);next.events[34].flagSet=true;
 next.events[35].flagSet=true;
 const r=feed(s,next);
 assert.equal(r.delta.verified,true);
 assert.deepEqual(r.delta.changes.map(x=>x.eventBitIndex),[34,35]);
 assert.equal(r.delta.changes[0].playerActionConfirmed,false);
 assert.equal(r.delta.scriptEffectsComplete,false);
 assert.equal(r.recent.events.length,2);
});
test('reports toggle activation and deactivation separately from item pickup',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();feed(s,a);
 const b=clone(a);b.toggleFlags[27].removedFlagSet=true;feed(s,b);
 const c=clone(b);c.toggleFlags[27].removedFlagSet=false;
 const r=feed(s,c);
 assert.equal(r.delta.verified,true);
 assert.equal(r.delta.changes[0].flagSet,false);
 assert.equal(r.delta.changes[0].itemCollectedConfirmed,false);
 assert.equal(r.recent.events.length,2);
});
test('wrong SHA or missing fields clear old history',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();feed(s,a);
 const b=clone(a);b.events[34].flagSet=true;feed(s,b);
 const bad=feed(s,{...b,verified:false});
 assert.equal(bad.recent.verified,false);
 assert.equal(bad.recent.events.length,0);
 const fresh=feed(s,b);
 assert.equal(fresh.delta.verified,false);
 assert.equal(fresh.recent.events.length,0);
});
test('switching from Red to Blue refuses previous ROM deltas',()=>{
 const s=new WorldReferenceFlagSession();feed(s,atlas());
 const b=atlas(BLUE);b.events[5].flagSet=true;
 const r=feed(s,b);
 assert.equal(r.delta.verified,false);
 assert.equal(r.recent.romSha256,BLUE);
 assert.equal(r.recent.events.length,0);
});
test('reordering or relabeling ROM reference rows is not a valid event',()=>{
 const a=atlas(),b=clone(a);b.events[0].name='EVENT_FALSO';
 const r=compareReferenceBits(a,b);
 assert.equal(r.verified,false);
 assert.match(r.reason,/alterado/);
});
test('timeline remains bounded to 80 changes',()=>{
 const s=new WorldReferenceFlagSession();let a=atlas();feed(s,a);
 for(let i=0;i<100;i++){
   const b=clone(a);b.events[i].flagSet=!a.events[i].flagSet;
   feed(s,b);a=b;
 }
 assert.equal(s.events.length,80);
 assert.equal(s.events[0].eventBitIndex,20);
});
test('returned timeline entries are copies and cannot mutate session history',()=>{
 const s=new WorldReferenceFlagSession(),a=atlas();feed(s,a);
 const b=clone(a);b.events[3].flagSet=true;
 const r=feed(s,b);r.recent.events[0].name='ALTERADO';
 assert.equal(s.events[0].name,'EVENT_DE_TESTE_3');
});
