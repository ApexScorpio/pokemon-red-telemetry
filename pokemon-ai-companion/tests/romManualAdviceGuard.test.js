'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {captureManualAdviceScope,requestGuardedManualAdvice}=require('../romManualAdviceGuard');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
function fixture(){
  const c={
    ip:'192.0.2.15',port:55355,_targetGeneration:2,
    _videoEvidenceEpoch:5,
    activeRomProfile:{hash:{sha256:AUDITED_ROM_SHA256.RED}},
    latestState:{
      connected:true,isSimulation:false,lastUpdate:new Date().toISOString(),
      memoryReadStatus:{verified:true,publicationPositionWindow:{verified:true}},
      romRuntimeIdentity:{matched:true,profileSha256:AUDITED_ROM_SHA256.RED},
      trainerName:'RED',mapId:15,mapName:'Route 4',coords:{x:2,y:3},
      party:[{name:'PIKACHU',hp:30,maxHp:40,level:12,moves:[]}],
      inventory:[],badges:[],money:100,inBattle:false
    }
  };
  return c;
}
function deferred(){
  let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};
}
test('verified manual advice is returned for unchanged exact ROM',async()=>{
  const c=fixture();
  const result=await requestGuardedManualAdvice(c,'Onde ir?',async(_q,state)=>{
    assert.equal(state.romRuntimeIdentity.profileSha256,AUDITED_ROM_SHA256.RED);
    return 'Route 4';
  });
  assert.deepEqual(result,{status:'ok',reply:'Route 4'});
});
test('unknown or mismatched ROM blocks external provider',async()=>{
  for(const mutate of [
    c=>{c.latestState.romRuntimeIdentity.matched=false;},
    c=>{c.latestState.romRuntimeIdentity.profileSha256=AUDITED_ROM_SHA256.BLUE;},
    c=>{c.activeRomProfile.hash.sha256=AUDITED_ROM_SHA256.BLUE;}
  ]){
    const c=fixture();mutate(c);let calls=0;
    const result=await requestGuardedManualAdvice(c,'?',()=>{calls++;return 'unsafe';});
    assert.equal(result.status,'unverified');assert.equal(calls,0);
  }
});
test('missing RAM or final position evidence blocks provider',async()=>{
  for(const mutate of [
    c=>{c.latestState.memoryReadStatus.verified=false;},
    c=>{c.latestState.memoryReadStatus.publicationPositionWindow.verified=false;},
    c=>{c.latestState.connected=false;},
    c=>{c.latestState.isSimulation=true;}
  ]){
    const c=fixture();mutate(c);
    assert.equal(captureManualAdviceScope(c),null);
  }
});
test('stale or future RAM timestamp is rejected',()=>{
  const c=fixture();c.latestState.lastUpdate=new Date(Date.now()-30000).toISOString();
  assert.equal(captureManualAdviceScope(c),null);
  c.latestState.lastUpdate=new Date(Date.now()+30000).toISOString();
  assert.equal(captureManualAdviceScope(c),null);
});
test('target generation change invalidates pending answer',async()=>{
  const c=fixture(),d=deferred();
  const p=requestGuardedManualAdvice(c,'Onde?',()=>d.promise);
  c._targetGeneration++;
  d.resolve('wrong');assert.equal((await p).status,'stale');
});
test('epoch bump rejects old answer after same-map reconnect',async()=>{
  const c=fixture(),d=deferred();
  const p=requestGuardedManualAdvice(c,'Onde?',()=>d.promise);
  c._videoEvidenceEpoch++;
  d.resolve('wrong');assert.equal((await p).status,'stale');
});
test('target host or port switch rejects pending answer',async()=>{
  for(const mutate of [
    c=>{c.ip='192.0.2.16';},
    c=>{c.port++;}
  ]){
    const c=fixture(),d=deferred(),p=requestGuardedManualAdvice(c,'Onde?',()=>d.promise);
    mutate(c);d.resolve('wrong');assert.equal((await p).status,'stale');
  }
});
test('map and coordinates changes reject pending answer',async()=>{
  for(const mutate of [
    c=>{c.latestState.mapId++;},
    c=>{c.latestState.coords.x++;}
  ]){
    const c=fixture(),d=deferred(),p=requestGuardedManualAdvice(c,'Onde?',()=>d.promise);
    mutate(c);d.resolve('wrong');assert.equal((await p).status,'stale');
  }
});
test('team and inventory changes reject pending answer',async()=>{
  for(const mutate of [
    c=>{c.latestState.party[0].hp--;},
    c=>{c.latestState.inventory.push({id:1,name:'Potion',qty:1});}
  ]){
    const c=fixture(),d=deferred(),p=requestGuardedManualAdvice(c,'Onde?',()=>d.promise);
    mutate(c);d.resolve('wrong');assert.equal((await p).status,'stale');
  }
});
test('battle advice requires exact current turn and rejects changing enemy HP',async()=>{
  const c=fixture();c.latestState.inBattle=true;
  c.latestState.battle={exactTurnMathReady:false,enemy:{name:'ZUBAT',hp:20}};
  assert.equal(captureManualAdviceScope(c),null);
  c.latestState.battle.exactTurnMathReady=true;
  const d=deferred(),p=requestGuardedManualAdvice(c,'Ataque?',()=>d.promise);
  c.latestState.battle.enemy.hp=10;
  d.resolve('old');assert.equal((await p).status,'stale');
});
test('provider failures cannot cause stale reply',async()=>{
  const c=fixture();
  assert.equal((await requestGuardedManualAdvice(c,'Onde?',async()=>{
    throw Error('provider secret');
  })).status,'unavailable');
  assert.equal((await requestGuardedManualAdvice(c,'Onde?',async()=>null)).status,'unavailable');
});
test('invalid questions or missing provider never call external API',async()=>{
  const c=fixture();let calls=0;const fn=()=>{calls++;return 'unsafe';};
  assert.equal((await requestGuardedManualAdvice(c,' ',fn)).status,'invalid');
  assert.equal((await requestGuardedManualAdvice(c,'A'.repeat(2001),fn)).status,'invalid');
  assert.equal((await requestGuardedManualAdvice(c,'?',null)).status,'invalid');
  assert.equal(calls,0);
});
