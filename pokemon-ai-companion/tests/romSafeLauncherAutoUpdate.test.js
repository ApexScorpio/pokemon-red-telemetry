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
test('initial launcher checks feature branch before any Git fetch',()=>{
 const boot=launcher.indexOf('if (AUTOUPDATE_OPT_IN) {');
 const check=launcher.indexOf("git(['symbolic-ref','--quiet','--short','HEAD'])",boot);
 const fetch=launcher.indexOf("git(['fetch', 'origin', 'main'])",boot);
 const otherwise=launcher.indexOf('}else{\n  console.log',boot);
 assert.ok(boot>=0&&check>boot&&fetch>check&&otherwise>fetch);
 assert.match(launcher.slice(check,fetch),/branch!=='main'/);
 assert.match(launcher,/Atualizações automáticas desativadas/);
});
test('supervisor keeps a safe launch without restarting existing apps',()=>{
 assert.match(launcher,/function launchServer\(\)/);
 assert.match(launcher,/serverProcess = spawn\(process\.execPath, \['server.js'\]/);
 assert.match(launcher,/if \(!AUTOUPDATE_OPT_IN \|\| checkingForUpdates \|\| shuttingDown\) return/);
 assert.doesNotMatch(launcher,/git\(\['reset','--hard'/);
 assert.doesNotMatch(launcher,/git\(\['checkout','--force'/);
});
