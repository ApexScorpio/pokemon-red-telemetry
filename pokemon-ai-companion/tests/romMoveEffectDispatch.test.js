'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {readRom}=require('../romComprehensiveAudit');
const {auditMoveEffectDispatch}=require('../romMoveEffectDispatch');
const dir=process.env.POKEMON_ROM_DIR||null;
const files={red:process.env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon - Red Version (UE)[!].zip')),
 blue:process.env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
 green:process.env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon%20Green%20International%20v1.2.1.gb'))};
const ready=Object.values(files).every(p=>p&&fs.existsSync(p));
const t=ready?test:test.skip;
test('rejects non-audited 1 MiB ROM, never uses generic handler data',()=>{
 const fake=Buffer.alloc(1048576);assert.equal(auditMoveEffectDispatch(fake).verified,false);
});
for(const [variant,filename] of Object.entries(files)){
 t(variant+' 165 moves mapped to all 86 effect dispatch entries',()=>{
  const report=auditMoveEffectDispatch(readRom(filename));
  assert.equal(report.verified,true,report.reason);assert.equal(report.effectSlots,86);
  assert.equal(report.nullHandlerSlots,7);assert.equal(report.distinctHandlerTargets,35);
  assert.equal(report.moveCount,165);assert.equal(report.movesWithPointerHandler,123);
  assert.equal(report.movesWithCoreOrNoAdditionalEffect,42);
  assert.equal(report.allEffectsSemanticallyCertified,false);
  assert.equal(report.handlers[0].handler,'SleepEffect');
  assert.equal(report.handlers[85].handler,'DisableEffect');
  assert.equal(report.moves[0].handler,'NO_ADDITIONAL_EFFECT');
  assert.equal(report.moves[25].handler,'NULL');
  assert.equal(report.moves[25].corePathMayApply,true);
 });
}
t( 'effect pointer table has identical code destinations in the exact 3 ROMs, no inferred turn outcome',()=>{
 const reports=Object.values(files).map(f=>auditMoveEffectDispatch(readRom(f)));
 assert.deepEqual(reports[0].handlers,reports[1].handlers);
 assert.deepEqual(reports[1].handlers,reports[2].handlers);
 assert.ok(reports[0].moves.every(m=>m.effectOutcomeCertified===false));
});