'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {verifyGlobalFlagReadback}=require('../romGlobalFlagReadback');
const world=()=>Array(784).fill('00');
const repeat=b=>{
 const x=Array(407).fill('00');
 for(let i=0;i<14;i++)x[i]=b[336+i];
 for(let i=0;i<2;i++)x[14+i]=b[350+i];
 for(let i=0;i<320;i++)x[87+i]=b[423+i];
 return x;
};
const matching=(b=world(),r=repeat(b))=>({
 firstWorldBlockHex:b,repeatFlagWindowHex:r,
 repeatMapHex:['0a'],expectedMapId:10,
 romIdentityMatched:true,mapWindowVerified:true,
 positionWindowVerified:true
});
test('336 global flags are independently repeated without claiming an atomic frame',()=>{
 const b=world();b[336]='01';b[350]='a0';b[423]='FE';b[742]='42';
 const a=matching(b),r=verifyGlobalFlagReadback(a);
 assert.equal(r.verified,true);assert.equal(r.readbackBytesMatched,336);
 assert.equal(r.hiddenItemBytesMatched,14);
 assert.equal(r.hiddenCoinBytesMatched,2);
 assert.equal(r.worldEventBytesMatched,320);
 assert.equal(r.snapshotAtomicVerified,false);
 assert.equal(r.playerActionConfirmed,false);
 assert.equal(r.romAndMapCorroborated,true);
});
test('a readback is case-insensitive hex but rejects any changed byte per domain',()=>{
 const b=world();b[423]='aB';const a=matching(b);a.repeatFlagWindowHex[87]='AB';
 assert.equal(verifyGlobalFlagReadback(a).verified,true);
 for(const [offset,domain] of [[0,'HIDDEN_ITEMS'],[14,'HIDDEN_COINS'],
  [87,'WORLD_EVENTS'],[406,'WORLD_EVENTS']]){
  const x=matching();x.repeatFlagWindowHex[offset]='01';
  const r=verifyGlobalFlagReadback(x);
  assert.equal(r.verified,false);
  assert.equal(r.domain,domain);
  assert.equal(r.snapshotAtomicVerified,false);
 }
});
test('missing or partial second read never promotes synthetic RAM to live certainty',()=>{
 const options=[
  {repeatFlagWindowHex:null},
  {repeatFlagWindowHex:Array(406).fill('00')},
  {repeatFlagWindowHex:Array(407).fill('gg')},
  {firstWorldBlockHex:Array(783).fill('00')},
  {firstWorldBlockHex:Array(784).fill(0)},
  {repeatMapHex:[]},
  {repeatMapHex:['0b']},
  {expectedMapId:248},
  {romIdentityMatched:false},
  {mapWindowVerified:false},
  {positionWindowVerified:false}
 ];
 for(const changes of options){
  const x=verifyGlobalFlagReadback({...matching(),...changes});
  assert.equal(x.verified,false);
  assert.equal(x.readbackBytesMatched,0);
  assert.equal(x.romAndMapCorroborated,false);
 }
});
test('live RetroArch pipeline requires corroboration before global ledgers',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
 assert.match(src,/readMemoryBlock\('D6F0',407\)/);
 assert.match(src,/readMemoryBlock\('D35E',1\)/);
 assert.match(src,/globalFlagReadback=verifyGlobalFlagReadback\(/);
 const i=src.indexOf('this.latestState.globalCampaignLedger=buildCampaignLedger({');
 const j=src.indexOf('this.latestState.romWorldEventAtlas=buildWorldEventAtlas({');
 assert.ok(i>=0&&j>i);
 assert.match(src.slice(i,j),/positionWindow\.verified===true&&globalFlagReadback\.verified===true/);
 assert.match(src.slice(j,j+470),/positionWindow\.verified===true&&globalFlagReadback\.verified===true/);
});
