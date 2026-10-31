'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const RetroArchClient=require('../retroarchClient');
function makeFakePollClient(){
 const c=Object.create(RetroArchClient.prototype);
 c.latestState={
  connected:true,lastUpdate:'2026-10-31T03:20:00Z',
  lastReadError:null,
  memoryReadStatus:{verified:true,
   globalFlagReadback:{verified:true,readbackBytesMatched:336}},
  worldAdvisor:{verified:true,mapId:15},
  worldRecentCompleteEventChanges:{verified:true,events:[{bitIndex:192}]},
  romCompleteEventDelta:{verified:true,changes:[{bitIndex:192}]},
  mapEntities:[{x:1,y:2}]
 };
 const resetReasons=[];
 c._worldCampaignSession={reset:why=>resetReasons.push('campaign:'+why)};
 c._worldReferenceSession={reset:why=>resetReasons.push('named:'+why)};
 c._completeEventBitSession={reset:why=>resetReasons.push('full:'+why)};
 const emitted=[];
 c.emit=(type,state)=>emitted.push({type,state});
 return {client:c,resetReasons,emitted};
}
test('unexpected poll exception invalidates all bit baselines and old world advice',()=>{
 const {client,resetReasons,emitted}=makeFakePollClient();
 const msg=client.invalidateUnexpectedPoll(
  Object.assign(new Error('secret token must not be leaked'),{code:'EIO'}));
 assert.equal(msg,'UNEXPECTED_RAM_POLL_EXCEPTION_EIO');
 assert.equal(client.latestState.connected,false);
 assert.equal(client.latestState.lastUpdate,null);
 assert.equal(client.latestState.memoryReadStatus.verified,false);
 assert.equal(client.latestState.memoryReadStatus.globalFlagReadback.verified,false);
 assert.equal(client.latestState.memoryReadStatus.pollException.errorCode,'EIO');
 assert.equal(client.latestState.memoryReadStatus.pollException.worldEvidenceDiscarded,true);
 assert.equal(client.latestState.worldAdvisor.verified,false);
 assert.equal(client.latestState.worldRecentCompleteEventChanges.verified,false);
 assert.equal(client.latestState.worldRecentCompleteEventChanges.events.length,0);
 assert.equal(client.latestState.romCompleteEventDelta.verified,false);
 assert.equal(client.latestState.romItemAccess.verified,false);
 assert.equal(client.latestState.romMap,null);
 assert.deepEqual(client.latestState.mapEntities,[]);
 assert.equal(resetReasons.length,3);
 assert.ok(resetReasons.some(x=>x.startsWith('full:')));
 assert.equal(emitted.length,1);
 assert.equal(emitted[0].type,'update');
 assert.equal(emitted[0].state,client.latestState);
 assert.doesNotMatch(JSON.stringify(client.latestState),/secret token/);
});
test('errors lacking safe code cannot inject text into the public state',()=>{
 const {client}=makeFakePollClient();
 client.invalidateUnexpectedPoll({
  code:'TOKEN=secret value',message:'password credentials'}
 );
 assert.equal(client.latestState.memoryReadStatus.pollException.errorCode,'UNKNOWN');
 assert.equal(client.latestState.memoryReadStatus.pollException.count,1);
 client.invalidateUnexpectedPoll(new Error('another error'));
 assert.equal(client.latestState.memoryReadStatus.pollException.count,2);
 assert.doesNotMatch(JSON.stringify(client.latestState),/secret value|credentials/);
});
test('source ensures any thrown fetch rejects stale state before the next cycle',()=>{
 const source=fs.readFileSync(
  path.join(__dirname,'../retroarchClient.js'),'utf8');
 const begin=source.indexOf('startPolling() {');
 const fetch=source.indexOf('await this.fetchGameState();',begin);
 const caught=source.indexOf('} catch (err) {',fetch);
 const invalidated=source.indexOf('this.invalidateUnexpectedPoll(err);',caught);
 const scheduled=source.indexOf('this.timer = setTimeout(poll, this.pollInterval)',caught);
 assert.ok(begin>0&&fetch>begin&&caught>fetch);
 assert.ok(invalidated>caught&&scheduled>invalidated);
 assert.match(source,/this\.invalidateWorldEvidence\(reason\)/);
 assert.match(source,/this\.latestState\.lastUpdate=null/);
 assert.match(source,/this\.latestState\.memoryReadStatus=\{/);
 assert.match(source,/this\.emit\('update',this\.latestState\)/);
});
