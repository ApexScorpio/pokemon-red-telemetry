'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const RetroArchClient=require('../retroarchClient');
const {senderMatchesTarget}=require('../romUdpResponseSourceGuard');
function fake(){
 const c=Object.create(RetroArchClient.prototype);
 c.ip='192.0.2.20';c.port=55355;c._targetGeneration=0;
 c.pendingResolves=new Map();
 c.lastUdpSendLogAt=Date.now();
 c.socket={
  address:()=>({address:'0.0.0.0',port:40001}),
  send:(_buffer,_offset,_length,_port,_host,callback)=>callback(null)
 };
 c.latestState={connected:true,memoryReadStatus:{verified:true},
  romRuntimeIdentity:{matched:true},romAreaEvidence:{verified:true},
  worldAdvisor:{verified:true}};
 c.emit=()=>{};
 return c;
}
const src=(address='192.0.2.20',port=55355)=>({address,port});
test('IPv4 source match requires exact address and port',()=>{
 const target={host:'192.0.2.20',port:55355};
 assert.equal(senderMatchesTarget(src(),target),true);
 assert.equal(senderMatchesTarget(src('192.0.2.21'),target),false);
 assert.equal(senderMatchesTarget(src('192.0.2.20',55356),target),false);
});
test('no UDP sender metadata cannot be treated as corroborated reply',()=>{
 assert.equal(senderMatchesTarget(null,{host:'192.0.2.20',port:55355}),false);
});
test('localhost resolves only to IPv4 loopback for source matching',()=>{
 assert.equal(senderMatchesTarget(src('127.0.0.1'),{host:'localhost',port:55355}),true);
 assert.equal(senderMatchesTarget(src(),{host:'localhost',port:55355}),false);
});
test('valid matching UDP reply resolves pending read',async()=>{
 const c=fake(),pending=c.sendRaw('READ_CORE_MEMORY D158 1');
 c.handleResponse('READ_CORE_MEMORY D158 AA',src());
 assert.deepEqual(await pending,['AA']);
 assert.equal(c.pendingResolves.size,0);
});
test('wrong source IP never consumes a pending emulator read',async()=>{
 const c=fake(),pending=c.sendRaw('READ_CORE_MEMORY D158 1');
 c.handleResponse('READ_CORE_MEMORY D158 FF',src('192.0.2.21'));
 assert.equal(c.pendingResolves.size,1);
 c.handleResponse('READ_CORE_MEMORY D158 AA',src());
 assert.deepEqual(await pending,['AA']);
});
test('wrong UDP source port cannot fulfill another emulator request',async()=>{
 const c=fake(),pending=c.sendRaw('GET_STATUS');
 c.handleResponse('GET_STATUS PLAYING gb,wrong',src('192.0.2.20',55356));
 assert.equal(c.pendingResolves.size,1);
 c.handleResponse('GET_STATUS PLAYING gb,right',src());
 assert.deepEqual(await pending,['PLAYING','gb,right']);
});
test('missing source metadata cannot authorize an update',async()=>{
 const c=fake(),pending=c.sendRaw('READ_CORE_MEMORY D158 1');
 c.handleResponse('READ_CORE_MEMORY D158 FF');
 assert.equal(c.pendingResolves.size,1);
 c.handleResponse('READ_CORE_MEMORY D158 AA',src());
 assert.deepEqual(await pending,['AA']);
});
test('new same-key request aborts previous resolver without timer collision',async()=>{
 const c=fake();
 const a=c.sendRaw('READ_CORE_MEMORY D158 1');
 const old=c.pendingResolves.get('READ_CORE_MEMORY D158');
 const b=c.sendRaw('READ_CORE_MEMORY D158 1');
 assert.equal(await a,null);
 assert.equal(c.pendingResolves.size,1);
 old(null);
 assert.equal(c.pendingResolves.size,1);
 c.handleResponse('READ_CORE_MEMORY D158 BB',src());
 assert.deepEqual(await b,['BB']);
});
test('setTarget resolves pending calls null without restarting live socket',async()=>{
 const c=fake(),socket=c.socket;
 c.isPolling=true;c.timer={marker:'do-not-close'};
 const pending=c.sendRaw('GET_STATUS');
 assert.equal(c.setTarget('192.0.2.21',55355),true);
 assert.equal(await pending,null);
 assert.equal(c.pendingResolves.size,0);
 assert.equal(c.socket,socket);
 assert.equal(c.isPolling,true);
 assert.equal(c.timer.marker,'do-not-close');
});
test('multi-chunk RAM read aborts after switch without reading new target',async()=>{
 const c=fake();let calls=0;
 c.sendRaw=async()=>{
  calls++;c.ip='192.0.2.21';c._targetGeneration++;
  return Array(160).fill('00');
 };
 const result=await c.readMemoryBlock('D158',530);
 assert.equal(result,null);
 assert.equal(calls,1);
});
test('ordinary multi-chunk RAM read preserves exact complete byte count',async()=>{
 const c=fake();let calls=0;
 c.sendRaw=async cmd=>{
  calls++;
  const length=Number(cmd.split(' ').at(-1));
  return Array(length).fill('00');
 };
 const result=await c.readMemoryBlock('D158',530);
 assert.equal(result.length,530);
 assert.equal(calls,4);
});
test('aborted initial poll must not invalidate new target after old read returns',async()=>{
 const c=fake();c.lastRomStatusReadAt=Date.now();
 let settle,requests=0;
 c.readMemoryBlock=()=>{requests++;return new Promise(r=>{settle=r;});};
 const old=c.fetchGameState();
 assert.equal(requests,1);
 c.setTarget('192.0.2.21',55355);
 const reason=c.latestState.lastReadError;
 settle(Array(530).fill('00'));
 await old;
 assert.equal(requests,1);
 assert.equal(c.latestState.lastReadError,reason);
 assert.equal(c.latestState.romRuntimeIdentity.matched,false);
});
