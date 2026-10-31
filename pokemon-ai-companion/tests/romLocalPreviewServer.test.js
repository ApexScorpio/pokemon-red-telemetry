'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs'),path=require('node:path');
const {WebSocket}=require('ws');
const {createReadOnlyPreviewServer}=require('../scripts/serveDashboardPreview');
const source=fs.readFileSync(
 path.resolve(__dirname,'../scripts/serveDashboardPreview.js'),'utf8');
let server,port;
function req(urlPath,method='GET'){
 return new Promise((resolve,reject)=>{
  const r=http.request({hostname:'127.0.0.1',port,
   path:urlPath,method},res=>{
   const chunks=[];res.on('data',x=>chunks.push(x));
   res.on('end',()=>resolve({status:res.statusCode,
    data:Buffer.concat(chunks).toString('utf8')}));
  });r.once('error',reject);r.end();
 });
}
test.before(async()=>{
 server=createReadOnlyPreviewServer();
 await new Promise((resolve,reject)=>{
  server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
 });
 port=server.address().port;
});
test.after(async()=>{
 await new Promise(resolve=>server.close(resolve));
});
test('real dashboard HTML and JS are accessible only through local GET',async()=>{
 const html=await req('/');
 assert.equal(html.status,200);
 assert.match(html.data,/POKÉVISION|PokéVision/);
 const js=await req('/app.js');
 assert.equal(js.status,200);
 assert.match(js.data,/connectWebSocket\(/);
});
test('preview state refuses fabricated game evidence',async()=>{
 const response=await req('/api/state');
 assert.equal(response.status,200);
 const state=JSON.parse(response.data);
 assert.equal(state.connected,false);
 assert.equal(state.isSimulation,false);
 assert.equal(state.lastUpdate,null);
 assert.equal(state.romRuntimeIdentity.matched,false);
 assert.equal(state.memoryReadStatus.verified,false);
 assert.equal(state.worldAdvisor.verified,false);
 assert.equal(state.globalCampaignLedger.verified,false);
 assert.equal(state.worldRecentCompleteEventChanges.verified,false);
 assert.equal(state.romCompleteEventDelta.verified,false);
 assert.equal(state.party.length,0);
 assert.doesNotMatch(response.data,/TOKEN|SESSION|PRIVATE_KEY/);
});
test('all mutable or external-sync endpoints are forbidden',async()=>{
 for(const endpoint of ['/api/export-markdown','/api/update',
  '/api/advice-now','/api/config','/api/test-battle',
  '/telemetria.md','/telemetria.txt']){
  assert.equal((await req(endpoint)).status,403,endpoint);
 }
 for(const method of ['POST','PUT','DELETE','PATCH']){
  assert.equal((await req('/api/state',method)).status,405,method);
 }
});
test('path traversal and internal sources are never served',async()=>{
 for(const target of ['/start.js','/package.json',
  '/node_modules/ws/package.json','/.git/config',
  '/%2e%2e/start.js','/%2e%2e%2fstart.js']){
  const answer=await req(target);
  assert.notEqual(answer.status,200,target);
 }
});
test('health endpoint truthfully identifies an isolated preview',async()=>{
 const r=await req('/api/preview-health'),health=JSON.parse(r.data);
 assert.equal(r.status,200);
 assert.deepEqual(health,{
  preview:true,connected:false,readOnly:true,
  emulatorContact:false,githubSync:false,romWrites:false
 });
});
test('dashboard websocket sends offline state, no emulator instructions',async()=>{
 const state=await new Promise((resolve,reject)=>{
  const socket=new WebSocket('ws://127.0.0.1:'+port+'/ws');
  socket.once('error',reject);
  socket.once('message',msg=>{
   const obj=JSON.parse(String(msg));socket.close();resolve(obj);
  });
 });
 assert.equal(state.connected,false);
 assert.equal(state.memoryReadStatus.verified,false);
 assert.equal(state.worldAdvisor.verified,false);
});
test('preview source imports no transport, updater, telemetry sync or file writes',()=>{
 for(const forbidden of [
  /require\(['"]\.\.\/retroarchClient/,
  /require\(['"]\.\.\/githubSync/,
  /require\(['"]node:dgram/,
  /writeFileSync|appendFileSync|renameSync|mkdirSync/,
  /execFileSync|spawn\(/,
  /syncToGitHub|triggerDebouncedSync/,
  /READ_CORE_MEMORY|WRITE_CORE_MEMORY/
 ]){
  assert.doesNotMatch(source,forbidden);
 }
 assert.match(source,/server\.listen\(port,'127\.0\.0\.1'/);
});
