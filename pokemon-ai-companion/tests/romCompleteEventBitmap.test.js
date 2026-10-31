'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildCompleteEventBitmap}=require('../romCompleteEventBitmap');
const {buildWorldEventAtlas}=require('../romWorldEventAtlas');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const pinned=require('../data/gen1EventNamesPret.json');
const red=KNOWN.red;
const bytes=()=>Array(320).fill('00');
const toggle=()=>Array(32).fill('00');
const readback={
 verified:true,worldEventBytesMatched:320,
 allFlagBytesMatched:368,romAndMapCorroborated:true,
 snapshotAtomicVerified:false
};
const fixture=(interactionAtlas,romSha256=red,b=bytes())=>({
 romSha256,romIdentityMatched:true,mapPositionVerified:true,
 interactionAtlas,
 eventFlagsHex:b,
 globalFlagReadback:readback,
 namedAtlas:buildWorldEventAtlas({
  romSha256,romIdentityMatched:true,mapWindowVerified:true,
  eventFlagsHex:b,toggleFlagsHex:toggle()
 })
});
const actual=(variant,env)=>{
 const profile=inspectRomBuffer(readRom(process.env[env]),variant+'.gb');
 assert.equal(profile.hash.sha256,KNOWN[variant]);
 return profile.world.interactionScriptAtlas;
};
test('without authenticated profile/ROM opcode atlas, no 2560-bit claim',()=>{
 const f=fixture(null);
 assert.equal(buildCompleteEventBitmap(f).verified,false);
 assert.equal(buildCompleteEventBitmap({...f,romIdentityMatched:false}).verified,false);
 assert.equal(buildCompleteEventBitmap({...f,mapPositionVerified:false}).verified,false);
});
test('malformed 320 bytes, false readback and mismatched named flags fail closed',()=>{
 const a={verified:true,romSha256:red};
 const f=fixture(a);
 for(const change of [
  {eventFlagsHex:bytes().slice(0,319)},
  {eventFlagsHex:bytes().map(()=>'?')},
  {globalFlagReadback:{...readback,verified:false}},
  {globalFlagReadback:{...readback,worldEventBytesMatched:319}},
  {namedAtlas:{...f.namedAtlas,romSha256:KNOWN.blue}},
  {namedAtlas:{...f.namedAtlas,events:f.namedAtlas.events.slice(1)}},
  {namedAtlas:{...f.namedAtlas,events:[
   {...f.namedAtlas.events[0],flagSet:true},...f.namedAtlas.events.slice(1)
  ]}}
 ]){
  assert.equal(buildCompleteEventBitmap({...f,...change}).verified,false);
 }
});
test('all three original ROMs: all 2560 positions accounted for, no invented semantics',
 {skip:!['POKEMON_RED_ROM','POKEMON_BLUE_ROM','POKEMON_GREEN_ROM'].
  every(k=>process.env[k])?'Original ROM variables required':false},()=>{
 for(const [variant,env] of [
  ['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
  ['green','POKEMON_GREEN_ROM']
 ]){
  const sha=KNOWN[variant],atlas=actual(variant,env);
  const b=bytes();
  // Synthetic bits here test only index positions and the physical ROM.
  const unnamedBit=Object.keys(pinned.eventNamesByBit).length;
  b[319]='80'; // Highest world-event flag bit 2559.
  const x=buildCompleteEventBitmap(fixture(atlas,sha,b));
  assert.equal(x.verified,true,x.reason);
  assert.equal(x.bits.length,2560);
  assert.equal(x.bits[0].bitIndex,0);
  assert.equal(x.bits.at(-1).bitIndex,2559);
  assert.equal(x.bits[2559].flagSet,true);
  assert.equal(x.summary.setBits,1);
  assert.equal(x.summary.namedReferenceBits,507);
  assert.equal(x.summary.unnamedOrReservedBits,2053);
  assert.equal(x.summary.bitPositionsIndexed,2560);
  assert.equal(x.summary.ramBytesCorroborated,320);
  assert.equal(x.summary.bitPositionsWithDirectRomEvidence,400+
   x.summary.unnamedBitPositionsWithDirectRomEvidence);
  assert.equal(x.summary.unnamedBitPositionsWithoutDirectRomEvidence+
   x.summary.unnamedBitPositionsWithDirectRomEvidence,2053);
  assert.equal(x.bits.filter(e=>e.referenceName!==null).length,507);
  assert.ok(x.bits.every(e=>e.completed===null&&
   e.semanticMeaningVerified===false&&e.availableNow===null));
  assert.equal(x.snapshotAtomicVerified,false);
  assert.equal(x.gameplayCompletionCertified,false);
  // A pinned named bit can never mutate independently of the raw 320 bytes.
  const named=Object.entries(pinned.eventNamesByBit)[0];
  const modified=fixture(atlas,sha,b);
  modified.namedAtlas.events.find(e=>e.eventBitIndex===Number(named[0])).flagSet=
   !modified.namedAtlas.events.find(e=>e.eventBitIndex===Number(named[0])).flagSet;
  assert.equal(buildCompleteEventBitmap(modified).verified,false);
 }
});
test('runtime forwards the corroborated D747 flags to the advisor that builds 2560 bits',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const client=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 const advisor=fs.readFileSync(path.join(__dirname,'../romWorldStateAdvisor.js'),'utf8');
 // RetroArchClient is responsible for reading RAM and passing the bytes.
 // The advisor, not RetroArchClient, owns the actual bitmap builder.
 const adviceStart=client.indexOf('this.latestState.worldAdvisor=adviseWorld({');
 const flags=client.indexOf('globalEventFlagsHex:eventFlagsRaw,',adviceStart);
 const readback=client.indexOf('globalFlagReadback,',adviceStart);
 assert.ok(adviceStart>0&&flags>adviceStart&&readback>adviceStart);
 assert.ok(client.indexOf('buildCompleteEventBitmap(')<0,
  'No duplicate full bit scan in the memory client');
 const build=advisor.indexOf('const completeEventBitmap=buildCompleteEventBitmap({');
 assert.ok(build>0);
 const call=advisor.slice(build,build+390);
 assert.match(call,/interactionAtlas:scriptAtlas,namedAtlas:namedWorldEventAtlas/);
 assert.match(call,/eventFlagsHex:globalEventFlagsHex,globalFlagReadback/);
 assert.match(advisor,/romCompleteEventBitmap:completeEventBitmap/);
});
