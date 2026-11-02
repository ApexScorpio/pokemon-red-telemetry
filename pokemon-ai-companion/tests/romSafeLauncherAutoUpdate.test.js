'use strict';
// Safe launcher contract: inspect source only. DO NOT execute start.js in tests,
// because it creates a real child server and may contact the emulator.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const launcher=fs.readFileSync(path.join(__dirname,'../start.js'),'utf8');
test('launcher has explicit opt-in, disabled by default',()=>{
 assert.match(launcher,/process\.env\.POKEGUIDE_AUTOUPDATE_OPT_IN === '1'/);
 const start=launcher.indexOf('function checkForUpdates()');
 const guard=launcher.indexOf('if (!AUTOUPDATE_OPT_IN ||',start);
 const branch=launcher.indexOf("git(['symbolic-ref','--quiet','--short','HEAD'])",start);
 const fetch=launcher.indexOf("git(['fetch', 'origin', 'main'])",start);
 assert.ok(start>=0&&guard>start&&branch>guard&&fetch>branch);
 assert.match(launcher.slice(branch,fetch),/branch!=='main'/);
});
test('initial branch guard precedes Git fetch on both LF and Windows CRLF',()=>{
 for(const source of [
  launcher.replace(/\r\n/g,'\n'),
  launcher.replace(/\r?\n/g,'\r\n')
 ]){
  const boot=source.indexOf('if (AUTOUPDATE_OPT_IN) {');
  const check=source.indexOf("git(['symbolic-ref','--quiet','--short','HEAD'])",boot);
  const fetch=source.indexOf("git(['fetch', 'origin', 'main'])",boot);
  const otherwise=source.indexOf("console.log('[Updater] Atualizações automáticas desativadas",fetch);
  assert.ok(boot>=0&&check>boot&&fetch>check&&otherwise>fetch,
   'startup branch guard, fetch and opt-out branch must be ordered');
  assert.match(source.slice(check,fetch),/branch!=='main'/);
  assert.match(source.slice(fetch,otherwise),/\}\s*else\s*\{\s*console\.log/);
  assert.match(source,/Atualizações automáticas desativadas/);
 }
});
test('supervisor keeps a safe launch without restarting existing apps',()=>{
 assert.match(launcher,/function launchServer\(\)/);
 assert.match(launcher,/serverProcess = spawn\(process\.execPath, \['server.js'\]/);
 assert.match(launcher,/if \(!AUTOUPDATE_OPT_IN \|\| checkingForUpdates \|\| shuttingDown\) return/);
 assert.doesNotMatch(launcher,/git\(\['reset','--hard'/);
 assert.doesNotMatch(launcher,/git\(\['checkout','--force'/);
});
