'use strict';
// Production safety is audited by import-safe unit tests; never execute server.js
// because that starts RetroArch polling and could contact the emulated game.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createServerSafetyPolicy,denySideEffect,publicFile}
 =require('../serverSafetyPolicy');
const load=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=load('server.js'),sync=load('githubSync.js'),app=load('public/app.js');
test('fail closed: local binding, no GitHub sync, AI, mutations or updater',()=>{
 const p=createServerSafetyPolicy({});
 assert.deepEqual(p,{bindHost:'127.0.0.1',allowUpdate:false,
  allowWriteApi:false,allowExternalAi:false,allowGitHubSync:false});
 for(const path of ['/api/update','/api/config','/api/test-battle',
  '/api/ask-ai','/api/advice-now'])
  assert.equal(denySideEffect(p,'POST',path),true);
});
test('explicit opt-ins are independent; update needs both confirmation flags',()=>{
 const baseline=createServerSafetyPolicy({POKEGUIDE_ALLOW_LAN:'true',
  POKEGUIDE_GITHUB_SYNC_OPT_IN:'true',POKEGUIDE_WRITE_API_OPT_IN:'yes'});
 assert.equal(baseline.bindHost,'127.0.0.1');
 assert.equal(baseline.allowGitHubSync,false);
 assert.equal(baseline.allowWriteApi,false);
 const p=createServerSafetyPolicy({
  POKEGUIDE_ALLOW_LAN:'1',POKEGUIDE_GITHUB_SYNC_OPT_IN:'1',
  POKEGUIDE_WRITE_API_OPT_IN:'1',POKEGUIDE_AI_OPT_IN:'1',
  POKEGUIDE_ALLOW_UPDATE:'1',POKEGUIDE_AUTOUPDATE_OPT_IN:'1'});
 assert.equal(p.bindHost,'0.0.0.0');
 assert.equal(p.allowGitHubSync,true);
 for(const path of ['/api/update','/api/config','/api/test-battle',
  '/api/ask-ai','/api/advice-now'])
  assert.equal(denySideEffect(p,'POST',path),false);
 const half=createServerSafetyPolicy({POKEGUIDE_ALLOW_UPDATE:'1'});
 assert.equal(half.allowUpdate,false);
});
test('static file resolution confines to public and rejects traversal',()=>{
 const root=path.join(__dirname,'../public');
 for(const candidate of ['/', '/app.js','/style.css']){
  const result=publicFile(root,candidate);
  assert.ok(result,candidate);
  assert.ok(result.file.startsWith(root));
 }
 for(const input of [
  '/../.github_token','/%2e%2e%2f.github_token',
  '/.%2e/.github_token','/..%5c.github_token',
  '/.git/config','/package.json','/does-not-exist.js',
  '/%00','/telemetria.md'
 ]){
  assert.equal(publicFile(root,input),null,input);
 }
});
test('runtime gates mutate only on opt-in; branch checked before fetch',()=>{
 assert.match(source,/const POLICY = createServerSafetyPolicy\(process\.env\)/);
 assert.match(source,/server\.listen\(PORT, BIND_HOST/);
 assert.match(source,/if\(denySideEffect\(POLICY,req\.method,url\.pathname\)\)/);
 const at=source.indexOf("if (url.pathname === '/api/update'");
 const branch=source.indexOf("const activeBranch=git(['symbolic-ref'",at);
 const fetch=source.indexOf("git(['fetch','origin','main'])",at);
 assert.ok(at>=0&&branch>at&&fetch>branch);
 assert.match(source.slice(branch,fetch),/activeBranch!=='main'/);
 assert.match(source,/if\(POLICY\.allowGitHubSync\)triggerDebouncedSync\(state\)/);
 assert.match(source,/POLICY\.allowGitHubSync\s*\? await syncToGitHub/);
 assert.match(source,/githubSynchronized:synchronized/);
 assert.doesNotMatch(source,/Access-Control-Allow-Origin.*\*/);
});
test('token retrieval is lazy, only from explicit upload operation',()=>{
 assert.doesNotMatch(sync,/^const GITHUB_TOKEN = getGitHubToken\(\);/m);
 const f=sync.indexOf('async function syncToGitHub(state)');
 const token=sync.indexOf('const GITHUB_TOKEN = getGitHubToken();',f);
 assert.ok(f>=0&&token>f);
 assert.match(app,/data\.githubSynchronized === true/);
 assert.match(app,/Copiado localmente/);
});
