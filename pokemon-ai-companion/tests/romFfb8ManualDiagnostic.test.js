'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const {buildManualFfb8Response}=
 require('../romFfb8ManualDiagnostic');

const headers={
 'x-pokeguide-ffb8-opt-in':'READ_ONLY_FFB8'
};

const client=()=>({
 ip:'127.0.0.1',
 port:55355,
 latestState:{
  connected:true,
  isSimulation:false,
  romRuntimeIdentity:{matched:true}
 }
});

const successfulProbe=async()=>({
 verified:true,
 ffb8ReadbackVerified:true,
 romProfileCRC32Matched:true,
 activeRomSha256Verified:false,
 snapshotAtomicVerified:false,
 playerActionConfirmed:false,
 gameEffectsCertified:false,
 mbc3ActiveBankVerified:false,
 variant:'red',
 mapId:12,
 ffb8SourceEvidence:{
  verified:true,
  addressCpu:0xffb8,
  firstHex:'42',
  repeatHex:'42',
  repeatedStable:true,
  bankRegisterWriteObserved:false,
  gameplayEventObserved:false,
  selectedBank:null
 }
});

const call=(overrides={})=>buildManualFfb8Response({
 remoteAddress:'127.0.0.1',
 method:'GET',
 headers,
 client:client(),
 probe:successfulProbe,
 ...overrides
});

test('manual opt-in yields only a RAM byte diagnostic',async()=>{
 let count=0;
 const response=await call({
  probe:async args=>{
   count++;
   assert.equal(args.host,'127.0.0.1');
   assert.equal(args.ffb8Readback,true);
   assert.equal(args.mbc3SourceReadback,false);
   return successfulProbe();
  }
 });

 assert.equal(count,1);
 assert.equal(response.status,200);
 assert.equal(response.body.firstHex,'42');
 assert.equal(response.body.addressCpu,0xffb8);
 assert.equal(response.body.selectedBank,null);
 assert.equal(response.body.bankRegisterWriteObserved,false);
 assert.equal(response.body.gameplayEventObserved,false);
 assert.equal(response.body.activeRomSha256Verified,false);
 assert.equal(response.body.snapshotAtomicVerified,false);
});

test('requests without opt-in never call the probe',async()=>{
 let calls=0;
 const probe=async()=>{
  calls++;
  return successfulProbe();
 };
 for(const headersValue of [{},null]){
  const result=await call({
   headers:headersValue||{},
   probe
  });
  assert.equal(result.status,403);
 }
 assert.equal(calls,0);
});

test('remote, cross-origin and wrong method are rejected',async()=>{
 let calls=0;
 const probe=async()=>{
  calls++;
  return successfulProbe();
 };
 const cases=[
  {remoteAddress:'192.168.1.30'},
  {remoteAddress:'::ffff:192.168.1.30'},
  {method:'POST'},
  {headers:{...headers,origin:'https://example.com'}}
 ];

 for(const entry of cases){
  const result=await call({...entry,probe});
  assert.ok(result.status===403||result.status===405);
 }
 assert.equal(calls,0);
});

test('unverified or simulated game state never causes a probe',async()=>{
 let calls=0;
 const probe=async()=>{
  calls++;
  return successfulProbe();
 };

 const states=[
  {connected:false,romRuntimeIdentity:{matched:true}},
  {connected:true,isSimulation:true,romRuntimeIdentity:{matched:true}},
  {connected:true,romRuntimeIdentity:{matched:false}}
 ];

 for(const state of states){
  const c=client();
  c.latestState=state;
  const result=await call({client:c,probe});
  assert.equal(result.status,409);
 }

 assert.equal(calls,0);
});

test('unstable or untrusted evidence fails closed',async()=>{
 const variants=[
  {ffb8ReadbackVerified:false},
  {activeRomSha256Verified:true},
  {gameEffectsCertified:true},
  {mbc3ActiveBankVerified:true},
  {ffb8SourceEvidence:{
   ...(await successfulProbe()).ffb8SourceEvidence,
   repeatHex:'43'
  }}
 ];

 for(const changes of variants){
  const result=await call({
   probe:async()=>({...await successfulProbe(),...changes})
  });
  assert.equal(result.status,502);
  assert.equal(result.body.selectedBank,null);
  assert.equal(result.body.gameplayEventObserved,false);
 }
});

test('probe errors cannot be presented as valid bytes',async()=>{
 const result=await call({
  probe:async()=>{throw new Error('read failed');}
 });

 assert.equal(result.status,502);
 assert.equal(result.body.verified,false);
});

test('existing server and dashboard contain manual-only wiring',()=>{
 const root=path.join(__dirname,'..');
 const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');

 assert.ok(server.includes("'/api/diagnostics/ffb8'"));
 assert.ok(server.includes('buildManualFfb8Response'));
 assert.ok(html.includes('id="btn-ffb8-manual"'));
 assert.ok(html.includes('id="ffb8-manual-result"'));
 assert.ok(app.includes("addEventListener('click'"));
 assert.ok(app.includes("'X-Pokeguide-FFB8-Opt-In'"));
 assert.ok(app.includes('Banco ROM e execução de eventos NÃO comprovados'));
});