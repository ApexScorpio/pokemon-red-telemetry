'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildWorldEventAtlas,validateReferenceAtlas,MILESTONES}=
  require('../romWorldEventAtlas');
const events=require('../data/exact_events.json');
const toggles=require('../data/exact_visible_flags.json');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const hex=(n)=>Array(n).fill('00');
const fixture=()=>({romSha256:sha,romIdentityMatched:true,
  mapWindowVerified:true,eventFlagsHex:hex(320),toggleFlagsHex:hex(32)});
const set=(bytes,index)=>{bytes[index>>3]=
 (parseInt(bytes[index>>3],16)|(1<<(index&7))).toString(16).padStart(2,'0');};
test('the bundled reference atlas validates all 507 unique events and 228 ordered toggles',()=>{
 const v=validateReferenceAtlas();
 assert.equal(v.verified,true);
 assert.equal(v.eventCount,507);
 assert.equal(v.toggleCount,228);
 assert.equal(MILESTONES.length,12);
});
test('real bit indices, not labels, select individual story flags and object toggles',()=>{
 const x=fixture();
 set(x.eventFlagsHex,events.EVENT_GOT_HM01);
 set(x.eventFlagsHex,events.EVENT_BEAT_BROCK);
 set(x.toggleFlagsHex,toggles[27].toggleIndex);
 const a=buildWorldEventAtlas(x);
 assert.equal(a.verified,true);
 assert.equal(a.events.length,507);
 assert.equal(a.toggleFlags.length,228);
 assert.equal(a.summary.namedEventBitsSet,2);
 assert.equal(a.summary.toggleRemovedFlagBitsSet,1);
 assert.equal(a.events.find(e=>e.name==='EVENT_GOT_HM01').flagSet,true);
 assert.equal(a.toggleFlags[27].mapId,15);
 assert.equal(a.toggleFlags[27].removedFlagSet,true);
 assert.equal(a.toggleFlags[27].obtainedItemConfirmed,false);
 assert.equal(a.romBinaryScriptSemanticsVerified,false);
 assert.equal(a.snapshotAtomicVerified,false);
});
test('unset flags cannot be presented as success or as an accessible route',()=>{
 const a=buildWorldEventAtlas(fixture());
 assert.equal(a.verified,true);
 assert.equal(a.summary.namedEventBitsSet,0);
 assert.ok(a.milestones.every(x=>x.flagSet===false&&
   x.conditionSatisfiedNow===null&&x.actionConfirmed===false));
 assert.equal(a.mapToggleSummary.length,74);
 assert.equal(a.progressCompleteness,'PARTIAL');
});
test('unverified live context, incomplete RAM and wrong SHA fail closed',()=>{
 const good=fixture();
 assert.equal(buildWorldEventAtlas({...good,romIdentityMatched:false}).verified,false);
 assert.equal(buildWorldEventAtlas({...good,mapWindowVerified:false}).verified,false);
 assert.equal(buildWorldEventAtlas({...good,romSha256:'0'.repeat(64)}).verified,false);
 assert.equal(buildWorldEventAtlas({...good,eventFlagsHex:hex(319)}).verified,false);
 assert.equal(buildWorldEventAtlas({...good,toggleFlagsHex:hex(31)}).verified,false);
 assert.equal(buildWorldEventAtlas({...good,toggleFlagsHex:hex(32).map(()=>'?')}).verified,false);
});
test('unused map references remain references, not proof of a playable map',()=>{
 const a=buildWorldEventAtlas(fixture());
 const unused=a.toggleFlags.find(x=>x.mapId===244);
 assert.equal(unused.mapAssociationFromReference,true);
 assert.equal(unused.removedFromCurrentSceneConfirmed,false);
 assert.equal(unused.objectKindConfirmed,false);
});
test('a changed reference bit never asserts a player action or a captured Pokémon',()=>{
 const f=fixture();
 set(f.eventFlagsHex,events.EVENT_BEAT_ZAPDOS);
 const a=buildWorldEventAtlas(f);
 const named=a.events.find(x=>x.name==='EVENT_BEAT_ZAPDOS');
 assert.equal(named.flagSet,true);
 assert.equal(named.actionObserved,false);
 assert.equal(named.flagMeaning,'FLAG_SET_ONLY');
});
