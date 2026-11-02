'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {collectScriptedBattleLiveReadback}=
 require('../romScriptedBattleLiveReadback');
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const maps=[
 {mapId:96,ordinal:2,handlerBank:24,referenceVariable:'wSSAnne2FCurScript',
  referenceWramAddress:0xd665,worldBlockOffset:197,
  referenceLayoutOnly:true,addressProvenFromActualRomInstructions:false},
 {mapId:135,ordinal:11,handlerBank:18,referenceVariable:'wGameCornerCurScript',
  referenceWramAddress:0xd65f,worldBlockOffset:191,
  referenceLayoutOnly:true,addressProvenFromActualRomInstructions:false}
];
const profile=()=>({hash:{sha256:SHA},world:{interactionScriptAtlas:{
 scriptedBattleRamCandidates:{verified:true,romSha256:SHA,count:2,
  candidates:maps.map(x=>({...x}))}
}}});
function setup(mapId=96,value='02'){
 const firstWorldBlockHex=Array(784).fill('00');
 firstWorldBlockHex[mapId===96?197:191]=value;
 const requests=[];
 const target={host:'192.168.1.145',port:55355};
 const opts={profile:profile(),mapId,firstWorldBlockHex,
  firstMapByte:mapId.toString(16).padStart(2,'0'),
  firstYByte:'07',firstXByte:'11',eligible:true,
  getTarget:()=>({...target}),
  readMemoryBlock:async(address,length)=>{
   requests.push([address,length]);
   if(address==='D35E')return [mapId.toString(16).padStart(2,'0'),
    '00','00','07','11','00','00','00'];
   return [value];
  }};
 return {opts,requests,target};
}
test('read-only, two requests, repeat of map and position, only reference status',async()=>{
 const {opts,requests}=setup();
 const a=await collectScriptedBattleLiveReadback(opts);
 assert.equal(a.verified,true,a.status);
 assert.deepEqual(requests,[['D665',1],['D35E',8]]);
 assert.equal(a.scriptValue,2);
 assert.equal(a.referenceStateName,'SCRIPT_SSANNE2F_RIVAL_AFTER_BATTLE');
 assert.equal(a.battleWon,null);
 assert.equal(a.snapshotAtomicVerified,false);
 assert.equal(a.gameProgressCertified,false);
 assert.equal(a.readback.secondReadFromSameTargetVerified,true);
 assert.equal(a.readOnlyReadCalls,2);
 assert.equal(a.underlyingUdpPacketCount,null);
});
test('Game Corner independently reads D65F and does not assert Rocket victory',async()=>{
 const {opts,requests}=setup(135,'01');
 const a=await collectScriptedBattleLiveReadback(opts);
 assert.equal(a.verified,true,a.status);
 assert.deepEqual(requests,[['D65F',1],['D35E',8]]);
 assert.equal(a.referenceStateName,'SCRIPT_GAMECORNER_ROCKET_BATTLE');
 assert.equal(a.battleWon,null);
});
test('all other 246 maps trigger zero network commands',async()=>{
 for(const mapId of [0,15,95,97,134,136,247]){
  const {opts,requests}=setup(mapId);
  const a=await collectScriptedBattleLiveReadback(opts);
  assert.equal(a.verified,false);
  assert.equal(a.status,'MAP_NOT_SCRIPTED_BATTLE');
  assert.equal(requests.length,0);
 }
});
test('stale identity, missing world, or initial map mismatch trigger no commands',async()=>{
 for(const field of ['eligible','firstWorldBlockHex','firstMapByte','profile']){
  const {opts,requests}=setup();
  if(field==='eligible')opts.eligible=false;
  if(field==='firstWorldBlockHex')opts.firstWorldBlockHex=[];
  if(field==='firstMapByte')opts.firstMapByte='87';
  if(field==='profile')opts.profile.hash.sha256='0'.repeat(64);
  const a=await collectScriptedBattleLiveReadback(opts);
  assert.equal(a.verified,false,field);
  assert.equal(requests.length,0,field);
 }
});
test('second script mismatch cannot become a verified readback',async()=>{
 const {opts,requests}=setup();
 opts.readMemoryBlock=async(a,b)=>{
  requests.push([a,b]);
  return a==='D665'?['03']:['60','00','00','07','11','00','00','00'];
 };
 const x=await collectScriptedBattleLiveReadback(opts);
 assert.equal(x.verified,false);
 assert.match(x.status,/SCRIPT_BYTE_CORROBORATION_REJECTED/);
 assert.equal(x.readback,null);
});
test('map, position or network target changing between samples is rejected',async()=>{
 for(const mode of ['map','position','target']){
  const {opts,target}=setup();
  opts.readMemoryBlock=async(address)=>{
   if(address==='D665'){if(mode==='target')target.port++;return ['02']}
   return [mode==='map'?'87':'60','00','00',
    mode==='position'?'08':'07','11','00','00','00'];
  };
  const x=await collectScriptedBattleLiveReadback(opts);
  assert.equal(x.verified,false,mode);
  assert.equal(x.readback,null);
 }
});
test('failed extra read is nonfatal, no emulator input or recovery attempted',async()=>{
 const {opts,requests}=setup();
 opts.readMemoryBlock=async(a,b)=>{requests.push([a,b]);throw Object.assign(
  new Error('timeout'),{code:'READ_TIMEOUT'})};
 const x=await collectScriptedBattleLiveReadback(opts);
 assert.equal(x.verified,false);
 assert.equal(x.status,'OPTIONAL_SCRIPT_READ_ERROR_READ_TIMEOUT');
 assert.deepEqual(requests,[['D665',1]]);
 assert.equal(x.readOnlyRequests,1);
});
test('world block with altered script byte or malformed read fails closed',async()=>{
 const {opts}=setup();
 opts.firstWorldBlockHex[197]='03';
 const x=await collectScriptedBattleLiveReadback(opts);
 assert.equal(x.verified,false);
 const bad=setup();bad.opts.readMemoryBlock=async()=>null;
 const y=await collectScriptedBattleLiveReadback(bad.opts);
 assert.equal(y.verified,false);
 assert.equal(y.readOnlyRequests,1);
});

test('all 246 non-special maps refuse to send any memory command',async()=>{
 for(let mapId=0;mapId<248;mapId++){
  if(mapId===96||mapId===135)continue;
  const {opts,requests}=setup(mapId);
  const result=await collectScriptedBattleLiveReadback(opts);
  assert.equal(result.verified,false,'map '+mapId);
  assert.equal(result.status,'MAP_NOT_SCRIPTED_BATTLE','map '+mapId);
  assert.equal(result.readOnlyReadCalls,0,'map '+mapId);
  assert.equal(requests.length,0,'map '+mapId);
 }
});
test('target changing during script read blocks the second read even if later restored',async()=>{
 const {opts,target,requests}=setup();
 const original=target.host;
 opts.readMemoryBlock=async(address,length)=>{
  requests.push([address,length]);
  if(address==='D665'){
   target.host='192.168.1.146';
   return ['02'];
  }
  target.host=original;
  return ['60','00','00','07','11','00','00','00'];
 };
 const r=await collectScriptedBattleLiveReadback(opts);
 assert.equal(r.verified,false);
 assert.equal(r.status,'RETROARCH_TARGET_CHANGED_BETWEEN_READS');
 assert.equal(r.readOnlyReadCalls,1);
 assert.equal(r.underlyingUdpPacketCount,null);
 assert.deepEqual(requests,[['D665',1]]);
});
