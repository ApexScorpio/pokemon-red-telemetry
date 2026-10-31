'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {isLocalRequester,getRuntimeConnectionSnapshot,buildLocalConnectionResponse}
 =require('../romRuntimeConnectionSnapshot');
const make=()=>({ip:'192.168.1.145',port:55355,isPolling:true,
 latestState:{connected:false,lastUpdate:null,isSimulation:false,
 romRuntimeIdentity:{matched:false}}});
test('snapshot reads current target and never claims network reachability',()=>{
 const client=make(),snapshot=getRuntimeConnectionSnapshot(client,{
  startupHost:'192.168.1.145',startupPort:55355
 });
 assert.equal(snapshot.verified,true);
 assert.equal(snapshot.selectedTargetHost,'192.168.1.145');
 assert.equal(snapshot.selectedTargetPort,55355);
 assert.equal(snapshot.equalsStartupDefaults,true);
 assert.equal(snapshot.latestStateConnected,false);
 assert.equal(snapshot.latestRomIdentityMatched,false);
 assert.equal(snapshot.retroArchReachabilityConfirmed,false);
 assert.equal(snapshot.noUdpRequestsPerformed,true);
 assert.equal(snapshot.mbc3ActiveBankVerified,false);
});
test('target reflects live in-memory changes without server restart',()=>{
 const client=make();
 client.ip='192.168.1.199';client.port=55356;
 const response=buildLocalConnectionResponse({remoteAddress:'127.0.0.1',
  client,startupHost:'192.168.1.145',startupPort:55355});
 assert.equal(response.status,200);
 assert.equal(response.body.selectedTargetHost,'192.168.1.199');
 assert.equal(response.body.selectedTargetPort,55356);
 assert.equal(response.body.equalsStartupDefaults,false);
 assert.equal(response.body.targetSelectionHistoryKnown,false);
});
test('IPv4 and IPv6 loopback accepted but all LAN, Tailscale, public rejected',()=>{
 for(const a of ['127.0.0.1','127.12.1.4','::1','::ffff:127.0.0.1'])
  assert.equal(isLocalRequester(a),true,a);
 for(const a of ['192.168.1.50','192.168.1.145','100.109.221.71',
  '10.1.1.1','::ffff:192.168.1.50','localhost',null,''])
  assert.equal(isLocalRequester(a),false,String(a));
});
test('remote requests get no current target host or state',()=>{
 const reply=buildLocalConnectionResponse({remoteAddress:'192.168.1.50',
  client:make(),startupHost:'192.168.1.145',startupPort:55355});
 assert.equal(reply.status,403);
 assert.equal(JSON.stringify(reply.body).includes('192.168.1.145'),false);
 assert.deepEqual(reply.body,{verified:false,error:'LOOPBACK_ONLY'});
});
test('missing client, invalid port and stale state fail closed',()=>{
 const noClient=buildLocalConnectionResponse({remoteAddress:'::1'});
 assert.equal(noClient.status,503);
 const invalid=getRuntimeConnectionSnapshot({ip:'192.168.1.145',port:0});
 assert.equal(invalid.verified,false);
 const client=make();client.latestState={connected:true,
  romRuntimeIdentity:{matched:true},lastUpdate:'2026-10-31T11:00:00Z'};
 const report=getRuntimeConnectionSnapshot(client,{});
 assert.equal(report.latestStateConnected,true);
 assert.equal(report.latestRomIdentityMatched,true);
 assert.equal(report.retroArchReachabilityConfirmed,false);
 assert.equal(report.activeRomSha256Verified,false);
});
