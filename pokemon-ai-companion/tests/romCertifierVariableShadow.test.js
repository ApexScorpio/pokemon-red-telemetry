'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const SOURCE=path.join(__dirname,'..','scripts','certifyAsm626.js');
test('certifier manifest atlas cannot be shadowed by ROMX candidate atlas',()=>{
 const source=fs.readFileSync(SOURCE,'utf8');
 assert.equal([...source.matchAll(/\b(?:const|let|var)\s+atlas\s*=/g)].length,1,
  'Only one lexical atlas binding permitted');
 assert.match(source,/const atlas=JSON\.parse\(fs\.readFileSync\(ATLAS,'utf8'\)\);/);
 const start=source.indexOf('const romxScenarioAtlas=closure.mbc3RomxPhysicalScenarios;');
 const end=source.indexOf('const conditionalBanks=closure.mbc3ConditionalRomBankCandidates;',start);
 assert.ok(start>=0&&end>start);
 const block=source.slice(start,end);
 assert.ok(!/\batlas\./.test(block));
 assert.match(block,/romxScenarioAtlas\.verified===true/);
});
test('manifest identity SHA check precedes ROMX scenario classification',()=>{
 const source=fs.readFileSync(SOURCE,'utf8');
 const manifest=source.indexOf('const atlas=JSON.parse(');
 const sha=source.indexOf('atlas.variants?.[variant]?.identity?.sha256');
 const romx=source.indexOf('const romxScenarioAtlas=');
 assert.ok(manifest>=0&&sha>manifest&&romx>sha);
});
