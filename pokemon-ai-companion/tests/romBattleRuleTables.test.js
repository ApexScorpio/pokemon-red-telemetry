'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {readRomBattleRuleTables}=require('../romBattleRuleTables');
for(const [name,key] of [
 ['Red','POKEMON_RED_ROM'],['Blue','POKEMON_BLUE_ROM'],
 ['Green International','POKEMON_GREEN_ROM']
]){
 test('real ROM: 13 ratios and high critical moves '+name,
  {skip:!process.env[key]?'Local ROM path not supplied':false},()=>{
   const r=readRomBattleRuleTables(fs.readFileSync(process.env[key]));
   assert.equal(r.verified,true);
   assert.equal(r.statModifierRatiosFromRom.length,13);
   assert.deepEqual(r.highCriticalMoveIdsFromRom,[2,75,152,163]);
   assert.deepEqual(r.statModifierRatiosFromRom[0],{numerator:25,denominator:100});
   assert.deepEqual(r.statModifierRatiosFromRom[6],{numerator:1,denominator:1});
   assert.deepEqual(r.statModifierRatiosFromRom[12],{numerator:4,denominator:1});
   assert.equal(r.highCriticalMovesOffset,0x3e08e);
   assert.equal(r.statModifierRatiosOffset,0x3f6cb);
 });
}
test('refuse non-audited ROM even if HighCriticalMoves bytes match',()=>{
 const b=Buffer.alloc(1048576);
 b.set([2,75,152,163,255],0x3e08e);
 assert.equal(readRomBattleRuleTables(b).verified,false);
 assert.equal(readRomBattleRuleTables(null).verified,false);
});
test('differentiate unused critical table from effective table',()=>{
 if(!process.env.POKEMON_RED_ROM)return;
 const b=Buffer.from(fs.readFileSync(process.env.POKEMON_RED_ROM));
 b[0x3e08e]^=1;
 assert.equal(readRomBattleRuleTables(b).verified,false);
});