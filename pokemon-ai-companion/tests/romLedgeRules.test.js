'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {readRom}=require('../romComprehensiveAudit');
const {readLedgeRules,ledgeCandidate}=require('../romLedgeRules');
const dir=process.env.POKEMON_ROM_DIR;
const files={red:process.env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon - Red Version (UE)[!].zip')),
 blue:process.env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
 green:process.env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon%20Green%20International%20v1.2.1.gb'))};
for(const [n,p] of Object.entries(files))test(n+' 8 ROM ledge rules and pad masks',
 {skip:!p||!fs.existsSync(p)?'ROM file required':false},()=>{
  const o=readLedgeRules(readRom(p));assert.equal(o.verified,true,o.reason);
  assert.equal(o.count,8);assert.equal(o.entries.length,8);
  assert.deepEqual(o.entries.map(x=>x.direction),['south','south','south','west','west','east','east','east']);
  assert.deepEqual(o.entries.map(x=>x.requiredPadMask),[128,128,128,32,32,16,16,16]);
  assert.equal(ledgeCandidate({romSha256:o.romSha256,tilesetId:0,standingTileId:0x2c,ledgeTileId:0x37,direction:'south'}).ledgeCandidate,true);
  assert.equal(ledgeCandidate({romSha256:o.romSha256,tilesetId:0,standingTileId:0x2c,ledgeTileId:0x37,direction:'north'}).ledgeCandidate,false);
  assert.equal(ledgeCandidate({romSha256:o.romSha256,tilesetId:17,standingTileId:0x2c,ledgeTileId:0x37,direction:'south'}).ledgeCandidate,false);
  assert.equal(ledgeCandidate({romSha256:o.romSha256,tilesetId:0,standingTileId:0x2c,ledgeTileId:0x37,direction:'south'}).jumpInCurrentFrameVerified,false);
 } );
test('reject forged or incomplete ledge input',()=>{
 assert.equal(readLedgeRules(Buffer.alloc(1048576)).verified,false);
 assert.equal(readLedgeRules(Buffer.alloc(24)).verified,false);
 assert.equal(ledgeCandidate({romSha256:'0'.repeat(64),tilesetId:0,standingTileId:0x2c,ledgeTileId:0x37,direction:'south'}).verified,false);
});